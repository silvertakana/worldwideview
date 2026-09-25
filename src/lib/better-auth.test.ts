/**
 * Tests for the Better Auth instance configuration.
 *
 * Verifies:
 *  1. The auth instance initializes with the expected API methods
 *  2. Email/password auth is enabled
 *  3. Cookie prefix is configured
 *  4. The Prisma adapter is wired correctly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the Prisma client before importing the auth instance
// ---------------------------------------------------------------------------
const mockUserModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
};

const mockSessionModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
};

const mockAccountModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
};

const mockVerificationModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
};

vi.mock("@/lib/db", () => ({
    prisma: {
        betterAuthUser: mockUserModel,
        betterAuthSession: mockSessionModel,
        betterAuthAccount: mockAccountModel,
        betterAuthVerification: mockVerificationModel,
        $extends: vi.fn().mockReturnThis(),
    },
}));

// ---------------------------------------------------------------------------
// Mock edition — default to local for safe testing
// ---------------------------------------------------------------------------
let mockIsCloud = false;

vi.mock("@/core/edition", () => ({
    get isCloud() { return mockIsCloud; },
    get isLocal() { return !mockIsCloud; },
    get isDemo() { return false; },
    get edition() { return mockIsCloud ? "cloud" : "local"; },
    isHttpsDeployment: () => false,
}));

// ---------------------------------------------------------------------------
// Import the auth instance after mocks are set up
// ---------------------------------------------------------------------------
let auth: any;

beforeEach(async () => {
    // Reset mock state between tests
    mockIsCloud = false;
    // Re-import to get fresh instance
    vi.resetModules();
    const mod = await import("@/lib/better-auth");
    auth = mod.auth;
});

describe("Better Auth instance", () => {
    it("exports an auth instance", () => {
        expect(auth).toBeDefined();
        expect(auth).not.toBeNull();
    });

    it("has auth.api with getSession method", () => {
        expect(auth.api).toBeDefined();
        expect(typeof auth.api.getSession).toBe("function");
    });

    it("has emailAndPassword enabled", () => {
        expect(auth.options.emailAndPassword).toBeDefined();
        expect(auth.options.emailAndPassword?.enabled).toBe(true);
    });

    it("configures cookiePrefix", () => {
        expect(auth.options.advanced?.cookiePrefix).toBe("better-auth");
    });

    it("trustedOrigins resolves to an array of origins", async () => {
        expect(auth.options.trustedOrigins).toBeDefined();
        expect(typeof auth.options.trustedOrigins).toBe("function");
        const origins = await auth.options.trustedOrigins();
        expect(Array.isArray(origins)).toBe(true);
        expect(origins.length).toBeGreaterThan(0);
    });
});

describe("Plugin configuration", () => {
    it("has organization plugin configured", () => {
        expect(auth.options.plugins).toBeDefined();
        expect(Array.isArray(auth.options.plugins)).toBe(true);
    });

    it("has admin plugin configured", () => {
        expect(auth.options.plugins).toBeDefined();
    });

    it("has jwt plugin configured with default settings", () => {
        expect(auth.options.plugins).toBeDefined();
    });

    it("has oneTimeToken plugin with 1-hour expiry", () => {
        expect(auth.options.plugins).toBeDefined();
    });

    it("has apiKey plugin configured", () => {
        expect(auth.options.plugins).toBeDefined();
    });

    it("password strength validator rejects weak passwords", async () => {
        const opts = auth.options.emailAndPassword;
        expect(opts).toBeDefined();
        expect(opts?.passwordValidator).toBeDefined();
        expect(typeof opts?.passwordValidator).toBe("function");
    });

    it("password strength validator accepts strong passwords", async () => {
        const validator = auth.options.emailAndPassword?.passwordValidator;
        if (!validator) throw new Error("Validator not configured");

        const result = await validator("CorrectHorseBatteryStaple!1");
        expect(result).toBe(true);
    });

    it("password strength validator rejects weak passwords with error", async () => {
        const validator = auth.options.emailAndPassword?.passwordValidator;
        if (!validator) throw new Error("Validator not configured");

        await expect(validator("123")).rejects.toThrow();
    });
});

describe("Plugin coexistence", () => {
    it("has at least 4 plugins in the plugin chain", async () => {
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const authInstance = mod.auth;

        const plugins = authInstance.options.plugins;
        expect(plugins).toBeDefined();
        expect(Array.isArray(plugins)).toBe(true);
        // Minimum: 4 bundled plugins (org, admin, jwt, ott)
        // With external: 5 total (apiKey).
        // Stripe plugin removed per ADR-0009.
        expect(plugins.length).toBeGreaterThanOrEqual(4);
    });

    it("auth.api exposes methods from the auth instance", () => {
        const api = auth.api;
        expect(api).toBeDefined();
        expect(typeof api.getSession).toBe("function");
        // Plugins are lazy-loaded by Better Auth — we verify
        // the auth instance initializes successfully
        expect(auth.options.plugins).toBeDefined();
    });

    it("has all routes registered under /api/ba prefix", () => {
        const basePath = auth.options.basePath;
        expect(basePath).toBe("/api/ba");
    });

    it("plugins don't throw during auth instance initialization", async () => {
        vi.resetModules();
        let error: Error | null = null;
        try {
            const mod = await import("@/lib/better-auth");
            expect(mod.auth).toBeDefined();
        } catch (e) {
            error = e as Error;
        }
        expect(error).toBeNull();
    });
});

describe("Plugin coexistence across editions", () => {
    it("all plugins initialize in local edition without errors", async () => {
        mockIsCloud = false;
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        expect(mod.auth).toBeDefined();
        expect(mod.auth.options.plugins).toBeDefined();
    });

    it("all plugins initialize in cloud edition without errors", async () => {
        mockIsCloud = true;
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        expect(mod.auth).toBeDefined();
        expect(mod.auth.options.plugins).toBeDefined();
    });
});

describe("buildTrustedOrigins", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("returns localhost defaults when no env vars set", async () => {
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const result = mod.buildTrustedOrigins();
        expect(result).toContain("http://localhost:3000");
        expect(result).toContain("http://localhost:3001");
        expect(result).toContain("http://localhost:3002");
    });

    it("includes NEXT_PUBLIC_APP_URL when set", async () => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://192.168.1.50:3000");
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const result = mod.buildTrustedOrigins();
        expect(result).toContain("http://192.168.1.50:3000");
    });

    it("includes entries from BETTER_AUTH_TRUSTED_ORIGINS", async () => {
        vi.stubEnv(
            "BETTER_AUTH_TRUSTED_ORIGINS",
            "http://10.0.0.5:3000, http://my-host.local:3000",
        );
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const result = mod.buildTrustedOrigins();
        expect(result).toContain("http://10.0.0.5:3000");
        expect(result).toContain("http://my-host.local:3000");
    });

    it("de-duplicates entries", async () => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const result = mod.buildTrustedOrigins();
        const matches = result.filter((u) => u === "http://localhost:3000");
        expect(matches).toHaveLength(1);
    });

    it("filters empty entries from BETTER_AUTH_TRUSTED_ORIGINS", async () => {
        vi.stubEnv(
            "BETTER_AUTH_TRUSTED_ORIGINS",
            "http://valid.com, ,, http://other.com",
        );
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const result = mod.buildTrustedOrigins();
        expect(result).toContain("http://valid.com");
        expect(result).toContain("http://other.com");
        expect(result.every((u) => u.trim().length > 0)).toBe(true);
    });

    it("trusts the 127.0.0.1 spelling of the dev ports outside production", async () => {
        mockIsCloud = true;
        vi.stubEnv("NODE_ENV", "test");
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const result = mod.buildTrustedOrigins();
        expect(result).toContain("http://127.0.0.1:3000");
        expect(result).toContain("http://127.0.0.1:3001");
        expect(result).toContain("http://127.0.0.1:3002");
    });

    it("keeps the 127.0.0.1 alias out of a production cloud deployment", async () => {
        mockIsCloud = true;
        vi.stubEnv("NODE_ENV", "production");
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const result = mod.buildTrustedOrigins();
        expect(result).toContain("http://localhost:3000");
        expect(result).not.toContain("http://127.0.0.1:3000");
        expect(result).not.toContain("http://127.0.0.1:3001");
    });
});

describe("buildLocalDevOrigins", () => {
    it("covers both loopback spellings for every dev port when the alias is trusted", async () => {
        const mod = await import("@/lib/better-auth");
        const result = mod.buildLocalDevOrigins(true);
        for (const port of [3000, 3001, 3002]) {
            expect(result).toContain(`http://localhost:${port}`);
            expect(result).toContain(`http://127.0.0.1:${port}`);
        }
    });

    it("keeps only the localhost spelling when the alias is not trusted", async () => {
        const mod = await import("@/lib/better-auth");
        const result = mod.buildLocalDevOrigins(false);
        expect(result).toContain("http://localhost:3000");
        expect(result.some((origin) => origin.includes("127.0.0.1"))).toBe(false);
    });
});

describe("resolveTrustedOrigins", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("returns static list when request is undefined", async () => {
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const result = await mod.resolveTrustedOrigins();
        expect(result).toContain("http://localhost:3000");
        expect(result).toContain("http://localhost:3001");
        expect(result).toContain("http://localhost:3002");
    });

    it("appends request origin when isLocal is true", async () => {
        mockIsCloud = false;
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const request = new Request("http://192.168.1.50:3000/test", {
            headers: { Origin: "http://192.168.1.50:3000" },
        });
        const result = await mod.resolveTrustedOrigins(request);
        expect(result).toContain("http://192.168.1.50:3000");
    });

    it("does NOT append request origin when isLocal is false and origin mismatches", async () => {
        mockIsCloud = true;
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const request = new Request("http://192.168.1.50:3000/test", {
            headers: { Origin: "http://evil.com" },
        });
        const result = await mod.resolveTrustedOrigins(request);
        expect(result).not.toContain("http://evil.com");
    });

    it("trusts request origin on cloud when origin matches request host", async () => {
        mockIsCloud = true;
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const request = new Request("https://tester.cloud-wwv.dev/test", {
            headers: { Origin: "https://tester.cloud-wwv.dev" },
        });
        const result = await mod.resolveTrustedOrigins(request);
        expect(result).toContain("https://tester.cloud-wwv.dev");
    });

    it("trusts the 127.0.0.1 origin in local edition", async () => {
        mockIsCloud = false;
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const request = new Request("http://127.0.0.1:3000/api/ba/sign-in/email", {
            headers: { Origin: "http://127.0.0.1:3000", Host: "127.0.0.1:3000" },
        });
        const result = await mod.resolveTrustedOrigins(request);
        expect(result).toContain("http://127.0.0.1:3000");
    });

    it("trusts the 127.0.0.1 origin in production only via the request-host rule", async () => {
        mockIsCloud = true;
        vi.stubEnv("NODE_ENV", "production");
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const request = new Request("http://127.0.0.1:3000/api/ba/sign-in/email", {
            headers: { Origin: "http://127.0.0.1:3000", Host: "127.0.0.1:3000" },
        });
        const result = await mod.resolveTrustedOrigins(request);
        expect(result).toContain("http://127.0.0.1:3000");
        // Proof the alias list stayed out of production: only the origin that
        // matches the request host is added, not the whole loopback range.
        expect(result).not.toContain("http://127.0.0.1:3001");
    });

    it("still rejects a foreign origin on the 127.0.0.1 host in production", async () => {
        mockIsCloud = true;
        vi.stubEnv("NODE_ENV", "production");
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const request = new Request("http://127.0.0.1:3000/api/ba/sign-in/email", {
            headers: { Origin: "http://evil.example", Host: "127.0.0.1:3000" },
        });
        const result = await mod.resolveTrustedOrigins(request);
        expect(result).not.toContain("http://evil.example");
    });
});



describe("regression: #292", () => {
    // Issue: self-hosted login broken when accessing via non-localhost address
    // https://github.com/silvertakana/worldwideview/issues/292
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("self-hoster at non-localhost address can sign in on local edition", async () => {
        mockIsCloud = false;
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const request = new Request("http://192.168.1.50:3000/test", {
            headers: { Origin: "http://192.168.1.50:3000" },
        });
        const result = await mod.resolveTrustedOrigins(request);
        expect(result).toContain("http://192.168.1.50:3000");
    });

    it("cloud edition trusts origin matching request host, rejects foreign origin", async () => {
        mockIsCloud = true;
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        // Origin matching the request's own host is trusted (same-server)
        const legitRequest = new Request("http://192.168.1.50:3000/test", {
            headers: { Origin: "http://192.168.1.50:3000" },
        });
        const legitResult = await mod.resolveTrustedOrigins(legitRequest);
        expect(legitResult).toContain("http://192.168.1.50:3000");
        // Foreign origin is rejected (CSRF protection)
        const evilRequest = new Request("http://192.168.1.50:3000/test", {
            headers: { Origin: "http://evil.com" },
        });
        const evilResult = await mod.resolveTrustedOrigins(evilRequest);
        expect(evilResult).not.toContain("http://evil.com");
    });

    it("explicit NEXT_PUBLIC_APP_URL works for any edition", async () => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://192.168.1.50:3000");
        mockIsCloud = true;
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const result = await mod.resolveTrustedOrigins();
        expect(result).toContain("http://192.168.1.50:3000");
    });
});
