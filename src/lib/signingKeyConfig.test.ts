/**
 * Unit tests for isSigningKeyValid().
 *
 * signingKeyConfig imports `edition` from @/core/edition, which is a module-level
 * constant evaluated at import time. We use vi.resetModules() + vi.stubEnv() and
 * dynamic imports per test so each case gets a fresh module evaluation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    vi.resetModules();
    // Restore env to a clean baseline before each test.
    process.env = { ...ORIGINAL_ENV };
    delete process.env.API_KEY_HMAC_SECRET;
    delete process.env.BETTER_AUTH_SECRET;
});

async function getCheck(): Promise<() => boolean> {
    const mod = await import("./signingKeyConfig");
    return mod.isSigningKeyValid;
}

describe("isSigningKeyValid", () => {
    it("returns true for local edition regardless of missing env vars", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "local");
        const check = await getCheck();
        expect(check()).toBe(true);
    });

    it("returns false for cloud edition when API_KEY_HMAC_SECRET is not set", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "cloud");
        process.env.BETTER_AUTH_SECRET = "some-auth-secret";
        delete process.env.API_KEY_HMAC_SECRET;
        const check = await getCheck();
        expect(check()).toBe(false);
    });

    it("returns false for cloud edition when API_KEY_HMAC_SECRET equals BETTER_AUTH_SECRET", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "cloud");
        process.env.API_KEY_HMAC_SECRET = "shared-secret";
        process.env.BETTER_AUTH_SECRET = "shared-secret";
        const check = await getCheck();
        expect(check()).toBe(false);
    });

    it("returns true for cloud edition when API_KEY_HMAC_SECRET is set and distinct from BETTER_AUTH_SECRET", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "cloud");
        process.env.API_KEY_HMAC_SECRET = "dedicated-hmac-secret-value";
        process.env.BETTER_AUTH_SECRET = "different-auth-secret-value";
        const check = await getCheck();
        expect(check()).toBe(true);
    });
});
