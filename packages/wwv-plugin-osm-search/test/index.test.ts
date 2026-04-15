import { describe, it, expect } from "vitest";
import { OSMSearchPlugin } from "../src/index";

describe("OSMSearchPlugin", () => {
    it("should instantiate with correct id", () => {
        const plugin = new OSMSearchPlugin();
        expect(plugin.id).toBe("osm-search");
        expect(plugin.category).toBe("custom");
    });
});
