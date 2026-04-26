import { describe, test, expect, vi, beforeEach } from "vitest";
import { DeclarativePlugin } from "./DeclarativePlugin";
import type { PluginManifest } from "../PluginManifest";

function makeManifest(overrides?: Partial<PluginManifest>): PluginManifest {
    return {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        description: "A test declarative plugin",
        type: "data-layer",
        format: "declarative",
        trust: "built-in",
        capabilities: ["data:own"],
        category: "custom",
        icon: "🧪",
        dataSource: {
            url: "https://api.example.com/data",
            method: "GET",
            pollInterval: 60000,
            format: "geojson",
        },
        fieldMapping: {
            id: "id",
            latitude: "geometry.coordinates[1]",
            longitude: "geometry.coordinates[0]",
            label: "properties.name",
            properties: { mag: "properties.mag" },
        },
        rendering: {
            entityType: "point",
            color: "#ff0000",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 1000,
        },
        ...overrides,
    };
}

const geojsonResponse = {
    type: "FeatureCollection",
    features: [
        {
            id: "eq1",
            type: "Feature",
            geometry: { type: "Point", coordinates: [174.7, -36.8, 10] },
            properties: { name: "Quake A", mag: 4.5 },
        },
        {
            id: "eq2",
            type: "Feature",
            geometry: { type: "Point", coordinates: [175.3, -37.1] },
            properties: { name: "Quake B", mag: 3.2 },
        },
    ],
};

const jsonResponse = {
    data: {
        results: [
            { uid: "s1", lat: -36.8, lon: 174.7, title: "Ship A", knots: 12 },
            { uid: "s2", lat: -37.1, lon: 175.3, title: "Ship B", knots: 8 },
        ],
    },
};

beforeEach(() => {
    vi.restoreAllMocks();
});

describe("DeclarativePlugin", () => {
    test("constructor populates fields from manifest", () => {
        const plugin = new DeclarativePlugin(makeManifest());
        expect(plugin.id).toBe("test-plugin");
        expect(plugin.name).toBe("Test Plugin");
        expect(plugin.description).toBe("A test declarative plugin");
        expect(plugin.version).toBe("1.0.0");
        expect(plugin.category).toBe("custom");
        expect(plugin.icon).toBe("🧪");
    });

    test("getPollingInterval returns manifest pollInterval", () => {
        const plugin = new DeclarativePlugin(makeManifest());
        expect(plugin.getPollingInterval()).toBe(60000);
    });

    test("getPollingInterval returns default when no dataSource", () => {
        const plugin = new DeclarativePlugin(makeManifest({ dataSource: undefined }));
        expect(plugin.getPollingInterval()).toBe(30000);
    });

    test("getLayerConfig returns manifest rendering values", () => {
        const plugin = new DeclarativePlugin(makeManifest());
        const config = plugin.getLayerConfig();
        expect(config.color).toBe("#ff0000");
        expect(config.clusterEnabled).toBe(true);
        expect(config.clusterDistance).toBe(50);
        expect(config.maxEntities).toBe(1000);
    });

    test("fetch with GeoJSON format returns correct entities", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(geojsonResponse),
        }));

        const plugin = new DeclarativePlugin(makeManifest());
        await plugin.initialize({
            apiBaseUrl: "",
            timeRange: { start: new Date(), end: new Date() },
            onDataUpdate: () => {},
            onError: () => {},
            getPluginSettings: () => undefined,
            isPlaybackMode: () => false,
            getCurrentTime: () => new Date(),
            env: {},
            edition: "local",
        });

        const entities = await plugin.fetch({ start: new Date(), end: new Date() });
        expect(entities).toHaveLength(2);
        expect(entities[0].id).toBe("test-plugin-eq1");
        expect(entities[0].latitude).toBe(-36.8);
        expect(entities[0].longitude).toBe(174.7);
        expect(entities[0].label).toBe("Quake A");
        expect(entities[0].properties.mag).toBe(4.5);
    });

    test("fetch with JSON format returns correct entities", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(jsonResponse),
        }));

        const manifest = makeManifest({
            dataSource: {
                url: "https://api.example.com/ships",
                method: "GET",
                pollInterval: 30000,
                format: "json",
                arrayPath: "data.results",
            },
            fieldMapping: {
                id: "uid",
                latitude: "lat",
                longitude: "lon",
                label: "title",
                speed: "knots",
                properties: { knots: "knots" },
            },
        });

        const plugin = new DeclarativePlugin(manifest);
        const entities = await plugin.fetch({ start: new Date(), end: new Date() });
        expect(entities).toHaveLength(2);
        expect(entities[0].id).toBe("test-plugin-s1");
        expect(entities[0].latitude).toBe(-36.8);
        expect(entities[0].longitude).toBe(174.7);
        expect(entities[0].label).toBe("Ship A");
        expect(entities[0].properties.knots).toBe(12);
    });

    test("fetch returns empty array on network error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));

        const plugin = new DeclarativePlugin(makeManifest());
        const entities = await plugin.fetch({ start: new Date(), end: new Date() });
        expect(entities).toEqual([]);
    });

    test("fetch returns empty array when no dataSource", async () => {
        const plugin = new DeclarativePlugin(makeManifest({ dataSource: undefined }));
        const entities = await plugin.fetch({ start: new Date(), end: new Date() });
        expect(entities).toEqual([]);
    });

    test("fetch returns empty array on HTTP error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
        }));

        const plugin = new DeclarativePlugin(makeManifest());
        const entities = await plugin.fetch({ start: new Date(), end: new Date() });
        expect(entities).toEqual([]);
    });

    test("renderEntity returns correct options", () => {
        const plugin = new DeclarativePlugin(makeManifest());
        const entity = {
            id: "test-1",
            pluginId: "test-plugin",
            latitude: -36.8,
            longitude: 174.7,
            timestamp: new Date(),
            label: "Test",
            properties: {},
        };
        const opts = plugin.renderEntity(entity);
        expect(opts.type).toBe("point");
        expect(opts.color).toBe("#ff0000");
        expect(opts.labelText).toBe("Test");
    });
});
