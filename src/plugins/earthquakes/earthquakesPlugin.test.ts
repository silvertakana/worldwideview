import { beforeEach, describe, expect, it, vi } from "vitest";
import { EarthquakesPlugin } from "@worldwideview/wwv-plugin-earthquakes";

function makePlugin() {
    const plugin = new EarthquakesPlugin();
    return plugin;
}

describe("EarthquakesPlugin", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("maps a GeoJSON feature into a GeoEntity", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: "FeatureCollection",
                features: [
                    {
                        id: "us7000",
                        type: "Feature",
                        geometry: { type: "Point", coordinates: [-122.3, 37.8, 9.7] },
                        properties: {
                            mag: 4.2,
                            place: "Near the coast",
                            time: 1_710_000_000_000,
                            updated: 1_710_000_300_000,
                            status: "reviewed",
                            tsunami: 0,
                            sig: 271,
                            magType: "ml",
                            url: "https://example.com/event",
                        },
                    },
                ],
            }),
        }));

        const plugin = makePlugin();
        await plugin.initialize({
            apiBaseUrl: "",
            timeRange: { start: new Date(), end: new Date() },
            onDataUpdate: () => {},
            onError: () => {},
            getPluginSettings: () => undefined,
            isPlaybackMode: () => false,
            getCurrentTime: () => new Date(),
        });

        const entities = await plugin.fetch({ start: new Date(), end: new Date() });

        expect(entities).toHaveLength(1);
        expect(entities[0]).toMatchObject({
            id: "earthquakes-us7000",
            pluginId: "earthquakes",
            latitude: 37.8,
            longitude: -122.3,
            altitude: 0,
            label: "M4.2",
            properties: {
                magnitude: 4.2,
                depth: 9.7,
                place: "Near the coast",
                updated: 1_710_000_300_000,
                status: "reviewed",
                tsunami: 0,
                sig: 271,
                magType: "ml",
                url: "https://example.com/event",
            },
        });
        expect(entities[0].timestamp).toEqual(new Date(1_710_000_000_000));
    });

    it("returns an empty array on non-200 responses", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 502,
        }));

        const plugin = makePlugin();
        const entities = await plugin.fetch({ start: new Date(), end: new Date() });

        expect(entities).toEqual([]);
    });

    it("renders earthquake points with original 4-tier magnitude styling", () => {
        const plugin = makePlugin();

        const yellow = plugin.renderEntity({
            id: "yellow",
            pluginId: "earthquakes",
            latitude: 0,
            longitude: 0,
            timestamp: new Date(),
            properties: { magnitude: 4.8 },
        });
        const orange = plugin.renderEntity({
            id: "orange",
            pluginId: "earthquakes",
            latitude: 0,
            longitude: 0,
            timestamp: new Date(),
            properties: { magnitude: 5.4 },
        });
        const red = plugin.renderEntity({
            id: "red",
            pluginId: "earthquakes",
            latitude: 0,
            longitude: 0,
            timestamp: new Date(),
            properties: { magnitude: 6.0 },
        });
        const darkRed = plugin.renderEntity({
            id: "dark-red",
            pluginId: "earthquakes",
            latitude: 0,
            longitude: 0,
            timestamp: new Date(),
            properties: { magnitude: 7.2 },
        });

        expect(yellow).toMatchObject({
            type: "point",
            color: "#fcd34d",
            size: 5,
            outlineColor: "#000000",
            outlineWidth: 1,
        });
        expect(orange).toMatchObject({
            type: "point",
            color: "#f97316",
            size: 8,
        });
        expect(red).toMatchObject({
            type: "point",
            color: "#ef4444",
            size: 12,
        });
        expect(darkRed).toMatchObject({
            type: "point",
            color: "#7f1d1d",
            size: 16,
        });
    });
});
