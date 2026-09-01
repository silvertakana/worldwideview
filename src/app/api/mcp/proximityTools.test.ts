/**
 * Proximity tool + service tests (PR 1).
 *
 * Covers:
 *   - haversineDistanceKm math against known great-circle distances
 *   - coordinate-based proximity search (nearest-first + distanceKm)
 *   - entity-based proximity search (origin resolution + self-exclusion)
 *   - origin_entity_not_found emptyReason
 *   - radius cut-off and default radius
 *   - targetPluginIds filtering and all-active-plugins fallback
 *   - inline property filters
 *   - limit truncation
 *   - tool registration on an McpServer stub
 *
 * The data-query service and the heavy globe-state modules are mocked;
 * discoveryHelpers keeps its REAL radiusKmToBbox while listStreamingPlugins
 * is mocked (same pattern as discoveryTools.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SearchResult } from "@/lib/data-query/types";

vi.mock("@/lib/data-query/service");
vi.mock("@/lib/globeStateStore");
vi.mock("@/lib/mcpSessionCatalog");
vi.mock("@/lib/globeCommandQueue");
vi.mock("@/app/api/mcp/discoveryHelpers", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/app/api/mcp/discoveryHelpers")>();
    return {
        ...actual,
        listStreamingPlugins: vi.fn(),
    };
});

import { getEntitiesInRegion, getEntityDetails, getPluginData } from "@/lib/data-query/service";
import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";
import {
    haversineDistanceKm,
    findNearbyEntities,
    type FindNearbyResult,
    type NearbyEntity,
} from "@/lib/mcp/proximityService";
import { registerProximityTools } from "./proximityTools";

const mockGetEntitiesInRegion = vi.mocked(getEntitiesInRegion);
const mockGetEntityDetails = vi.mocked(getEntityDetails);
const mockGetPluginData = vi.mocked(getPluginData);
const mockListStreamingPlugins = vi.mocked(listStreamingPlugins);

// ---------------------------------------------------------------------------
// Fake McpServer that captures handlers + schemas
// ---------------------------------------------------------------------------
const handlers: Record<string, (args: unknown) => Promise<unknown>> = {};
const schemas: Record<string, { description: string; inputSchema?: Record<string, unknown> }> = {};
const mockServer = {
    registerTool: vi.fn(
        (name: string, schema: { description: string; inputSchema?: Record<string, unknown> }, handler: (args: unknown) => Promise<unknown>) => {
            handlers[name] = handler;
            schemas[name] = schema;
        },
    ),
};

const ctx = { userId: "user-proximity-1" };

// ---------------------------------------------------------------------------
// Fixtures (real WGS84 coordinates, known great-circle distances)
// ---------------------------------------------------------------------------
const LONDON = { lat: 51.5074, lon: -0.1278 };
const PARIS = { lat: 48.8566, lon: 2.3522 };
const ROME = { lat: 41.9, lon: 12.5 };

function regionEntity(id: string, pluginId: string, latitude: number, longitude: number): SearchResult {
    return { id, pluginId, name: id, latitude, longitude };
}

const ba1London = regionEntity("BA1", "flights", 51.5, -0.12); // ~1 km from LONDON
const af1Paris = regionEntity("AF1", "flights", PARIS.lat, PARIS.lon); // ~343.6 km from LONDON
const dh1Berlin = regionEntity("DH1", "flights", 52.52, 13.405); // ~931.7 km from LONDON
const ca1Rome = regionEntity("CA1", "flights", ROME.lat, ROME.lon); // ~1435.5 km from LONDON
const ma1London = regionEntity("MA1", "maritime", 51.49, -0.1); // ~2.3 km from LONDON

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    Object.keys(schemas).forEach((k) => delete schemas[k]);

    mockGetEntitiesInRegion.mockResolvedValue({ entities: [] });
    mockGetEntityDetails.mockResolvedValue({ data: null, emptyReason: "no_data_matches" });
    mockGetPluginData.mockResolvedValue({ data: null, emptyReason: "plugin_not_streaming" });
    mockListStreamingPlugins.mockResolvedValue({ plugins: [] });

    registerProximityTools(mockServer as never, ctx);
});

// ---------------------------------------------------------------------------
// Haversine math
// ---------------------------------------------------------------------------
describe("haversineDistanceKm", () => {
    it("computes the known London->Paris great-circle distance (~343.6 km)", () => {
        const d = haversineDistanceKm(LONDON.lat, LONDON.lon, PARIS.lat, PARIS.lon);
        expect(Math.abs(d - 343.6)).toBeLessThan(3);
    });

    it("computes the known London->Rome great-circle distance (~1435.5 km)", () => {
        const d = haversineDistanceKm(LONDON.lat, LONDON.lon, ROME.lat, ROME.lon);
        expect(Math.abs(d - 1435.5)).toBeLessThan(5);
    });

    it("returns 0 for identical coordinates", () => {
        expect(haversineDistanceKm(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
    });

    it("is symmetric (A->B equals B->A)", () => {
        const ab = haversineDistanceKm(LONDON.lat, LONDON.lon, PARIS.lat, PARIS.lon);
        const ba = haversineDistanceKm(PARIS.lat, PARIS.lon, LONDON.lat, LONDON.lon);
        expect(Math.abs(ab - ba)).toBeLessThan(1e-9);
    });
});

// ---------------------------------------------------------------------------
// Coordinate-based proximity search
// ---------------------------------------------------------------------------
function successOf(result: FindNearbyResult): Extract<FindNearbyResult, { success: true }> {
    if (result.success !== true) {
        throw new Error("expected a success result");
    }
    return result;
}

describe("findNearbyEntities -- coordinate-based", () => {
    it("returns entities nearest-first with distanceKm matched to haversine math", async () => {
        mockGetEntitiesInRegion.mockResolvedValue({
            entities: [dh1Berlin, af1Paris, ba1London], // deliberately unordered
        });

        const result = successOf(
            await findNearbyEntities({
                lat: LONDON.lat,
                lon: LONDON.lon,
                radiusKm: 1000,
                targetPluginIds: ["flights"],
            }),
        );

        expect(result.center).toEqual({ latitude: LONDON.lat, longitude: LONDON.lon });
        expect(result.radiusKm).toBe(1000);
        expect(result.entities.map((e) => e.id)).toEqual(["BA1", "AF1", "DH1"]);

        const distances = result.entities.map((e) => e.distanceKm);
        expect(distances).toEqual([...distances].sort((a, b) => a - b));
        expect(Math.abs(distances[0] - haversineDistanceKm(LONDON.lat, LONDON.lon, 51.5, -0.12))).toBeLessThan(1e-9);
        expect(Math.abs(distances[1] - 343.6)).toBeLessThan(3);
        expect(Math.abs(distances[2] - 931.7)).toBeLessThan(5);
    });

    it("cuts off entities beyond radiusKm and keeps the ones inside", async () => {
        mockGetEntitiesInRegion.mockResolvedValue({
            entities: [ba1London, af1Paris, ca1Rome],
        });

        const result = successOf(
            await findNearbyEntities({
                lat: LONDON.lat,
                lon: LONDON.lon,
                radiusKm: 500,
                targetPluginIds: ["flights"],
            }),
        );

        expect(result.entities.map((e) => e.id)).toEqual(["BA1", "AF1"]);
        expect(result.entities.every((e) => e.distanceKm <= 500)).toBe(true);
    });

    it("defaults the radius to 50 km when radiusKm is omitted", async () => {
        mockGetEntitiesInRegion.mockResolvedValue({
            entities: [ba1London, af1Paris],
        });

        const result = successOf(
            await findNearbyEntities({
                lat: LONDON.lat,
                lon: LONDON.lon,
                targetPluginIds: ["flights"],
            }),
        );

        expect(result.radiusKm).toBe(50);
        expect(result.entities.map((e) => e.id)).toEqual(["BA1"]);
    });

    it("truncates to limit (nearest first)", async () => {
        mockGetEntitiesInRegion.mockResolvedValue({
            entities: [ca1Rome, af1Paris, ba1London],
        });

        const result = successOf(
            await findNearbyEntities({
                lat: LONDON.lat,
                lon: LONDON.lon,
                radiusKm: 2000,
                targetPluginIds: ["flights"],
                limit: 1,
            }),
        );

        expect(result.count).toBe(1);
        expect(result.entities.map((e) => e.id)).toEqual(["BA1"]);
    });

    it("rejects a missing or partial coordinate center", async () => {
        for (const opts of [{}, { lat: 51.5 }] as const) {
            const result = await findNearbyEntities(opts);
            expect(result.success).toBe(false);
            if (!result.success && "error" in result) {
                expect(result.error.length).toBeGreaterThan(0);
            }
        }
        expect(mockGetEntitiesInRegion).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Entity-based proximity search
// ---------------------------------------------------------------------------
describe("findNearbyEntities -- entity-based", () => {
    it("resolves the origin entity as the center and excludes it from results", async () => {
        mockGetEntityDetails.mockResolvedValue({
            data: {
                id: "AF1",
                pluginId: "flights",
                latitude: PARIS.lat,
                longitude: PARIS.lon,
                timestamp: new Date(),
                label: "AF1 Paris",
                properties: {},
            },
        });
        mockGetEntitiesInRegion.mockResolvedValue({
            entities: [ba1London, af1Paris], // origin included in bbox -> must be excluded
        });

        const result = successOf(
            await findNearbyEntities({
                originPluginId: "flights",
                originEntityId: "AF1",
                radiusKm: 1000,
                targetPluginIds: ["flights"],
            }),
        );

        expect(result.center).toEqual({
            latitude: PARIS.lat,
            longitude: PARIS.lon,
            originPluginId: "flights",
            originEntityId: "AF1",
            originLabel: "AF1 Paris",
        });
        expect(result.entities.map((e) => e.id)).toEqual(["BA1"]);
        expect(Math.abs(result.entities[0].distanceKm - 343.6)).toBeLessThan(3);
    });

    it("returns emptyReason origin_entity_not_found when the origin entity does not exist", async () => {
        mockGetEntityDetails.mockResolvedValue({ data: null, emptyReason: "no_data_matches" });

        const result = await findNearbyEntities({
            originPluginId: "flights",
            originEntityId: "NOPE",
            radiusKm: 100,
        });

        expect(result.success).toBe(false);
        if (!result.success && "emptyReason" in result) {
            expect(result.emptyReason).toBe("origin_entity_not_found");
        }
        expect(result.count).toBe(0);
        expect((result as { entities: unknown[] }).entities).toEqual([]);
        expect(mockGetEntitiesInRegion).not.toHaveBeenCalled();
    });

    it("rejects a lone origin id (plugin + entity are required together)", async () => {
        const result = await findNearbyEntities({ originEntityId: "AF1" });
        expect(result.success).toBe(false);
        if (!result.success && "error" in result) {
            expect(result.error).toContain("together");
        }
    });

    it("queries the bbox region with limit 200 for the target plugin", async () => {
        mockGetEntitiesInRegion.mockResolvedValue({ entities: [ba1London] });

        await findNearbyEntities({
            lat: LONDON.lat,
            lon: LONDON.lon,
            radiusKm: 100,
            targetPluginIds: ["flights"],
        });

        const regionArgs = mockGetEntitiesInRegion.mock.calls[0][0];
        expect(regionArgs.pluginId).toBe("flights");
        expect(regionArgs.limit).toBe(200);
        expect(regionArgs.north).toBeGreaterThan(regionArgs.south);
        expect(regionArgs.east).toBeGreaterThan(regionArgs.west);
    });
});

// ---------------------------------------------------------------------------
// Plugin targeting
// ---------------------------------------------------------------------------
describe("findNearbyEntities -- plugin targeting", () => {
    it("searches only the plugins listed in targetPluginIds", async () => {
        mockGetEntitiesInRegion.mockResolvedValue({ entities: [ma1London] });

        const result = successOf(
            await findNearbyEntities({
                lat: LONDON.lat,
                lon: LONDON.lon,
                radiusKm: 100,
                targetPluginIds: ["maritime"],
            }),
        );

        expect(mockGetEntitiesInRegion).toHaveBeenCalledTimes(1);
        expect(mockGetEntitiesInRegion.mock.calls[0][0].pluginId).toBe("maritime");
        expect(result.entities.map((e) => e.id)).toEqual(["MA1"]);
    });

    it("searches all active streaming plugins when targetPluginIds is omitted", async () => {
        mockListStreamingPlugins.mockResolvedValue({
            plugins: [
                { pluginId: "flights", pluginName: "flights", entityCount: 1, entityTypes: [], source: "engine" },
                { pluginId: "maritime", pluginName: "maritime", entityCount: 1, entityTypes: [], source: "engine" },
            ],
        });
        mockGetEntitiesInRegion
            .mockResolvedValueOnce({ entities: [ba1London] })
            .mockResolvedValueOnce({ entities: [ma1London] });

        const result = successOf(
            await findNearbyEntities({
                lat: LONDON.lat,
                lon: LONDON.lon,
                radiusKm: 100,
            }),
        );

        expect(mockGetEntitiesInRegion).toHaveBeenCalledTimes(2);
        const pluginIds = mockGetEntitiesInRegion.mock.calls.map((c) => c[0].pluginId).sort();
        expect(pluginIds).toEqual(["flights", "maritime"]);
        expect(result.entities.map((e) => e.id)).toEqual(["BA1", "MA1"]); // merged, nearest-first
    });
});

// ---------------------------------------------------------------------------
// Inline filters
// ---------------------------------------------------------------------------
describe("findNearbyEntities -- filters", () => {
    it("keeps only candidates whose properties match all filters", async () => {
        const airborne = { id: "BA1", pluginId: "flights", latitude: 51.5, longitude: -0.12, timestamp: new Date(), properties: { status: "airborne" } };
        const landed = { id: "AF2", pluginId: "flights", latitude: 51.49, longitude: -0.1, timestamp: new Date(), properties: { status: "landed" } };
        mockGetEntitiesInRegion.mockResolvedValue({
            entities: [regionEntity("BA1", "flights", 51.5, -0.12), regionEntity("AF2", "flights", 51.49, -0.1)],
        });
        mockGetPluginData.mockResolvedValue({
            data: { pluginId: "flights", entities: [airborne, landed], timestamp: new Date() },
        });

        const result = successOf(
            await findNearbyEntities({
                lat: LONDON.lat,
                lon: LONDON.lon,
                radiusKm: 100,
                targetPluginIds: ["flights"],
                filters: { status: { type: "select", values: ["airborne"] } },
            }),
        );

        expect(result.entities.map((e) => e.id)).toEqual(["BA1"]);
        expect(mockGetPluginData).toHaveBeenCalledWith("flights");
    });

    it("returns no candidates when the filter snapshot is unavailable", async () => {
        mockGetEntitiesInRegion.mockResolvedValue({ entities: [ba1London] });
        mockGetPluginData.mockResolvedValue({ data: null, emptyReason: "plugin_not_streaming" });

        const result = successOf(
            await findNearbyEntities({
                lat: LONDON.lat,
                lon: LONDON.lon,
                radiusKm: 100,
                targetPluginIds: ["flights"],
                filters: { status: { type: "select", values: ["airborne"] } },
            }),
        );

        expect(result.entities).toEqual([]);
        expect(result.count).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// MCP tool registration + handler surface
// ---------------------------------------------------------------------------
describe("find_nearby_entities tool registration", () => {
    it("registers the tool with a descriptive schema", () => {
        const schema = schemas["find_nearby_entities"];
        expect(schema).toBeDefined();
        expect(schema.description.length).toBeGreaterThan(0);
        expect(schema.description).toContain("Example:");
        expect(schema.description).toContain("emptyReason");

        for (const key of ["lat", "lon", "originPluginId", "originEntityId", "radiusKm", "targetPluginIds", "limit", "filters"]) {
            expect(schema.inputSchema).toHaveProperty(key);
        }
    });

    it("serves a coordinate-based search through the handler with distanceKm annotations", async () => {
        mockGetEntitiesInRegion.mockResolvedValue({
            entities: [af1Paris, ba1London],
        });

        const raw = await handlers["find_nearby_entities"]({
            lat: LONDON.lat,
            lon: LONDON.lon,
            radiusKm: 500,
            targetPluginIds: ["flights"],
        });
        const body = JSON.parse(
            (raw as { content: Array<{ text: string }> }).content[0].text,
        ) as {
            success: boolean;
            center: { latitude: number; longitude: number };
            radiusKm: number;
            count: number;
            entities: NearbyEntity[];
        };

        expect(body.success).toBe(true);
        expect(body.center).toEqual({ latitude: LONDON.lat, longitude: LONDON.lon });
        expect(body.radiusKm).toBe(500);
        expect(body.count).toBe(2);
        expect(body.entities.map((e) => e.id)).toEqual(["BA1", "AF1"]);
        expect(typeof body.entities[0].distanceKm).toBe("number");
    });

    it("returns a structured error result when the search fails", async () => {
        mockGetEntitiesInRegion.mockRejectedValue(new Error("engine down"));

        const raw = await handlers["find_nearby_entities"]({
            lat: LONDON.lat,
            lon: LONDON.lon,
            radiusKm: 500,
            targetPluginIds: ["flights"],
        });
        const body = JSON.parse(
            (raw as { content: Array<{ text: string }> }).content[0].text,
        ) as { success: boolean; count: number; error: string };

        expect(body.success).toBe(false);
        expect(body.count).toBe(0);
        expect(body.error).toBe("Proximity search failed");
    });
});