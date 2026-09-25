/**
 * get_entity_details + get_plugin_data tests (v2 AX overhaul).
 *
 * These are the id-addressed lookups. What matters to an agent is the same
 * three-way discrimination on every miss: an unknown pluginId is a FAILURE that
 * carries the valid vocabulary, an engine outage is a FAILURE, and a genuinely
 * empty-but-live layer is an empty SUCCESS carrying the service's own reason --
 * never a reason this server invented.
 *
 * Split from ./tools.test.ts (same harness) so neither file outgrows the repo's
 * file-size rule.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import type { SearchResult } from "@/lib/data-query/types";

vi.mock("@/lib/data-query/service");
vi.mock("@/lib/globeStateStore");
vi.mock("@/lib/mcpSessionCatalog");
vi.mock("@/lib/globeCommandQueue");
vi.mock("@/app/api/mcp/discoveryHelpers", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/app/api/mcp/discoveryHelpers")>();
    return { ...actual, listStreamingPlugins: vi.fn() };
});

import { registerDataQueryTools } from "./tools";
import {
    getEntitiesInRegion,
    getEntityDetails,
    getPluginData,
    searchEntities,
} from "@/lib/data-query/service";
import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";

const mockRegion = vi.mocked(getEntitiesInRegion);
const mockDetails = vi.mocked(getEntityDetails);
const mockPluginData = vi.mocked(getPluginData);
const mockSearch = vi.mocked(searchEntities);
const mockPlugins = vi.mocked(listStreamingPlugins);

const schemas: Record<string, unknown> = {};
const handlers: Record<string, (args: unknown) => Promise<unknown>> = {};
const mockServer = {
    registerTool: vi.fn(
        (name: string, schema: unknown, handler: (args: unknown) => Promise<unknown>) => {
            schemas[name] = schema;
            handlers[name] = handler;
        },
    ),
};

interface Envelope {
    ok: boolean;
    data?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    error?: string;
    message?: string;
    hint?: string;
    validValues?: string[];
}

/** Reads the v2 envelope off a tool result's text block. */
function envelope(result: unknown): Envelope {
    const typed = result as { content: [{ text: string }] };
    return JSON.parse(typed.content[0].text) as Envelope;
}

function call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    return handlers[name](args);
}

function hit(id: string, pluginId: string, lat: number, lon: number, name = id): SearchResult {
    return { id, pluginId, name, latitude: lat, longitude: lon };
}

/** Default happy-path mocks; each test overrides only what it is about. */
function resetHarness(): void {
    vi.clearAllMocks();
    Object.keys(schemas).forEach((key) => delete schemas[key]);
    Object.keys(handlers).forEach((key) => delete handlers[key]);

    mockRegion.mockResolvedValue({ entities: [] });
    mockSearch.mockResolvedValue({ entities: [] });
    mockDetails.mockResolvedValue({ data: null, emptyReason: "no_data_matches" });
    mockPluginData.mockResolvedValue({ data: null, emptyReason: "plugin_not_streaming" });
    mockPlugins.mockResolvedValue({
        plugins: [
            { pluginId: "flights", pluginName: "flights", entityCount: 3, entityTypes: [], source: "engine" },
            { pluginId: "maritime", pluginName: "maritime", entityCount: 1, entityTypes: [], source: "engine" },
        ],
    });

    registerDataQueryTools(
        mockServer as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
        { userId: "u1" },
    );
}

const LONDON = { lat: 51.5074, lon: -0.1278 };
const CAPTURED = new Date("2026-09-25T10:00:00Z");

/** A full entity record: every field get_entity_details can project. */
const DETAIL = {
    id: "BA123",
    pluginId: "flights",
    latitude: LONDON.lat,
    longitude: LONDON.lon,
    altitude: 10668,
    heading: 270,
    timestamp: CAPTURED,
    label: "BA123",
    properties: { iconUrl: "plane.png" },
};

function geoEntity(id: string): GeoEntity {
    return {
        id,
        pluginId: "flights",
        latitude: LONDON.lat,
        longitude: LONDON.lon,
        timestamp: CAPTURED,
        properties: { iconUrl: "plane.png", size: 8 },
    };
}

beforeEach(resetHarness);

describe("get_entity_details", () => {
    it("returns the projected record and reports fields it could not honour", async () => {
        mockDetails.mockResolvedValue({ data: DETAIL });

        const body = envelope(
            await call("get_entity_details", {
                pluginId: "flights",
                entityId: "BA123",
                fields: ["id", "altitude", "nope"],
            }),
        );

        expect(body.ok).toBe(true);
        expect(body.data?.entity).toEqual({ id: "BA123", altitude: 10668 });
        expect(body.meta?.unknownFields).toEqual(["nope"]);
    });

    it("returns unknown_plugin with ONLY the valid plugin ids, and does not throw", async () => {
        mockDetails.mockResolvedValue({ data: null, emptyReason: "plugin_not_streaming" });

        const body = envelope(
            await call("get_entity_details", { pluginId: "flightz", entityId: "BA123" }),
        );

        expect(body.ok).toBe(false);
        expect(body.error).toBe("unknown_plugin");
        expect(body.validValues).toEqual(["flights", "maritime"]);
        expect(body.message).toMatch(/flightz/);
    });

    it("says so plainly when nothing is streaming at all", async () => {
        mockDetails.mockResolvedValue({ data: null, emptyReason: "plugin_not_streaming" });
        mockPlugins.mockResolvedValue({ plugins: [] });

        const body = envelope(
            await call("get_entity_details", { pluginId: "flights", entityId: "BA123" }),
        );

        expect(body.error).toBe("unknown_plugin");
        // The envelope omits an empty validValues list rather than sending [].
        expect(body.validValues).toBeUndefined();
        expect(body.hint).toMatch(/no plugins are currently streaming/i);
    });

    it("reports a known-but-offline layer as an empty success, never as no_session_active", async () => {
        mockDetails.mockResolvedValue({ data: null, emptyReason: "plugin_not_streaming" });

        const body = envelope(
            await call("get_entity_details", { pluginId: "flights", entityId: "BA123" }),
        );

        expect(body.ok).toBe(true);
        expect(body.data?.entity).toBeNull();
        expect(body.meta?.emptyReason).toBe("plugin_not_streaming");
        expect(body.meta?.emptyReason).not.toBe("no_session_active");
        expect(body.meta?.emptyReason).not.toBe("no_data_matches");
    });

    it("resolves a missing reason to unknown here too", async () => {
        mockDetails.mockResolvedValue({ data: null });

        const body = envelope(
            await call("get_entity_details", { pluginId: "flights", entityId: "BA123" }),
        );

        expect(body.meta?.emptyReason).toBe("unknown");
        expect(body.meta?.emptyReason).not.toBe("no_data_matches");
    });

    it("reports an engine outage as engine_unreachable", async () => {
        mockDetails.mockResolvedValue({ data: null, emptyReason: "plugin_not_streaming" });
        mockPlugins.mockResolvedValue({ plugins: [], reason: "engine_unreachable" });

        const body = envelope(
            await call("get_entity_details", { pluginId: "flights", entityId: "BA123" }),
        );

        expect(body.ok).toBe(false);
        expect(body.error).toBe("engine_unreachable");
        expect(body.hint).toMatch(/outage/i);
    });
});

describe("get_plugin_data", () => {
    it("caps at 200 and reports capturedAt plus truncation", async () => {
        mockPluginData.mockResolvedValue({
            data: {
                pluginId: "flights",
                entities: Array.from({ length: 250 }, (_, index) => geoEntity(`E${index}`)),
                timestamp: CAPTURED,
            },
        });

        const body = envelope(await call("get_plugin_data", { pluginId: "flights" }));

        expect(body.data?.entities).toHaveLength(200);
        expect(body.meta).toMatchObject({
            count: 200,
            truncated: true,
            totalMatched: 250,
            capturedAt: "2026-09-25T10:00:00.000Z",
        });
    });

    it("honours a smaller limit and projects each entity", async () => {
        mockPluginData.mockResolvedValue({
            data: { pluginId: "flights", entities: [geoEntity("E1")], timestamp: CAPTURED },
        });

        const body = envelope(
            await call("get_plugin_data", {
                pluginId: "flights",
                limit: 5,
                fields: ["id", "iconUrl"],
            }),
        );

        expect(body.ok).toBe(true);
        expect(body.data?.entities).toEqual([{ id: "E1" }]);
        expect(body.meta?.unknownFields).toEqual(["iconUrl"]);
        expect(body.meta?.truncated).toBeUndefined();
    });

    it("keeps the service reason for a known but empty layer", async () => {
        mockPluginData.mockResolvedValue({
            data: { pluginId: "flights", entities: [], timestamp: CAPTURED },
            emptyReason: "plugin_not_streaming",
        });

        const body = envelope(await call("get_plugin_data", { pluginId: "flights" }));

        expect(body.ok).toBe(true);
        expect(body.meta?.emptyReason).toBe("plugin_not_streaming");
        expect(body.meta?.capturedAt).toBe("2026-09-25T10:00:00.000Z");
    });

    it("returns unknown_plugin for a layer that is not streaming", async () => {
        const body = envelope(await call("get_plugin_data", { pluginId: "nope" }));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("unknown_plugin");
        expect(body.validValues).toEqual(["flights", "maritime"]);
    });
});

describe("envelope discipline", () => {
    it("never returns a bare { error } or { success: false } shape", async () => {
        const results = [
            await call("query_entities", {}),
            await call("query_entities", { query: "flight" }),
            await call("get_entity_details", { pluginId: "nope", entityId: "x" }),
            await call("get_plugin_data", { pluginId: "nope" }),
        ];

        for (const result of results) {
            const body = envelope(result);
            expect(typeof body.ok).toBe("boolean");
            expect(body).not.toHaveProperty("success");
            if (body.ok) {
                expect(body.data).toBeDefined();
            } else {
                expect(body.error).toBeTruthy();
                expect(body.message).toBeTruthy();
            }
        }
    });
});
