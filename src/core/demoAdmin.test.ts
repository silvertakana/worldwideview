import {
 describe, it, expect, vi, beforeEach
} from "vitest";

/**
 * Tests for isDemoAdmin and getDemoAdminSecret.
 *
 * Uses vi.stubEnv + dynamic imports to control module-level state
 * (edition constant is set at module load time).
 */

describe("getDemoAdminSecret", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("returns undefined on non-demo editions", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "local");
        vi.stubEnv("WWV_DEMO_ADMIN_SECRET", "secret123");
        const { getDemoAdminSecret } = await import("./edition");
        expect(getDemoAdminSecret()).toBeUndefined();
    });

    it("returns undefined on demo when secret is not set", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        delete process.env.WWV_DEMO_ADMIN_SECRET;
        const { getDemoAdminSecret } = await import("./edition");
        expect(getDemoAdminSecret()).toBeUndefined();
    });

    it("returns the secret on demo when set", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        vi.stubEnv("WWV_DEMO_ADMIN_SECRET", "secret123");
        const { getDemoAdminSecret } = await import("./edition");
        expect(getDemoAdminSecret()).toBe("secret123");
    });

    it("trims whitespace from the secret", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        vi.stubEnv("WWV_DEMO_ADMIN_SECRET", "  secret123  ");
        const { getDemoAdminSecret } = await import("./edition");
        expect(getDemoAdminSecret()).toBe("secret123");
    });
});

describe("isDemoAdmin", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("returns false on non-demo editions even with demo-admin role", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "local");
        const { isDemoAdmin, DEMO_ADMIN_ROLE } = await import("./edition");
        expect(isDemoAdmin({ user: { role: DEMO_ADMIN_ROLE } })).toBe(false);
    });

    it("returns false on demo with null session", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        const { isDemoAdmin } = await import("./edition");
        expect(isDemoAdmin(null)).toBe(false);
    });

    it("returns false on demo with undefined session", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        const { isDemoAdmin } = await import("./edition");
        expect(isDemoAdmin(undefined)).toBe(false);
    });

    it("returns false on demo with wrong role", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        const { isDemoAdmin } = await import("./edition");
        expect(isDemoAdmin({ user: { role: "user" } })).toBe(false);
    });

    it("returns true on demo with demo-admin role", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        const { isDemoAdmin, DEMO_ADMIN_ROLE } = await import("./edition");
        expect(isDemoAdmin({ user: { role: DEMO_ADMIN_ROLE } })).toBe(true);
    });

    it("returns true on demo with the standard admin role", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        const { isDemoAdmin } = await import("./edition");
        expect(isDemoAdmin({ user: { role: "admin" } })).toBe(true);
    });
});
