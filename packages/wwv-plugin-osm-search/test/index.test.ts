import { describe, it, expect } from "vitest";
import { OSMSearchPlugin } from "../src/index";

describe("OSMSearchPlugin", () => {
    it("should instantiate with correct id", () => {
        const plugin = new OSMSearchPlugin();
        expect(plugin.id).toBe("osm-search");
        expect(plugin.category).toBe("custom");
    });

    it("should map overpass elements to geo entities", () => {
        const plugin = new OSMSearchPlugin();
        const elements = [
            {
                type: "node",
                id: 123,
                lat: 45.0,
                lon: 90.0,
                tags: { name: "Test Node", amenity: "cafe" }
            }
        ];
        const entities = plugin.mapOverpassToEntities(elements);
        expect(entities.length).toBe(1);
        expect(entities[0].id).toBe("osm-node-123");
        expect(entities[0].latitude).toBe(45.0);
        expect(entities[0].label).toBe("Test Node");
        expect(entities[0].properties.amenity).toBe("cafe");
    });
});
