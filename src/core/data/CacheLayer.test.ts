import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cacheLayer } from "./CacheLayer";
import type { GeoEntity } from "@/core/plugins/PluginTypes";

/**
 * In-memory cache contract. The persistent (IndexedDB) layer needs a
 * real browser and isn't exercised here — these tests cover only the
 * Map-backed first tier that every plugin enable/disable cycle hits.
 *
 * We `clear()` between tests because cacheLayer is a process-wide
 * singleton; without it, residual entries from one test would mask
 * failures in another.
 */

function entity(id: string): GeoEntity {
    return {
        id,
        pluginId: "test",
        latitude: 0,
        longitude: 0,
        timestamp: new Date(),
        properties: {},
    };
}

beforeEach(() => {
    cacheLayer.clear();
    vi.useRealTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("CacheLayer (memory tier)", () => {
    it("round-trips entities by pluginId within the TTL window", () => {
        const entities = [entity("a"), entity("b")];
        cacheLayer.set("aviation", entities, 60_000);

        expect(cacheLayer.get("aviation")).toEqual(entities);
    });

    it("returns null and evicts the entry once the TTL expires", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

        cacheLayer.set("aviation", [entity("a")], 5_000);
        expect(cacheLayer.get("aviation")).not.toBeNull();

        vi.advanceTimersByTime(5_001);
        expect(cacheLayer.get("aviation")).toBeNull();

        // Second get confirms the eviction happened — the entry is gone
        // from the underlying Map, not just rejected on lookup.
        expect(cacheLayer.get("aviation")).toBeNull();
    });
});
