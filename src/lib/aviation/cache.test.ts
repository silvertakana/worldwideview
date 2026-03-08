import { describe, it, expect, beforeEach } from 'vitest';
import { getCachedAviationData, updateFileCache } from './cache';
import { globalState } from './state';

describe('Aviation Cache', () => {
    beforeEach(() => {
        globalState.aviationData = null;
        globalState.aviationTimestamp = 0;
    });

    it('should return null when cache is empty', () => {
        const result = getCachedAviationData();
        expect(result).toEqual({ data: null, timestamp: 0 });
    });

    it('should return from memory if available', () => {
        globalState.aviationData = { flights: [] };
        globalState.aviationTimestamp = 12345;

        const result = getCachedAviationData();
        expect(result).toEqual({ data: { flights: [] }, timestamp: 12345 });
    });

    it('updateFileCache should be a safe no-op', () => {
        updateFileCache({ some: 'data' }, 999);
        // Should not throw or have side effects
        const result = getCachedAviationData();
        expect(result).toEqual({ data: null, timestamp: 0 });
    });
});
