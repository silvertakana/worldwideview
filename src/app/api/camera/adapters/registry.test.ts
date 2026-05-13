import { describe, it, expect } from "vitest";
import { resolveSources, ALL_ADAPTERS } from "./registry";

/**
 * `resolveSources` is the input-sanitizer at the top of every
 * /api/camera/traffic and /api/camera/list call. Wrong behaviour here
 * either denies legitimate clients or lets the aggregator hit adapters
 * that aren't registered. Easy to test, high blast radius.
 */

describe("camera adapter registry — resolveSources", () => {
    it("returns every registered adapter id when raw is 'all'", () => {
        const result = resolveSources("all");
        const expected = ALL_ADAPTERS.map((a) => a.id);
        expect(result.sort()).toEqual(expected.sort());
    });

    it("returns every registered adapter id when raw is null (default behaviour)", () => {
        const result = resolveSources(null);
        const expected = ALL_ADAPTERS.map((a) => a.id);
        expect(result.sort()).toEqual(expected.sort());
    });

    it("returns an empty list when raw is 'none' — clients use this to short-circuit", () => {
        expect(resolveSources("none")).toEqual([]);
    });

    it("drops unknown ids from a comma-separated list without erroring", () => {
        const knownId = ALL_ADAPTERS[0]?.id;
        if (!knownId) throw new Error("registry has zero adapters — test precondition broken");

        const result = resolveSources(`${knownId},completely-fake-adapter,${knownId}`);
        expect(result).toContain(knownId);
        expect(result).not.toContain("completely-fake-adapter");
    });
});
