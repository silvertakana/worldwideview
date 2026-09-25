/**
 * query_entities + registration tests (v2 AX overhaul).
 *
 * The v1 defect this file guards: five overlapping finders, contradictory error
 * shapes, and an empty reason that defaulted to "no_data_matches", so an outage
 * read to the agent as "nothing matched here". Every assertion below is about the
 * agent-facing answer: which tool exists, what the payload is, and what an empty
 * result actually says.
 *
 * The id-addressed tools (get_entity_details, get_plugin_data) are covered in
 * ./entityLookupTools.test.ts -- same harness, so neither file outgrows the
 * repo's file-size rule.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SearchResult } from "@/lib/data-query/types";

vi.mock("@/lib/data-query/service");
vi.mock("@/lib/globeStateStore");
vi.mock("@/lib/mcpSessionCatalog");
vi.mock("@/lib/globeCommandQueue");
vi.mock("@/app/api/mcp/discoveryHelpers", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/app/api/mcp/discoveryHelpers")>();
    return { ...actual, listStreamingPlugins: vi.fn() };
});
vi.mock("@/lib/mcp/proximitySearch", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/mcp/proximitySearch")>();
    return { ...actual, filterEntityIdsByProperty: vi.fn() };
});

import { registerDataQueryTools } from "./tools";
import {
    getEntitiesInRegion,
    getEntityDetails,
    getPluginData,
    searchEntities,
} from "@/lib/data-query/service";
import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";
import { filterEntityIdsByProperty } from "@/lib/mcp/proximitySearch";

const mockRegion = vi.mocked(getEntitiesInRegion);
// query_entities' inline filters intersect a layer's region results with its
// snapshot's matching ids; the snapshot read is not what these tests are about.
const mockFilterIds = vi.mocked(filterEntityIdsByProperty);
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
    // Snapshot intersection for query_entities' inline filters. Default: every
    // fixture entity matches; each test narrows it.
    mockFilterIds.mockResolvedValue(new Set(["BA1", "AF1", "DH1", "MA1"]));
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

// Real WGS84 coordinates with known great-circle distances from London.
const LONDON = { lat: 51.5074, lon: -0.1278 };
const PARIS = { lat: 48.8566, lon: 2.3522 };
const BERLIN = { lat: 52.52, lon: 13.405 };
const BOX = { north: 52, south: 51, east: 1, west: -1 };

beforeEach(resetHarness);

describe("data-query tool registration", () => {
    it("registers exactly query_entities, get_entity_details and get_plugin_data", () => {
        expect(Object.keys(handlers).sort()).toEqual([
            "get_entity_details",
            "get_plugin_data",
            "query_entities",
        ]);
    });

    it("does not register the deleted v1 finder names", () => {
        for (const gone of ["search_entities", "get_entities_in_region", "find_nearby_entities"]) {
            expect(handlers[gone]).toBeUndefined();
        }
    });
});

describe("query_entities -- mode routing", () => {
    it("fails with invalid_parameters naming the three modes when no mode is given", async () => {
        const body = envelope(await call("query_entities", {}));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("invalid_parameters");
        expect(body.validValues).toEqual(["bbox", "near", "query"]);
        expect(body.hint).toMatch(/bbox/);
        expect(body.hint).toMatch(/near/);
        expect(body.hint).toMatch(/query/);
    });

    it("bbox mode queries the region and reports meta.order unspecified", async () => {
        mockRegion.mockResolvedValue({ entities: [hit("BA1", "flights", LONDON.lat, LONDON.lon)] });

        const body = envelope(await call("query_entities", { bbox: BOX }));

        expect(body.ok).toBe(true);
        expect(body.data?.entities).toHaveLength(1);
        expect(body.meta).toMatchObject({ count: 1, order: "unspecified" });
        expect(mockRegion).toHaveBeenCalledWith({ ...BOX, limit: 50 });
    });

    it("sweeps one call per layer when pluginIds names several layers", async () => {
        mockRegion.mockImplementation(async (bounds) =>
            bounds.pluginId === "flights"
                ? { entities: [hit("BA1", "flights", LONDON.lat, LONDON.lon)] }
                : { entities: [hit("MA1", "maritime", 51.49, -0.1)] },
        );

        const body = envelope(
            await call("query_entities", { bbox: BOX, pluginIds: ["flights", "maritime"] }),
        );

        expect(mockRegion).toHaveBeenCalledTimes(2);
        expect(body.meta?.count).toBe(2);
    });

    it("query-only mode searches by text and caps the limit at the source cap of 100", async () => {
        mockSearch.mockResolvedValue({ entities: [hit("BA1", "flights", LONDON.lat, LONDON.lon)] });

        const body = envelope(await call("query_entities", { query: "flight", limit: 1000 }));

        expect(mockSearch).toHaveBeenCalledWith("flight", undefined, 100, undefined);
        expect(body.ok).toBe(true);
        expect(body.meta?.order).toBe("unspecified");
    });

    it("bbox+query returns only name matches, gathered at the hard cap", async () => {
        mockRegion.mockResolvedValue({
            entities: [
                hit("BA1", "flights", LONDON.lat, LONDON.lon, "BA123"),
                hit("AF1", "flights", PARIS.lat, PARIS.lon, "AF456"),
            ],
        });

        const body = envelope(
            await call("query_entities", { bbox: BOX, query: "ba1", pluginIds: ["flights"] }),
        );

        expect(mockRegion).toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }));
        expect(body.data?.entities).toEqual([
            { id: "BA1", pluginId: "flights", name: "BA123", latitude: LONDON.lat, longitude: LONDON.lon },
        ]);
    });

    it("says no_data_matches when the query empties a result set this call proved live", async () => {
        mockRegion.mockResolvedValue({ entities: [hit("BA1", "flights", LONDON.lat, LONDON.lon)] });

        const body = envelope(
            await call("query_entities", { bbox: BOX, query: "nothing-matches-this" }),
        );

        expect(body.ok).toBe(true);
        expect(body.meta?.emptyReason).toBe("no_data_matches");
    });

    it("clamps the limit to 200", async () => {
        await call("query_entities", { bbox: BOX, limit: 5000 });

        expect(mockRegion).toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }));
    });
});

describe("query_entities -- bbox + filters across several layers", () => {
    const STATUS_FILTER = { status: { type: "select" as const, values: ["airborne"] } };

    it("intersects each layer's region results with its snapshot's matching ids", async () => {
        mockRegion.mockImplementation(async (bounds) =>
            bounds.pluginId === "flights"
                ? {
                      entities: [
                          hit("BA1", "flights", LONDON.lat, LONDON.lon),
                          hit("AF1", "flights", PARIS.lat, PARIS.lon),
                      ],
                  }
                : { entities: [hit("MA1", "maritime", 51.49, -0.1)] },
        );
        mockFilterIds.mockImplementation(async (pluginId: string) =>
            pluginId === "flights" ? new Set(["BA1"]) : new Set<string>(),
        );

        const body = envelope(
            await call("query_entities", {
                bbox: BOX,
                pluginIds: ["flights", "maritime"],
                filters: STATUS_FILTER,
            }),
        );

        expect(mockFilterIds).toHaveBeenCalledWith("flights", STATUS_FILTER);
        expect(mockFilterIds).toHaveBeenCalledWith("maritime", STATUS_FILTER);
        expect(body.data?.entities).toEqual([
            { id: "BA1", pluginId: "flights", name: "BA1", latitude: LONDON.lat, longitude: LONDON.lon },
        ]);
    });

    it("drops a layer whose snapshot cannot be read rather than widening the result", async () => {
        mockRegion.mockImplementation(async (bounds) =>
            bounds.pluginId === "flights"
                ? { entities: [hit("BA1", "flights", LONDON.lat, LONDON.lon)] }
                : { entities: [hit("MA1", "maritime", 51.49, -0.1)] },
        );
        mockFilterIds.mockImplementation(async (pluginId: string) =>
            pluginId === "flights" ? null : new Set(["MA1"]),
        );

        const body = envelope(
            await call("query_entities", {
                bbox: BOX,
                pluginIds: ["flights", "maritime"],
                filters: STATUS_FILTER,
            }),
        );

        expect(body.ok).toBe(true);
        expect(body.data?.entities).toEqual([
            { id: "MA1", pluginId: "maritime", name: "MA1", latitude: 51.49, longitude: -0.1 },
        ]);
    });

    it("reports no_data_matches when the live layers stated exactly that", async () => {
        mockRegion.mockResolvedValue({ entities: [], emptyReason: "no_data_matches" as const });

        const body = envelope(
            await call("query_entities", { bbox: BOX, pluginIds: ["flights", "maritime"] }),
        );

        expect(body.ok).toBe(true);
        expect(body.data?.entities).toEqual([]);
        expect(body.meta?.emptyReason).toBe("no_data_matches");
    });

    it("lets a live layer's statement win over an offline one", async () => {
        mockRegion.mockImplementation(async (bounds) =>
            bounds.pluginId === "flights"
                ? { entities: [], emptyReason: "plugin_not_streaming" as const }
                : { entities: [], emptyReason: "no_data_matches" as const },
        );

        const body = envelope(
            await call("query_entities", { bbox: BOX, pluginIds: ["flights", "maritime"] }),
        );

        expect(body.meta?.emptyReason).toBe("no_data_matches");
    });

    it("keeps a missing reason missing when no layer stated one at all", async () => {
        mockRegion.mockResolvedValue({ entities: [] });

        const body = envelope(
            await call("query_entities", { bbox: BOX, pluginIds: ["flights", "maritime"] }),
        );

        expect(body.ok).toBe(true);
        expect(body.data?.entities).toEqual([]);
        // Never "no_data_matches": nothing proved the data was absent.
        expect(body.meta?.emptyReason).toBe("unknown");
    });

    it("sums the layers' own totals when a source reported a truncated list", async () => {
        mockRegion.mockImplementation(async (bounds) =>
            bounds.pluginId === "flights"
                ? { entities: [hit("BA1", "flights", LONDON.lat, LONDON.lon)], totalMatched: 400 }
                : { entities: [hit("MA1", "maritime", 51.49, -0.1)], totalMatched: 120 },
        );

        const body = envelope(
            await call("query_entities", { bbox: BOX, pluginIds: ["flights", "maritime"] }),
        );

        expect(body.data?.entities).toHaveLength(2);
        expect(body.meta?.totalMatched).toBe(520);
    });

    it("stops gathering once the caller's limit is reached, across layers", async () => {
        mockRegion.mockImplementation(async (bounds) =>
            bounds.pluginId === "flights"
                ? {
                      entities: [
                          hit("BA1", "flights", LONDON.lat, LONDON.lon),
                          hit("AF1", "flights", PARIS.lat, PARIS.lon),
                          hit("LH1", "flights", BERLIN.lat, BERLIN.lon),
                      ],
                  }
                : { entities: [hit("MA1", "maritime", 51.49, -0.1)] },
        );

        const body = envelope(
            await call("query_entities", { bbox: BOX, pluginIds: ["flights", "maritime"], limit: 2 }),
        );

        expect(body.data?.entities).toHaveLength(2);
    });

    it("states no reason for a multi-layer sweep where no layer stated one", async () => {
        mockRegion.mockImplementation(async (bounds) =>
            bounds.pluginId === "flights"
                ? { entities: [] }
                : { entities: [], emptyReason: "plugin_not_streaming" as const },
        );

        const body = envelope(
            await call("query_entities", { bbox: BOX, pluginIds: ["flights", "maritime"] }),
        );

        expect(body.ok).toBe(true);
        expect(body.data?.entities).toEqual([]);
        expect(body.meta?.emptyReason).toBe("plugin_not_streaming");
    });
});

describe("query_entities -- near mode ordering (the find_nearby_entities promise)", () => {
    beforeEach(() => {
        mockRegion.mockImplementation(async (bounds) =>
            bounds.pluginId === "flights"
                ? {
                      entities: [
                          hit("DH1", "flights", BERLIN.lat, BERLIN.lon),
                          hit("AF1", "flights", PARIS.lat, PARIS.lon),
                          hit("BA1", "flights", 51.5, -0.12),
                      ],
                  }
                : { entities: [hit("MA1", "maritime", 51.49, -0.1)] },
        );
    });

    it("sorts nearest-first, annotates distanceKm, and reports meta.order distance", async () => {
        const body = envelope(
            await call("query_entities", {
                near: { lat: LONDON.lat, lon: LONDON.lon, radiusKm: 1000 },
            }),
        );

        const entities = body.data?.entities as Array<{ id: string; distanceKm: number }>;
        expect(entities.map((entity) => entity.id)).toEqual(["BA1", "MA1", "AF1", "DH1"]);
        const distances = entities.map((entity) => entity.distanceKm);
        expect(distances).toEqual([...distances].sort((a, b) => a - b));
        expect(distances[3]).toBeGreaterThan(900);
        expect(body.meta?.order).toBe("distance");
    });

    it("keeps nearest-first order when a query also filters the set", async () => {
        const body = envelope(
            await call("query_entities", {
                near: { lat: LONDON.lat, lon: LONDON.lon, radiusKm: 1000 },
                query: "AF1",
            }),
        );

        const entities = body.data?.entities as Array<{ id: string }>;
        expect(entities.map((entity) => entity.id)).toEqual(["AF1"]);
        expect(body.meta?.order).toBe("distance");
    });

    it("finds a name match that is farther than the caller's limit of nearest results", async () => {
        // AF1 is the 3rd nearest; with limit 1 the proximity set would end at BA1
        // and the name filter would see nothing. near+query must gather at the hard
        // cap first, exactly as bbox+query does.
        const body = envelope(
            await call("query_entities", {
                near: { lat: LONDON.lat, lon: LONDON.lon, radiusKm: 1000 },
                query: "AF1",
                limit: 1,
            }),
        );

        const entities = body.data?.entities as Array<{ id: string }>;
        expect(entities.map((entity) => entity.id)).toEqual(["AF1"]);
    });

    it("reports an engine outage as a failure, never as an empty result", async () => {
        mockPlugins.mockResolvedValue({ plugins: [], reason: "engine_unreachable" });

        const body = envelope(
            await call("query_entities", { near: { lat: LONDON.lat, lon: LONDON.lon } }),
        );

        expect(body.ok).toBe(false);
        expect(body.error).toBe("engine_unreachable");
        expect(body.hint).toMatch(/outage/i);
    });
});

describe("query_entities -- empty results (v1 regression guards)", () => {
    it("carries the service reason plus its hint", async () => {
        mockRegion.mockResolvedValue({ entities: [], emptyReason: "plugin_not_streaming" });

        const body = envelope(await call("query_entities", { bbox: BOX, pluginIds: ["flights"] }));

        expect(body.ok).toBe(true);
        expect(body.data?.entities).toEqual([]);
        expect(body.meta?.emptyReason).toBe("plugin_not_streaming");
        expect(body.meta?.emptyReason).not.toBe("no_data_matches");
        expect(body.meta?.hint).toBeTruthy();
    });

    it("escalates a dead engine to engine_unreachable instead of 'not streaming'", async () => {
        // The service reports plugin_not_streaming for BOTH a plugin the engine
        // does not have and an engine that is not answering. A live E2E run
        // caught query_entities calling a dead engine "not currently streaming",
        // which an agent reads as a data condition. The id-addressed tools
        // already split these apart; this is the query path catching up.
        mockRegion.mockResolvedValue({ entities: [], emptyReason: "plugin_not_streaming" });
        mockPlugins.mockResolvedValue({ plugins: [], reason: "engine_unreachable" });

        const body = envelope(await call("query_entities", { bbox: BOX, pluginIds: ["flights"] }));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("engine_unreachable");
        expect(body.hint).toMatch(/outage/i);
        expect(body.meta?.emptyReason).toBeUndefined();
    });

    it("resolves a MISSING service reason to unknown, NOT to no_data_matches", async () => {
        // v1's resolveDataQueryEmptyReason(undefined) returned "no_data_matches",
        // which reported an outage to the agent as "nothing matched here".
        mockRegion.mockResolvedValue({ entities: [] });

        const body = envelope(await call("query_entities", { bbox: BOX }));

        expect(body.meta?.emptyReason).toBe("unknown");
        expect(body.meta?.emptyReason).not.toBe("no_data_matches");
        expect(body.meta?.hint).toMatch(/unknown/i);
    });

    it("resolves the same missing reason to unknown in near and text mode too", async () => {
        mockRegion.mockResolvedValue({ entities: [] });
        mockSearch.mockResolvedValue({ entities: [] });

        const nearBody = envelope(
            await call("query_entities", {
                near: { lat: LONDON.lat, lon: LONDON.lon },
                pluginIds: ["flights"],
            }),
        );
        const textBody = envelope(await call("query_entities", { query: "anything" }));

        expect(nearBody.meta?.emptyReason).toBe("unknown");
        expect(textBody.meta?.emptyReason).toBe("unknown");
    });
});

describe("query_entities -- field projection", () => {
    it("projects each entity and reports the names it could not honour", async () => {
        mockRegion.mockResolvedValue({ entities: [hit("BA1", "flights", LONDON.lat, LONDON.lon)] });

        const body = envelope(
            await call("query_entities", { bbox: BOX, fields: ["id", "altitude"] }),
        );

        expect(body.ok).toBe(true);
        expect(body.data?.entities).toEqual([{ id: "BA1" }]);
        expect(body.meta?.unknownFields).toEqual(["altitude"]);
    });

    it("returns the full record and no unknownFields when no projection is asked for", async () => {
        mockRegion.mockResolvedValue({ entities: [hit("BA1", "flights", LONDON.lat, LONDON.lon)] });

        const body = envelope(await call("query_entities", { bbox: BOX }));

        expect(body.data?.entities).toEqual([
            { id: "BA1", pluginId: "flights", name: "BA1", latitude: LONDON.lat, longitude: LONDON.lon },
        ]);
        expect(body.meta?.unknownFields).toBeUndefined();
    });
});
