import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/data-query/service");
vi.mock("@/lib/globeStateStore");
vi.mock("@/lib/mcpSessionCatalog");
vi.mock("@/lib/globeCommandQueue");
vi.mock("@/lib/data-query/localSources");

import { getAllPluginSnapshots } from "@/lib/data-query/service";
import { readActiveSessions, readGlobeState } from "@/lib/globeStateStore";
import { readSessionCatalog } from "@/lib/mcpSessionCatalog";
import { resolveActiveSessionId } from "@/lib/globeCommandQueue";
import { getLocalSourceIds } from "@/lib/data-query/localSources";

import {
    radiusKmToBbox,
    deriveEntityTypes,
    listStreamingPlugins,
    buildInvestigateProse,
    composeGlobeContext,
} from "./discoveryHelpers";

import type { PluginDataSnapshot } from "@/lib/data-query/types";

const mockGetAllSnapshots = vi.mocked(getAllPluginSnapshots);
const mockReadActiveSessions = vi.mocked(readActiveSessions);
const mockReadGlobeState = vi.mocked(readGlobeState);
const mockReadSessionCatalog = vi.mocked(readSessionCatalog);
const mockGetLocalSourceIds = vi.mocked(getLocalSourceIds);

// resolveActiveSessionId is re-exported from discoveryHelpers but not called
// directly in these tests; mocked to avoid ioredis errors.
vi.mocked(resolveActiveSessionId).mockResolvedValue(null);

beforeEach(() => {
    vi.clearAllMocks();
    // Default: engine probe cannot connect. Stubbed, never left to the real
    // network: with a live data engine on this machine the probe would succeed
    // and every outage assertion below would read "no_active_plugins" instead.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    // Default: no local sources; individual tests override as needed.
    mockGetLocalSourceIds.mockResolvedValue(new Set<string>());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// radiusKmToBbox
// ---------------------------------------------------------------------------
describe("radiusKmToBbox", () => {
    it("produces correct bbox at mid-latitude (lat=45, lon=0, radius=111km)", () => {
        const bbox = radiusKmToBbox(45, 0, 111);
        // lat delta = 111/111 = 1 degree
        expect(bbox.north).toBeCloseTo(46, 4);
        expect(bbox.south).toBeCloseTo(44, 4);
        // lon delta = 111 / (111 * cos(45deg)) ~ 1/cos(45) ~ 1.414
        const expectedLonDelta = 1 / Math.cos((45 * Math.PI) / 180);
        expect(bbox.east).toBeCloseTo(expectedLonDelta, 2);
        expect(bbox.west).toBeCloseTo(-expectedLonDelta, 2);
    });

    it("clamps longitude delta near the poles (lat=89.9)", () => {
        // cos(89.9 deg) is nearly 0 -- guard prevents division explosion
        const bbox = radiusKmToBbox(89.9, 0, 50);
        // lon delta should be capped (cos clamped to 0.01)
        const maxLonDelta = 50 / (111 * 0.01);
        expect(bbox.east - bbox.west).toBeLessThanOrEqual(maxLonDelta * 2 + 0.001);
    });

    it("clamps north to 90 and south to -90 at poles", () => {
        const bbox = radiusKmToBbox(89, 0, 500);
        expect(bbox.north).toBeLessThanOrEqual(90);
        const bbox2 = radiusKmToBbox(-89, 0, 500);
        expect(bbox2.south).toBeGreaterThanOrEqual(-90);
    });

    it("returns correct bbox at equator (lat=0)", () => {
        const bbox = radiusKmToBbox(0, 10, 111);
        expect(bbox.north).toBeCloseTo(1, 4);
        expect(bbox.south).toBeCloseTo(-1, 4);
        // cos(0) = 1 so lon delta ~ 1
        expect(bbox.east).toBeCloseTo(11, 1);
        expect(bbox.west).toBeCloseTo(9, 1);
    });

    it("globe-spanning radius (30000 km) produces full-longitude box, not antimeridian strip", () => {
        // Without the lonDelta cap a 30000 km radius produces lonDelta >> 180,
        // and wrapLon(lon + lonDelta) collapses to a tiny strip near the antimeridian.
        // With the cap, lonDelta = 180, so east and west both map to the antimeridian
        // (+180 and -180 are the same line). The key invariant is that the longitude
        // span equals 360 degrees (east - west mod 360 = 0 = full globe).
        const bbox = radiusKmToBbox(0, 0, 30000);
        // Both east and west land on the antimeridian (180 = -180 in wrapped coords).
        const normalise = (v: number) => Math.abs(Math.abs(v) - 180);
        expect(normalise(bbox.east)).toBeCloseTo(0, 4);
        expect(normalise(bbox.west)).toBeCloseTo(0, 4);
        expect(bbox.north).toBeCloseTo(90, 0);
        expect(bbox.south).toBeCloseTo(-90, 0);
    });
});

// ---------------------------------------------------------------------------
// deriveEntityTypes
// ---------------------------------------------------------------------------
describe("deriveEntityTypes", () => {
    const snapshot: PluginDataSnapshot = {
        pluginId: "flights",
        entities: [
            {
                id: "e1",
                pluginId: "flights",
                latitude: 0,
                longitude: 0,
                timestamp: new Date(),
                properties: { status: "airborne", airline: "NZ" },
            },
            {
                id: "e2",
                pluginId: "flights",
                latitude: 1,
                longitude: 1,
                timestamp: new Date(),
                properties: { status: "landed", altitude: 0 },
            },
        ],
        timestamp: new Date(),
    };

    it("returns filterDef ids when filterDefs provided", () => {
        const defs = [
            { id: "status", label: "Status", type: "select" as const, propertyKey: "status", options: [] },
        ];
        const result = deriveEntityTypes(snapshot, defs);
        expect(result).toEqual(["status"]);
    });

    it("falls back to distinct properties keys when no filterDefs", () => {
        const result = deriveEntityTypes(snapshot);
        expect(result).toContain("status");
        expect(result).toContain("airline");
        expect(result).toContain("altitude");
    });

    it("returns empty array for snapshot with no entities", () => {
        const empty: PluginDataSnapshot = { pluginId: "x", entities: [], timestamp: new Date() };
        expect(deriveEntityTypes(empty)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// listStreamingPlugins
// ---------------------------------------------------------------------------
describe("listStreamingPlugins", () => {
    it("returns plugins with counts when snapshots present", async () => {
        mockGetAllSnapshots.mockResolvedValue([
            {
                pluginId: "flights",
                entities: [
                    { id: "e1", pluginId: "flights", latitude: 0, longitude: 0, timestamp: new Date(), properties: {} },
                ],
                timestamp: new Date(),
            },
        ]);
        const result = await listStreamingPlugins();
        expect(result.reason).toBeUndefined();
        expect(result.plugins).toHaveLength(1);
        expect(result.plugins[0].pluginId).toBe("flights");
        expect(result.plugins[0].entityCount).toBe(1);
    });

    it("returns { plugins: [], reason: 'engine_unreachable' } when no snapshots and engine not reachable (TOOL-05)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
        mockGetAllSnapshots.mockResolvedValue([]);
        const result = await listStreamingPlugins();
        expect(result.plugins).toHaveLength(0);
        expect(result.reason).toBe("engine_unreachable");
    });

    it("returns no_active_plugins when engine reachable but zero snapshots (TOOL-05)", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(JSON.stringify({ plugins: [] }), { status: 200 })),
        );
        mockGetAllSnapshots.mockResolvedValue([]);
        const result = await listStreamingPlugins();
        expect(result.plugins).toHaveLength(0);
        expect(result.reason).toBe("no_active_plugins");
    });

    it("fails the call rather than inventing a reason when the snapshot read throws", async () => {
        mockGetAllSnapshots.mockRejectedValue(new Error("ECONNREFUSED"));

        await expect(listStreamingPlugins()).rejects.toThrow("ECONNREFUSED");
    });
});

// ---------------------------------------------------------------------------
// buildInvestigateProse
// ---------------------------------------------------------------------------
describe("buildInvestigateProse", () => {
    it("happy path: returns count + camera panned text when session present", () => {
        const prose = buildInvestigateProse({
            displayName: "Auckland, NZ",
            entityType: "flights",
            matchedPlugin: "flights",
            entityCount: 5,
            sessionPresent: true,
        });
        expect(prose.length).toBeGreaterThan(0);
        expect(prose).toContain("5");
        expect(prose).toContain("Auckland");
        expect(prose).toContain("Camera has been panned");
    });

    it("happy path: notes skipped camera when no session", () => {
        const prose = buildInvestigateProse({
            displayName: "Auckland, NZ",
            entityType: "flights",
            matchedPlugin: "flights",
            entityCount: 3,
            sessionPresent: false,
        });
        expect(prose).toContain("camera pan skipped");
    });

    it("untyped cold start with nothing streaming: explains the scan found nothing", () => {
        const prose = buildInvestigateProse({
            displayName: "Auckland",
            matchedPlugin: null,
            entityCount: 0,
            sessionPresent: false,
        });
        expect(prose).toContain("nothing could be scanned near Auckland");
        expect(prose).not.toContain('""');
    });

    it("untyped scan finds entities: prose names every scanned layer", () => {
        const prose = buildInvestigateProse({
            displayName: "Auckland",
            matchedPlugin: "flights",
            scannedPluginIds: ["flights", "maritime"],
            entityCount: 3,
            sessionPresent: false,
        });
        expect(prose).toContain("Found 3 entities near Auckland");
        expect(prose).toContain("streaming layers: flights, maritime");
    });

    it("no-matching-plugin: explains entity_type not found", () => {
        const prose = buildInvestigateProse({
            displayName: "Auckland, NZ",
            entityType: "submarines",
            matchedPlugin: null,
            entityCount: 0,
            sessionPresent: false,
        });
        expect(prose).toContain("submarines");
        expect(prose).toContain("list_available_plugins");
    });

    it("no-data-matches: explains empty region result", () => {
        const prose = buildInvestigateProse({
            displayName: "Auckland, NZ",
            entityType: "flights",
            matchedPlugin: "flights",
            entityCount: 0,
            sessionPresent: true,
            emptyReason: "no_data_matches",
        });
        expect(prose.length).toBeGreaterThan(0);
        expect(prose).toContain("no");
    });
});

// ---------------------------------------------------------------------------
// listStreamingPlugins -- source tagging (Plan 30-04, D-05)
// ---------------------------------------------------------------------------
describe("listStreamingPlugins -- source tagging", () => {
    const makeSnap = (pluginId: string, entityCount: number) => ({
        pluginId,
        entities: Array.from({ length: entityCount }, (_, i) => ({
            id: `${pluginId}-e${i}`,
            pluginId,
            latitude: 0,
            longitude: 0,
            timestamp: new Date(),
            properties: {},
        })),
        timestamp: new Date(),
    });

    it("tags engine plugin as source:'engine' and local plugin as source:'local'", async () => {
        mockGetAllSnapshots.mockResolvedValue([
            makeSnap("aviation", 3),
            makeSnap("camera", 5),
        ]);
        mockGetLocalSourceIds.mockResolvedValue(new Set(["camera"]));

        const result = await listStreamingPlugins();

        expect(result.reason).toBeUndefined();
        expect(result.plugins).toHaveLength(2);

        const aviation = result.plugins.find((p) => p.pluginId === "aviation");
        expect(aviation?.source).toBe("engine");

        const camera = result.plugins.find((p) => p.pluginId === "camera");
        expect(camera?.source).toBe("local");
        expect(camera?.entityCount).toBeGreaterThan(0);
    });

    it("tags by id: only the id present in localIds receives source:'local'", async () => {
        mockGetAllSnapshots.mockResolvedValue([
            makeSnap("flights", 10),
            makeSnap("ships", 4),
            makeSnap("camera", 2),
        ]);
        mockGetLocalSourceIds.mockResolvedValue(new Set(["camera"]));

        const result = await listStreamingPlugins();

        const byId = Object.fromEntries(result.plugins.map((p) => [p.pluginId, p.source]));
        expect(byId["flights"]).toBe("engine");
        expect(byId["ships"]).toBe("engine");
        expect(byId["camera"]).toBe("local");
    });

    it("engine-unreachable passthrough: empty snapshots returns engine_unreachable when probe fails (TOOL-05)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
        mockGetAllSnapshots.mockResolvedValue([]);
        mockGetLocalSourceIds.mockResolvedValue(new Set(["camera"]));

        const result = await listStreamingPlugins();

        expect(result.plugins).toHaveLength(0);
        expect(result.reason).toBe("engine_unreachable");
    });
});

// ---------------------------------------------------------------------------
// composeGlobeContext
// ---------------------------------------------------------------------------
describe("composeGlobeContext", () => {
    it("returns sessionCount:0 + camera:null when no sessions", async () => {
        mockReadActiveSessions.mockResolvedValue([]);
        mockGetAllSnapshots.mockResolvedValue([]);

        const ctx = await composeGlobeContext("u1");
        expect(ctx.sessionCount).toBe(0);
        expect(ctx.camera).toBeNull();
        expect(ctx.layers).toEqual({});
    });

    it("returns camera + layers when session active", async () => {
        mockReadActiveSessions.mockResolvedValue([{ sessionId: "s1", lastSeen: Date.now() }]);
        mockGetAllSnapshots.mockResolvedValue([]);
        mockReadGlobeState.mockResolvedValue({
            viewport: { lat: -36.8, lon: 174.7, altitude: 500000, heading: 0, pitch: -45, roll: 0 },
            layers: { flights: { enabled: true } as never },
            timeline: { currentTime: "2026-01-01T00:00:00Z", timeWindow: "1h", isPlaybackMode: false, playbackTime: 0, playbackSpeed: 1 },
            selectedEntity: null,
            lastUpdate: Date.now(),
        });
        mockReadSessionCatalog.mockResolvedValue({ tools: [], capabilities: [] });

        const ctx = await composeGlobeContext("u1");
        expect(ctx.sessionCount).toBe(1);
        expect(ctx.camera).not.toBeNull();
        expect(ctx.camera?.lat).toBeCloseTo(-36.8);
        expect(ctx.layers).toHaveProperty("flights");
    });
});
