/**
 * proximitySearch tests: the near-mode engine behind query_entities.
 *
 * These restore, at the module's new home, the coverage that lived in the
 * deleted proximityTools.test.ts -- the haversine maths, the nearest-first
 * ordering, per-layer targeting, and the inline-filter rule that an unreadable
 * snapshot yields NO candidates rather than widening the result set.
 *
 * v1's entity-centred form (originPluginId/originEntityId) is gone by design, so
 * its tests are gone with it; get_entity_details now reads the origin.
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

import { getEntitiesInRegion, getPluginData } from "@/lib/data-query/service";
import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";
import { findNearbyEntities, haversineDistanceKm } from "./proximitySearch";
import type { FilterValue } from "@/core/plugins/PluginTypes";

const mockRegion = vi.mocked(getEntitiesInRegion);
const mockPluginData = vi.mocked(getPluginData);
const mockPlugins = vi.mocked(listStreamingPlugins);

const LONDON = { lat: 51.5074, lon: -0.1278 };
const PARIS = { lat: 48.8566, lon: 2.3522 };
const ROME = { lat: 41.9, lon: 12.5 };

function hit(id: string, lat: number, lon: number, pluginId = "flights"): SearchResult {
    return { id, pluginId, name: id, latitude: lat, longitude: lon };
}

function geo(id: string, properties: Record<string, unknown>): GeoEntity {
    return {
        id,
        pluginId: "flights",
        latitude: LONDON.lat,
        longitude: LONDON.lon,
        timestamp: new Date("2026-09-25T10:00:00Z"),
        properties,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockRegion.mockResolvedValue({ entities: [] });
    mockPluginData.mockResolvedValue({ data: null });
    mockPlugins.mockResolvedValue({
        plugins: [
            { pluginId: "flights", pluginName: "flights", entityCount: 0, entityTypes: [], source: "engine" },
            { pluginId: "maritime", pluginName: "maritime", entityCount: 0, entityTypes: [], source: "engine" },
        ],
    });
});

describe("haversineDistanceKm", () => {
    it("computes the known London->Paris great-circle distance (~343.6 km)", () => {
        expect(haversineDistanceKm(LONDON.lat, LONDON.lon, PARIS.lat, PARIS.lon)).toBeCloseTo(343.6, 0);
    });

    it("computes the known London->Rome great-circle distance (~1435 km)", () => {
        // Published great-circle distance is ~1435 km; with this module's Earth
        // radius (6371 km) the closed form lands at 1434.2 km, so the assertion
        // is a band around the reference rather than a false-precision constant.
        const km = haversineDistanceKm(LONDON.lat, LONDON.lon, ROME.lat, ROME.lon);
        expect(km).toBeGreaterThan(1430);
        expect(km).toBeLessThan(1440);
    });

    it("returns 0 for identical coordinates and is symmetric", () => {
        expect(haversineDistanceKm(LONDON.lat, LONDON.lon, LONDON.lat, LONDON.lon)).toBe(0);
        expect(haversineDistanceKm(LONDON.lat, LONDON.lon, PARIS.lat, PARIS.lon)).toBeCloseTo(
            haversineDistanceKm(PARIS.lat, PARIS.lon, LONDON.lat, LONDON.lon),
            9,
        );
    });
});

describe("findNearbyEntities -- radius, ordering and cap", () => {
    beforeEach(() => {
        mockRegion.mockResolvedValue({
            entities: [
                hit("PARIS", PARIS.lat, PARIS.lon),
                hit("NEAR", 51.5, -0.12),
                hit("MID", 51.6, -0.2),
            ],
        });
    });

    it("keeps entities inside radiusKm, drops the rest, and sorts nearest-first", async () => {
        const result = await findNearbyEntities({ ...LONDON, radiusKm: 30, pluginIds: ["flights"] });

        expect(result.entities.map((entity) => entity.id)).toEqual(["NEAR", "MID"]);
        expect(result.radiusKm).toBe(30);
    });

    it("defaults the radius to 50 km and caps every layer query at 200 candidates", async () => {
        const result = await findNearbyEntities({ ...LONDON, pluginIds: ["flights"] });

        expect(result.radiusKm).toBe(50);
        expect(result.entities.map((entity) => entity.id)).toEqual(["NEAR", "MID"]);
        expect(mockRegion).toHaveBeenCalledWith(expect.objectContaining({ limit: 200, pluginId: "flights" }));
    });

    it("clamps an oversized radius to 1000 km", async () => {
        const result = await findNearbyEntities({ ...LONDON, radiusKm: 5000, pluginIds: ["flights"] });

        expect(result.radiusKm).toBe(1000);
        expect(result.entities).toHaveLength(3);
    });

    it("truncates to limit nearest-first and reports totalMatched", async () => {
        const result = await findNearbyEntities({ ...LONDON, radiusKm: 1000, limit: 2, pluginIds: ["flights"] });

        expect(result.entities.map((entity) => entity.id)).toEqual(["NEAR", "MID"]);
        expect(result.totalMatched).toBe(3);
    });
});

describe("findNearbyEntities -- layer targeting", () => {
    it("queries only the requested layers and never reads the plugin list", async () => {
        await findNearbyEntities({ ...LONDON, pluginIds: ["flights", "maritime"] });

        expect(mockRegion).toHaveBeenCalledTimes(2);
        expect(mockRegion).toHaveBeenNthCalledWith(1, expect.objectContaining({ pluginId: "flights" }));
        expect(mockRegion).toHaveBeenNthCalledWith(2, expect.objectContaining({ pluginId: "maritime" }));
        expect(mockPlugins).not.toHaveBeenCalled();
    });

    it("sweeps every streaming layer when pluginIds is omitted", async () => {
        await findNearbyEntities({ ...LONDON });

        expect(mockPlugins).toHaveBeenCalled();
        expect(mockRegion).toHaveBeenCalledTimes(2);
    });

    it("flags an engine outage rather than reporting an empty search", async () => {
        mockPlugins.mockResolvedValue({ plugins: [], reason: "engine_unreachable" });

        const result = await findNearbyEntities({ ...LONDON });

        expect(result.engineUnreachable).toBe(true);
        expect(result.emptyReason).toBeUndefined();
    });
});

describe("findNearbyEntities -- inline filters", () => {
    const FILTER: Record<string, FilterValue> = { status: { type: "select", values: ["airborne"] } };

    beforeEach(() => {
        mockRegion.mockResolvedValue({
            entities: [hit("AIR", LONDON.lat, LONDON.lon), hit("GROUND", 51.5, -0.13)],
        });
        mockPluginData.mockResolvedValue({
            data: {
                pluginId: "flights",
                entities: [geo("AIR", { status: "airborne" }), geo("GROUND", { status: "ground" })],
                timestamp: new Date("2026-09-25T10:00:00Z"),
            },
        });
    });

    it("keeps only candidates whose properties match all filters", async () => {
        const result = await findNearbyEntities({ ...LONDON, filters: FILTER, pluginIds: ["flights"] });

        expect(result.entities.map((entity) => entity.id)).toEqual(["AIR"]);
    });

    it("returns no candidates when the layer snapshot is unavailable, never widening the search", async () => {
        mockPluginData.mockResolvedValue({ data: null });

        const result = await findNearbyEntities({ ...LONDON, filters: FILTER, pluginIds: ["flights"] });

        expect(result.entities).toEqual([]);
        expect(result.emptyReason).toBeUndefined();
    });
});

describe("findNearbyEntities -- empty reasons", () => {
    it("reports plugin_not_streaming when every layer is offline", async () => {
        mockRegion.mockResolvedValue({ entities: [], emptyReason: "plugin_not_streaming" });

        const result = await findNearbyEntities({ ...LONDON, pluginIds: ["flights"] });

        expect(result.emptyReason).toBe("plugin_not_streaming");
    });

    it("reports no_data_matches only when a live layer said so", async () => {
        mockRegion.mockResolvedValue({ entities: [], emptyReason: "no_data_matches" });

        const result = await findNearbyEntities({ ...LONDON, pluginIds: ["flights"] });

        expect(result.emptyReason).toBe("no_data_matches");
    });

    it("leaves the reason undefined when no layer reported one, so the envelope says unknown", async () => {
        mockRegion.mockResolvedValue({ entities: [] });

        const result = await findNearbyEntities({ ...LONDON, pluginIds: ["flights"] });

        expect(result.emptyReason).toBeUndefined();
    });

    it("reports plugin_not_streaming when no layer was found at all", async () => {
        mockPlugins.mockResolvedValue({ plugins: [] });

        const result = await findNearbyEntities({ ...LONDON });

        expect(result.emptyReason).toBe("plugin_not_streaming");
    });
});
