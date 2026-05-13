import { describe, test, expect } from "vitest";
import { mapJsonToEntities } from "./mapJsonToEntities";

describe("mapJsonToEntities", () => {
    test("handles arrayPath resolution", () => {
        const data = {
            wrapper: {
                items: [
                    { id: 1, lat: 10, lon: 20 }
                ]
            }
        };

        const entities = mapJsonToEntities(data, {
            id: "id",
            latitude: "lat",
            longitude: "lon"
        }, "plugin1", "wrapper.items");

        expect(entities).toHaveLength(1);
        expect(entities[0].id).toBe("plugin1-1");
    });

    test("handles non-array resolution gracefully", () => {
        const data = { wrapper: { items: "not-an-array" } };

        const entities = mapJsonToEntities(data, {
            id: "id",
            latitude: "lat",
            longitude: "lon"
        }, "plugin1", "wrapper.items");

        expect(entities).toEqual([]);
    });

    test("handles asNumber and parseTimestamp edge cases", () => {
        const data = [
            { id: 1, lat: 10, lon: 20, speed: null, alt: "Infinity", time: "invalid-date" }
        ];

        const entities = mapJsonToEntities(data, {
            id: "id",
            latitude: "lat",
            longitude: "lon",
            speed: "speed",
            altitude: "alt",
            timestamp: "time"
        }, "plugin1");

        expect(entities).toHaveLength(1);
        expect(entities[0].speed).toBeUndefined();
        expect(entities[0].altitude).toBeUndefined();
        expect(entities[0].timestamp).toBeInstanceOf(Date);
        expect(isNaN(entities[0].timestamp.getTime())).toBe(false);
    });

    test("skips items missing lat or lon", () => {
        const data = [
            { id: 1, lat: 10 }, // missing lon
            { id: 2, lon: 20 }, // missing lat
            { id: 3, lat: null, lon: 20 }
        ];

        const entities = mapJsonToEntities(data, {
            id: "id",
            latitude: "lat",
            longitude: "lon"
        }, "plugin1");

        expect(entities).toEqual([]);
    });
});
