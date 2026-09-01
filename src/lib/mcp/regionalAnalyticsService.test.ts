import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRegionalAnalytics } from "./regionalAnalyticsService";
import { fetchPluginSnapshot, getAllPluginSnapshots } from "@/lib/data-query/service";
import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";

vi.mock("@/lib/data-query/service", () => ({
    fetchPluginSnapshot: vi.fn(),
    getAllPluginSnapshots: vi.fn(),
}));

function makeEntity(
    id: string,
    pluginId: string,
    lat: number,
    lon: number,
    properties: Record<string, unknown> = {},
): GeoEntity {
    return {
        id,
        pluginId,
        latitude: lat,
        longitude: lon,
        timestamp: new Date(),
        properties,
    };
}

describe("getRegionalAnalytics", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("throws error for invalid bounding box inputs (e.g. NaN or north < south)", async () => {
        await expect(
            getRegionalAnalytics({
                north: NaN,
                south: 10,
                east: 20,
                west: 10,
            }),
        ).rejects.toThrow("Invalid bounding box");

        await expect(
            getRegionalAnalytics({
                north: 10,
                south: 20,
                east: 20,
                west: 10,
            }),
        ).rejects.toThrow("north latitude must be greater than or equal to south latitude");
    });

    it("returns plugin_not_streaming when target plugin is not streaming", async () => {
        vi.mocked(fetchPluginSnapshot).mockResolvedValue(null);

        const result = await getRegionalAnalytics({
            north: 50,
            south: 40,
            east: 10,
            west: 0,
            pluginId: "non_existent",
        });

        expect(result.emptyReason).toBe("plugin_not_streaming");
        expect(result.totalCount).toBe(0);
        expect(result.clusters).toEqual([]);
    });

    it("returns no_data_matches when entities exist elsewhere but none in bounding box", async () => {
        vi.mocked(fetchPluginSnapshot).mockResolvedValue({
            pluginId: "aviation",
            timestamp: new Date(),
            entities: [makeEntity("flight-1", "aviation", 10, 10)],
        });

        const result = await getRegionalAnalytics({
            north: 60,
            south: 50,
            east: 5,
            west: -5,
            pluginId: "aviation",
        });

        expect(result.emptyReason).toBe("no_data_matches");
        expect(result.totalCount).toBe(0);
        expect(result.clusters).toEqual([]);
    });

    it("correctly aggregates entity counts, byPlugin, and spatial clusters", async () => {
        const entities: GeoEntity[] = [
            makeEntity("f1", "aviation", 51.5, -0.1, { type: "commercial", country: "UK" }),
            makeEntity("f2", "aviation", 51.6, -0.2, { type: "commercial", country: "UK" }),
            makeEntity("f3", "aviation", 52.1, 0.5, { type: "cargo", country: "FR" }),
            makeEntity("s1", "maritime", 51.4, 0.1, { type: "tanker", country: "PA" }),
        ];

        vi.mocked(getAllPluginSnapshots).mockResolvedValue([
            { pluginId: "aviation", timestamp: new Date(), entities: entities.slice(0, 3) },
            { pluginId: "maritime", timestamp: new Date(), entities: [entities[3]] },
        ]);

        const result = await getRegionalAnalytics({
            north: 53,
            south: 50,
            east: 2,
            west: -2,
            groupBy: "type",
            clusterResolution: 2,
        });

        expect(result.totalCount).toBe(4);
        expect(result.byPlugin).toEqual({
            aviation: 3,
            maritime: 1,
        });
        expect(result.breakdown).toEqual({
            commercial: 2,
            cargo: 1,
            tanker: 1,
        });
        expect(result.clusters.length).toBeGreaterThan(0);
        const clusterSum = result.clusters.reduce((sum, c) => sum + c.count, 0);
        expect(clusterSum).toBe(4);
    });

    it("handles antimeridian crossing bounding boxes (east < west)", async () => {
        const entities: GeoEntity[] = [
            makeEntity("e1", "maritime", 20, 179.5), // West of date line
            makeEntity("e2", "maritime", 20, -179.5), // East of date line
            makeEntity("e3", "maritime", 20, 0), // Outside
        ];

        vi.mocked(fetchPluginSnapshot).mockResolvedValue({
            pluginId: "maritime",
            timestamp: new Date(),
            entities,
        });

        const result = await getRegionalAnalytics({
            north: 30,
            south: 10,
            east: -170, // Across antimeridian
            west: 170,
            pluginId: "maritime",
        });

        expect(result.totalCount).toBe(2);
        expect(result.byPlugin).toEqual({ maritime: 2 });
    });

    it("caps topN breakdown results and aggregates overflow into 'other'", async () => {
        const entities: GeoEntity[] = [
            makeEntity("e1", "demo", 10, 10, { cat: "A" }),
            makeEntity("e2", "demo", 10, 10, { cat: "B" }),
            makeEntity("e3", "demo", 10, 10, { cat: "C" }),
            makeEntity("e4", "demo", 10, 10, { cat: "D" }),
        ];

        vi.mocked(fetchPluginSnapshot).mockResolvedValue({
            pluginId: "demo",
            timestamp: new Date(),
            entities,
        });

        const result = await getRegionalAnalytics({
            north: 20,
            south: 0,
            east: 20,
            west: 0,
            pluginId: "demo",
            groupBy: "cat",
            topN: 2,
        });

        expect(result.totalCount).toBe(4);
        expect(result.breakdown).toBeDefined();
        expect(result.breakdown?.other).toBe(2);
        expect(Object.keys(result.breakdown!)).toHaveLength(3); // 2 top + 1 other
    });
});
