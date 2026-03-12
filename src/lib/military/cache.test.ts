import { describe, it, expect, beforeEach } from "vitest";
import { getCachedMilitaryData, updateMilitaryCache } from "./cache";
import { globalState } from "./state";

describe("Military Cache", () => {
    beforeEach(() => {
        globalState.militaryData = null;
        globalState.militaryTimestamp = 0;
    });

    it("should return null when cache is empty", () => {
        const result = getCachedMilitaryData();
        expect(result).toEqual({ data: null, timestamp: 0 });
    });

    it("should return cached data when available", () => {
        globalState.militaryData = { ac: [], total: 0 };
        globalState.militaryTimestamp = 12345;

        const result = getCachedMilitaryData();
        expect(result).toEqual({
            data: { ac: [], total: 0 },
            timestamp: 12345,
        });
    });

    it("should update cache via updateMilitaryCache", () => {
        const mockData = { ac: [{ hex: "abc123" }], total: 1 };
        updateMilitaryCache(mockData, 99999);

        const result = getCachedMilitaryData();
        expect(result.data).toEqual(mockData);
        expect(result.timestamp).toBe(99999);
    });
});
