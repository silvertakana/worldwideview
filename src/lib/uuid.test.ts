import { describe, it, expect, vi, afterEach } from "vitest";
import { generateUUID } from "./uuid";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateUUID", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("generates a valid RFC 4122 v4 UUID using crypto.randomUUID when available", () => {
        const id = generateUUID();
        expect(id).toMatch(UUID_V4_REGEX);
    });

    it("falls back to crypto.getRandomValues when crypto.randomUUID is not available", () => {
        const originalRandomUUID = crypto.randomUUID;
        // Simulate insecure context (HTTP on LAN) where randomUUID is undefined
        // @ts-expect-error test mock
        crypto.randomUUID = undefined;

        try {
            const id = generateUUID();
            expect(id).toMatch(UUID_V4_REGEX);
        } finally {
            crypto.randomUUID = originalRandomUUID;
        }
    });

    it("throws instead of degrading to Math.random when Web Crypto is unavailable", () => {
        const originalRandomUUID = crypto.randomUUID;
        const originalGetRandomValues = crypto.getRandomValues;
        // @ts-expect-error test mock
        crypto.randomUUID = undefined;
        // @ts-expect-error test mock
        crypto.getRandomValues = undefined;

        try {
            expect(() => generateUUID()).toThrow(/Web Crypto/);
        } finally {
            crypto.randomUUID = originalRandomUUID;
            crypto.getRandomValues = originalGetRandomValues;
        }
    });

    it("generates unique IDs across successive calls", () => {
        const set = new Set<string>();
        for (let i = 0; i < 100; i++) {
            set.add(generateUUID());
        }
        expect(set.size).toBe(100);
    });
});