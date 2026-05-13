import { describe, test, expect } from "vitest";
import { mapGeoJsonToEntities } from "./mapGeoJsonToEntities";

describe("mapGeoJsonToEntities", () => {
    test("handles valid geojson with full mapping", () => {
        const data = {
            features: [
                {
                    id: "feat-1",
                    geometry: { type: "Point", coordinates: [174, -36, 10] },
                    properties: { speed: 100, heading: 90, time: "2026-05-14T00:00:00Z", label: "Test" }
                }
            ]
        };

        const entities = mapGeoJsonToEntities(data, {
            id: "id",
            latitude: "geometry.coordinates[1]",
            longitude: "geometry.coordinates[0]",
            altitude: "geometry.coordinates[2]",
            speed: "properties.speed",
            heading: "properties.heading",
            timestamp: "properties.time",
            label: "properties.label",
            properties: { custom: "properties.speed" }
        }, "plugin1");

        expect(entities).toHaveLength(1);
        expect(entities[0].altitude).toBe(10);
        expect(entities[0].speed).toBe(100);
        expect(entities[0].heading).toBe(90);
        expect(entities[0].timestamp.toISOString()).toBe("2026-05-14T00:00:00.000Z");
        expect(entities[0].properties.custom).toBe(100);
    });

    test("handles missing properties definition", () => {
        const data = {
            features: [
                {
                    geometry: { type: "Point", coordinates: [174, -36] },
                    properties: {}
                }
            ]
        };

        const entities = mapGeoJsonToEntities(data, {
            id: "id",
            latitude: "geometry.coordinates[1]",
            longitude: "geometry.coordinates[0]",
        }, "plugin1");

        expect(entities).toHaveLength(1);
        expect(entities[0].properties).toEqual({});
        expect(entities[0].id).toBe("plugin1-0"); // fallback to index
    });

    test("handles asNumber edge cases (null, non-finite)", () => {
        const data = {
            features: [
                {
                    id: "feat-2",
                    geometry: { type: "Point", coordinates: [174, -36] },
                    properties: { speed: null, heading: "NaN", alt: "Infinity" }
                }
            ]
        };

        const entities = mapGeoJsonToEntities(data, {
            id: "id",
            latitude: "geometry.coordinates[1]",
            longitude: "geometry.coordinates[0]",
            speed: "properties.speed",
            heading: "properties.heading",
            altitude: "properties.alt"
        }, "plugin1");

        expect(entities).toHaveLength(1);
        expect(entities[0].speed).toBeUndefined(); // null -> undefined
        expect(entities[0].heading).toBeUndefined(); // NaN -> undefined
        expect(entities[0].altitude).toBeUndefined(); // Infinity -> undefined
    });

    test("handles parseTimestamp edge cases (invalid string, fallback)", () => {
        const data = {
            features: [
                {
                    geometry: { type: "Point", coordinates: [174, -36] },
                    properties: { time1: "invalid-date", time2: null }
                }
            ]
        };

        const entities = mapGeoJsonToEntities(data, {
            id: "id",
            latitude: "geometry.coordinates[1]",
            longitude: "geometry.coordinates[0]",
            timestamp: "properties.time1"
        }, "plugin1");

        expect(entities).toHaveLength(1);
        // Invalid string falls back to current date, we just check it's a valid date
        expect(entities[0].timestamp).toBeInstanceOf(Date);
        expect(isNaN(entities[0].timestamp.getTime())).toBe(false);

        const entities2 = mapGeoJsonToEntities(data, {
            id: "id",
            latitude: "geometry.coordinates[1]",
            longitude: "geometry.coordinates[0]",
            timestamp: "properties.time2"
        }, "plugin1");

        expect(entities2).toHaveLength(1);
        expect(entities2[0].timestamp).toBeInstanceOf(Date);
        expect(isNaN(entities2[0].timestamp.getTime())).toBe(false);
    });
});
