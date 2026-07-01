/**
 * SEC-01: getSigningKey() enforcement tests.
 *
 * Each describe block uses vi.resetModules() + vi.doMock() to control
 * the edition and environment independently -- the module-level mocks in
 * apiKeyAuth.test.ts cannot be re-used here because they are static.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        userApiKey: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    // Restore env before each test so mutations do not bleed
    process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
    vi.doUnmock("@/core/edition");
});

async function importGenerateApiKey() {
    // Dynamic import after resetModules + doMock so the edition mock is picked up
    const mod = await import("./apiKeyAuth");
    return mod.generateApiKey;
}

// ---------------------------------------------------------------------------
// Local edition: BETTER_AUTH_SECRET fallback must still work (dev DX)
// ---------------------------------------------------------------------------

describe("SEC-01: local edition -- BETTER_AUTH_SECRET fallback is allowed", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.doMock("@/core/edition", () => ({
            edition: "local",
            isLocal: true,
            isCloud: false,
            isDemo: false,
        }));
    });

    it("succeeds when only BETTER_AUTH_SECRET is set (no API_KEY_HMAC_SECRET)", async () => {
        delete process.env.API_KEY_HMAC_SECRET;
        process.env.BETTER_AUTH_SECRET = "some-auth-secret";

        const generateApiKey = await importGenerateApiKey();
        expect(() => generateApiKey()).not.toThrow();
    });

    it("succeeds when API_KEY_HMAC_SECRET equals BETTER_AUTH_SECRET in local edition", async () => {
        process.env.API_KEY_HMAC_SECRET = "shared-secret";
        process.env.BETTER_AUTH_SECRET = "shared-secret";

        const generateApiKey = await importGenerateApiKey();
        expect(() => generateApiKey()).not.toThrow();
    });

    it("throws only when neither key is set", async () => {
        delete process.env.API_KEY_HMAC_SECRET;
        delete process.env.BETTER_AUTH_SECRET;

        const generateApiKey = await importGenerateApiKey();
        expect(() => generateApiKey()).toThrow("API_KEY_HMAC_SECRET (or BETTER_AUTH_SECRET) must be set");
    });
});

// ---------------------------------------------------------------------------
// Cloud edition: dedicated key required, must differ from BETTER_AUTH_SECRET
// ---------------------------------------------------------------------------

describe("SEC-01: cloud edition -- API_KEY_HMAC_SECRET required and distinct from BETTER_AUTH_SECRET", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.doMock("@/core/edition", () => ({
            edition: "cloud",
            isLocal: false,
            isCloud: true,
            isDemo: false,
        }));
    });

    it("throws when API_KEY_HMAC_SECRET is unset", async () => {
        delete process.env.API_KEY_HMAC_SECRET;
        process.env.BETTER_AUTH_SECRET = "some-auth-secret";

        const generateApiKey = await importGenerateApiKey();
        expect(() => generateApiKey()).toThrow(
            "API_KEY_HMAC_SECRET must be set and distinct from BETTER_AUTH_SECRET in cloud edition",
        );
    });

    it("throws when API_KEY_HMAC_SECRET equals BETTER_AUTH_SECRET", async () => {
        process.env.API_KEY_HMAC_SECRET = "shared-secret";
        process.env.BETTER_AUTH_SECRET = "shared-secret";

        const generateApiKey = await importGenerateApiKey();
        expect(() => generateApiKey()).toThrow(
            "API_KEY_HMAC_SECRET must be set and distinct from BETTER_AUTH_SECRET in cloud edition",
        );
    });

    it("succeeds when API_KEY_HMAC_SECRET is set and differs from BETTER_AUTH_SECRET", async () => {
        process.env.API_KEY_HMAC_SECRET = "dedicated-hmac-key-cloud";
        process.env.BETTER_AUTH_SECRET = "different-auth-secret";

        const generateApiKey = await importGenerateApiKey();
        expect(() => generateApiKey()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Demo edition: same enforcement as cloud (must differ from BETTER_AUTH_SECRET)
// ---------------------------------------------------------------------------

describe("SEC-01: demo edition -- API_KEY_HMAC_SECRET required and distinct", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.doMock("@/core/edition", () => ({
            edition: "demo",
            isLocal: false,
            isCloud: false,
            isDemo: true,
        }));
    });

    it("throws when API_KEY_HMAC_SECRET is unset", async () => {
        delete process.env.API_KEY_HMAC_SECRET;
        process.env.BETTER_AUTH_SECRET = "some-auth-secret";

        const generateApiKey = await importGenerateApiKey();
        expect(() => generateApiKey()).toThrow(
            "API_KEY_HMAC_SECRET must be set and distinct from BETTER_AUTH_SECRET in demo edition",
        );
    });

    it("throws when API_KEY_HMAC_SECRET equals BETTER_AUTH_SECRET", async () => {
        process.env.API_KEY_HMAC_SECRET = "same";
        process.env.BETTER_AUTH_SECRET = "same";

        const generateApiKey = await importGenerateApiKey();
        expect(() => generateApiKey()).toThrow(
            "API_KEY_HMAC_SECRET must be set and distinct from BETTER_AUTH_SECRET in demo edition",
        );
    });

    it("succeeds when API_KEY_HMAC_SECRET is set and differs from BETTER_AUTH_SECRET", async () => {
        process.env.API_KEY_HMAC_SECRET = "dedicated-hmac-key-demo";
        process.env.BETTER_AUTH_SECRET = "different-auth-secret-demo";

        const generateApiKey = await importGenerateApiKey();
        expect(() => generateApiKey()).not.toThrow();
    });
});
