import { describe, it, expect } from "vitest";
import { resolveDefaultBaseLayerId } from "./mapDefaults";

describe("resolveDefaultBaseLayerId", () => {
    it("defaults to google-3d with a valid browser key (>= 20 chars) and no stored choice", () => {
        expect(resolveDefaultBaseLayerId(null, "a".repeat(20))).toBe("google-3d");
    });

    it("defaults to light-gray with no browser key and no stored choice", () => {
        expect(resolveDefaultBaseLayerId(null, undefined)).toBe("light-gray");
    });

    it("defaults to light-gray with a short browser key (< 20 chars) and no stored choice", () => {
        expect(resolveDefaultBaseLayerId(null, "a".repeat(19))).toBe("light-gray");
        expect(resolveDefaultBaseLayerId(null, "")).toBe("light-gray");
    });

    it("keeps a stored osm choice regardless of key", () => {
        expect(resolveDefaultBaseLayerId("osm", "a".repeat(20))).toBe("osm");
        expect(resolveDefaultBaseLayerId("osm", undefined)).toBe("osm");
    });

    it("keeps a stored google-3d choice regardless of key", () => {
        expect(resolveDefaultBaseLayerId("google-3d", undefined)).toBe("google-3d");
        expect(resolveDefaultBaseLayerId("google-3d", "a".repeat(20))).toBe("google-3d");
    });
});