import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/data-query/service");
vi.mock("@/lib/globeStateStore");
vi.mock("@/lib/mcpSessionCatalog");
vi.mock("@/lib/globeCommandQueue");
vi.mock("@/lib/nominatim", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/nominatim")>();
    return {
        ...actual,
        fetchGeocode: vi.fn(),
    };
});

import { getAllPluginSnapshots, getEntitiesInRegion } from "@/lib/data-query/service";
import { readActiveSessions, readGlobeState } from "@/lib/globeStateStore";
import { readSessionCatalog } from "@/lib/mcpSessionCatalog";
import { resolveActiveSessionId, enqueueGlobeCommand } from "@/lib/globeCommandQueue";
import { fetchGeocode } from "@/lib/nominatim";
import { registerDiscoveryTools } from "./discoveryTools";

const mockGetAllSnapshots = vi.mocked(getAllPluginSnapshots);
const mockGetEntitiesInRegion = vi.mocked(getEntitiesInRegion);
const mockReadActiveSessions = vi.mocked(readActiveSessions);
const mockReadGlobeState = vi.mocked(readGlobeState);
const mockReadSessionCatalog = vi.mocked(readSessionCatalog);
const mockResolveActiveSessionId = vi.mocked(resolveActiveSessionId);
const mockEnqueueGlobeCommand = vi.mocked(enqueueGlobeCommand);
const mockFetchGeocode = vi.mocked(fetchGeocode);

// ---------------------------------------------------------------------------
// Minimal fake server that captures handlers
// ---------------------------------------------------------------------------
const handlers: Record<string, (args: unknown) => unknown> = {};
const schemas: Record<string, { description: string; inputSchema: Record<string, unknown> }> = {};
const mockServer = {
    registerTool: vi.fn(
        (
            name: string,
            schema: { description: string; inputSchema: Record<string, unknown> },
            handler: (args: unknown) => unknown,
        ) => {
            handlers[name] = handler;
            schemas[name] = schema;
        },
    ),
};

const ctx = { userId: "user-test-1" };

/** The v2 envelope as the handlers emit it (text + structuredContent). */
interface EnvelopeShape {
    ok?: boolean;
    data?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    error?: string;
    message?: string;
    hint?: string;
    validValues?: string[];
}

function textOf(result: unknown): string {
    return (result as { content: Array<{ text: string }> }).content[0].text;
}

function envelopeOf(result: unknown): EnvelopeShape {
    return JSON.parse(textOf(result)) as EnvelopeShape;
}

function isErrorResult(result: unknown): boolean {
    return (result as { isError?: boolean }).isError === true;
}

/** One streaming plugin, as getAllPluginSnapshots would report it. */
function snapshot(pluginId: string, entityCount = 0) {
    return {
        pluginId,
        entities: Array.from({ length: entityCount }, (_, i) => ({
            id: pluginId + "-" + i,
            pluginId,
            latitude: 0,
            longitude: 0,
            properties: { status: "airborne" },
            timestamp: new Date(),
        })),
        timestamp: new Date(),
    };
}

// Re-usable geocode response fixture (Auckland, NZ)
const aucklandGeoRaw = {
    lat: "-36.8485",
    lon: "174.7633",
    name: "Auckland",
    display_name: "Auckland, Auckland, New Zealand",
    boundingbox: ["-37.0", "-36.5", "174.5", "175.0"] as [string, string, string, string],
    importance: 0.8,
    address: { country: "New Zealand" },
    namedetails: { "name:en": "Auckland" },
    type: "city",
    addresstype: "place",
};

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    Object.keys(schemas).forEach((k) => delete schemas[k]);

    // Defaults -- individual tests override as needed
    mockGetAllSnapshots.mockResolvedValue([]);
    mockGetEntitiesInRegion.mockResolvedValue({ entities: [], emptyReason: "no_data_matches" });
    mockReadActiveSessions.mockResolvedValue([]);
    mockReadGlobeState.mockResolvedValue(null);
    mockReadSessionCatalog.mockResolvedValue(null);
    mockResolveActiveSessionId.mockResolvedValue(null);
    mockEnqueueGlobeCommand.mockResolvedValue(undefined);
    mockFetchGeocode.mockResolvedValue([aucklandGeoRaw]);

    registerDiscoveryTools(mockServer as never, ctx);
});

afterEach(() => {
    vi.unstubAllGlobals();
});
// ---------------------------------------------------------------------------
// registration surface
// ---------------------------------------------------------------------------
describe("registerDiscoveryTools", () => {
    it("registers exactly the five discovery tools", () => {
        expect(Object.keys(handlers).sort()).toEqual([
            "describe_tool",
            "get_globe_context",
            "investigate_area",
            "list_available_plugins",
            "orient",
        ]);
    });

    it("gives every tool a description carrying an Example line", () => {
        for (const name of Object.keys(schemas)) {
            expect(schemas[name].description.length, name).toBeGreaterThan(0);
            expect(schemas[name].description, name).toContain("Example:");
        }
    });

    it("names query_entities and never the removed v1 finders", () => {
        const all = Object.values(schemas).map((s) => s.description).join(" ");
        expect(all).toContain("query_entities");
        for (const gone of ["search_entities", "get_entities_in_region", "find_nearby_entities", "fly_to", "save_favorite"]) {
            expect(all, gone).not.toContain(gone);
        }
    });
});

// ---------------------------------------------------------------------------
// list_available_plugins (legacy)
// ---------------------------------------------------------------------------
describe("list_available_plugins", () => {
    it("returns plugin list with counts and entityTypes when streaming", async () => {
        mockGetAllSnapshots.mockResolvedValue([snapshot("flights", 2)]);

        const parsed = envelopeOf(await handlers["list_available_plugins"]({}));
        const plugins = parsed.data?.plugins as Array<{
            pluginId: string;
            entityCount: number;
            entityTypes: string[];
        }>;

        expect(parsed.ok).toBe(true);
        expect(plugins).toHaveLength(1);
        expect(plugins[0].pluginId).toBe("flights");
        expect(plugins[0].entityCount).toBe(2);
        expect(plugins[0].entityTypes).toContain("status");
        expect(parsed.meta?.count).toBe(1);
    });

    it("reports engine_unreachable as an empty SUCCESS, never an error (TOOL-05)", async () => {
        // Nothing is streaming and the engine probe cannot connect. The probe is
        // stubbed rather than left to the real network: this assertion used to
        // depend on no data engine being up on localhost, so starting one broke it.
        mockGetAllSnapshots.mockResolvedValue([]);
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

        const result = await handlers["list_available_plugins"]({});
        const parsed = envelopeOf(result);

        expect(isErrorResult(result)).toBe(false);
        expect(parsed.ok).toBe(true);
        expect(parsed.data?.plugins).toEqual([]);
        expect(parsed.meta?.emptyReason).toBe("engine_unreachable");
        expect(String(parsed.meta?.hint)).toMatch(/outage/i);
    });

    it("maps an unreachable engine to its own reason, never to a data condition", async () => {
        mockGetAllSnapshots.mockResolvedValue([]);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

        const parsed = envelopeOf(await handlers["orient"]({}));

        expect(parsed.ok).toBe(true);
        expect(parsed.meta?.emptyReason).toBe("engine_unreachable");
        expect(String(parsed.meta?.hint)).toMatch(/outage/i);
    });

    it("reports an idle engine as plugin_not_streaming -- a different reason", async () => {
        mockGetAllSnapshots.mockResolvedValue([]);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

        const parsed = envelopeOf(await handlers["list_available_plugins"]({}));

        expect(parsed.ok).toBe(true);
        expect(parsed.meta?.emptyReason).toBe("plugin_not_streaming");
        expect(String(parsed.meta?.hint)).toMatch(/NOT an outage/i);
    });
});

// ---------------------------------------------------------------------------
// get_globe_context (legacy)
// ---------------------------------------------------------------------------
describe("get_globe_context", () => {
    it("returns sessionCount:0 + camera:null + the filter caveat when no session", async () => {
        const parsed = envelopeOf(await handlers["get_globe_context"]({}));
        const filters = parsed.data?.filters as { note: string };

        expect(parsed.ok).toBe(true);
        expect(parsed.data?.sessionCount).toBe(0);
        expect(parsed.data?.camera).toBeNull();
        expect(parsed.data?.layers).toEqual({});
        expect(filters.note).toBeTruthy();
        expect(parsed.meta?.emptyReason).toBe("engine_unreachable");
    });

    it("returns sessionCount + camera + layers when a session is active", async () => {
        mockReadActiveSessions.mockResolvedValue([{ sessionId: "sess-1", lastSeen: Date.now() }]);
        mockGetAllSnapshots.mockResolvedValue([snapshot("maritime")]);
        mockReadGlobeState.mockResolvedValue({
            viewport: { lat: -36.8, lon: 174.7, altitude: 500000, heading: 0, pitch: -45, roll: 0 },
            layers: { maritime: { enabled: true } as never },
            timeline: {
                currentTime: "2026-01-01T00:00:00Z",
                timeWindow: "1h",
                isPlaybackMode: false,
                playbackTime: 0,
                playbackSpeed: 1,
            },
            selectedEntity: null,
            lastUpdate: Date.now(),
        });
        mockReadSessionCatalog.mockResolvedValue({ tools: [], capabilities: [] });

        const parsed = envelopeOf(await handlers["get_globe_context"]({}));
        const camera = parsed.data?.camera as { lat: number } | null;

        expect(parsed.data?.sessionCount).toBe(1);
        expect(camera?.lat).toBeCloseTo(-36.8);
        expect(parsed.data?.layers).toHaveProperty("maritime");
    });
});

// ---------------------------------------------------------------------------
// service failures -- every data tool answers on the envelope, never by throwing
// ---------------------------------------------------------------------------
describe("discovery tools -- unexpected service failures", () => {
    it("orient fails with internal_error when the session store is unavailable", async () => {
        mockGetAllSnapshots.mockResolvedValue([]);
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
        mockResolveActiveSessionId.mockRejectedValue(new Error("redis down"));

        const result = await handlers["orient"]({});
        const parsed = envelopeOf(result);

        expect(isErrorResult(result)).toBe(true);
        expect(parsed.ok).toBe(false);
        expect(parsed.error).toBe("internal_error");
        expect(parsed.message).toContain("orient");
        expect(parsed.hint).toContain("engine");
    });

    it("list_available_plugins fails with engine_unreachable when the snapshot read throws", async () => {
        mockGetAllSnapshots.mockRejectedValue(new Error("ECONNREFUSED"));

        const result = await handlers["list_available_plugins"]({});
        const parsed = envelopeOf(result);

        expect(isErrorResult(result)).toBe(true);
        expect(parsed.error).toBe("engine_unreachable");
        expect(parsed.message).toContain("streaming plugin list");
    });

    it("get_globe_context fails with engine_unreachable when the globe state read throws", async () => {
        mockReadActiveSessions.mockResolvedValue([{ sessionId: "sess-1", lastSeen: Date.now() }]);
        mockReadGlobeState.mockRejectedValue(new Error("redis down"));

        const result = await handlers["get_globe_context"]({});
        const parsed = envelopeOf(result);

        expect(isErrorResult(result)).toBe(true);
        expect(parsed.error).toBe("engine_unreachable");
        expect(parsed.message).toContain("globe context");
    });

    it("investigate_area fails with internal_error when the region query throws", async () => {
        mockGetAllSnapshots.mockResolvedValue([snapshot("flights")]);
        mockGetEntitiesInRegion.mockRejectedValue(new Error("engine exploded"));

        const result = await handlers["investigate_area"]({
            place_name: "Auckland",
            entity_type: "flights",
        });
        const parsed = envelopeOf(result);

        expect(isErrorResult(result)).toBe(true);
        expect(parsed.error).toBe("internal_error");
        expect(parsed.message).toContain("investigate_area");
    });
});

// ---------------------------------------------------------------------------
// investigate_area
// ---------------------------------------------------------------------------
describe("investigate_area", () => {
    it("happy path: entities + summary + count, and pans the camera", async () => {
        mockGetAllSnapshots.mockResolvedValue([snapshot("flights")]);
        mockGetEntitiesInRegion.mockResolvedValue({
            entities: [
                { id: "f1", pluginId: "flights", latitude: -36.8, longitude: 174.7 },
                { id: "f2", pluginId: "flights", latitude: -36.9, longitude: 174.6 },
            ],
        });
        mockResolveActiveSessionId.mockResolvedValue("sess-1");

        const parsed = envelopeOf(
            await handlers["investigate_area"]({ place_name: "Auckland", entity_type: "flights" }),
        );

        expect(parsed.ok).toBe(true);
        expect(parsed.data?.entities).toHaveLength(2);
        expect(parsed.meta?.count).toBe(2);
        expect(String(parsed.data?.summary)).toContain("2");
        expect(mockEnqueueGlobeCommand).toHaveBeenCalledWith(
            "user-test-1",
            "sess-1",
            expect.objectContaining({ type: "pan" }),
        );
    });

    it("no matching plugin: empty SUCCESS naming the live plugins to retry with", async () => {
        mockGetAllSnapshots.mockResolvedValue([snapshot("maritime")]);

        const parsed = envelopeOf(
            await handlers["investigate_area"]({ place_name: "Auckland", entity_type: "submarines" }),
        );

        expect(parsed.ok).toBe(true);
        expect(parsed.data?.entities).toEqual([]);
        expect(parsed.data?.availablePlugins).toEqual(["maritime"]);
        expect(parsed.meta?.emptyReason).toBe("plugin_not_streaming");
        expect(String(parsed.meta?.hint)).toContain("orient");
        expect(String(parsed.data?.summary)).toContain("submarines");
        expect(mockEnqueueGlobeCommand).not.toHaveBeenCalled();
    });

    it("live plugin, empty region: empty SUCCESS with no_data_matches", async () => {
        mockGetAllSnapshots.mockResolvedValue([snapshot("flights")]);
        mockGetEntitiesInRegion.mockResolvedValue({ entities: [], emptyReason: "no_data_matches" });
        mockResolveActiveSessionId.mockResolvedValue("sess-1");

        const parsed = envelopeOf(
            await handlers["investigate_area"]({ place_name: "Auckland", entity_type: "flights" }),
        );

        expect(parsed.ok).toBe(true);
        expect(parsed.data?.entities).toEqual([]);
        expect(parsed.meta?.emptyReason).toBe("no_data_matches");
        expect(String(parsed.data?.summary).length).toBeGreaterThan(0);
    });

    it("no session: returns entities, skips the pan, and says so", async () => {
        mockGetAllSnapshots.mockResolvedValue([snapshot("flights")]);
        mockGetEntitiesInRegion.mockResolvedValue({
            entities: [{ id: "f1", pluginId: "flights", latitude: -36.8, longitude: 174.7 }],
        });
        mockResolveActiveSessionId.mockResolvedValue(null);

        const parsed = envelopeOf(
            await handlers["investigate_area"]({ place_name: "Auckland", entity_type: "flights" }),
        );

        expect(parsed.data?.entities).toHaveLength(1);
        expect(mockEnqueueGlobeCommand).not.toHaveBeenCalled();
        expect(String(parsed.data?.summary)).toContain("camera pan skipped");
    });

    it("geocode failure: fails with not_found and a retry hint", async () => {
        mockFetchGeocode.mockResolvedValue([]);

        const result = await handlers["investigate_area"]({
            place_name: "ZZZ_NONEXISTENT",
            entity_type: "flights",
        });
        const parsed = envelopeOf(result);

        expect(isErrorResult(result)).toBe(true);
        expect(parsed.ok).toBe(false);
        expect(parsed.error).toBe("not_found");
        expect(parsed.message).toContain("ZZZ_NONEXISTENT");
        expect(parsed.hint).toContain("geocode_location");
    });

    it("caps at 200 entities and reports totalMatched in meta (TOOL-04)", async () => {
        const makeEntities = (pluginId: string, count: number) =>
            Array.from({ length: count }, (_, i) => ({
                id: pluginId + "-" + i,
                pluginId,
                latitude: 0,
                longitude: 0,
            }));

        mockGetAllSnapshots.mockResolvedValue([snapshot("vessel-ais"), snapshot("vessel-cargo")]);
        mockGetEntitiesInRegion
            .mockResolvedValueOnce({ entities: makeEntities("vessel-ais", 110) })
            .mockResolvedValueOnce({ entities: makeEntities("vessel-cargo", 110) });

        const parsed = envelopeOf(
            await handlers["investigate_area"]({ place_name: "Auckland", entity_type: "vessel" }),
        );

        expect(parsed.data?.entities).toHaveLength(200);
        expect(parsed.meta?.count).toBe(200);
        expect(parsed.meta?.truncated).toBe(true);
        expect(parsed.meta?.totalMatched).toBe(220);
    });
});
