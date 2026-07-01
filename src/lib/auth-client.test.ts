/**
 * Tests for auth-client.ts — Better Auth client SDK instance.
 *
 * Verifies:
 *  1. authClient is an object with signIn, signUp, signOut, useSession methods
 *  2. authClient baseURL reads from env var with localhost fallback
 *  3. getAuthClientUrl() returns the base URL config object
 */
import { describe, it, expect, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockCreateAuthClient } = vi.hoisted(() => ({
    mockCreateAuthClient: vi.fn(),
}));

vi.mock("better-auth/react", () => ({
    createAuthClient: mockCreateAuthClient,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
// We import after setting up env so the module reads it on first load
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

describe("auth-client module", () => {
    afterEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
        vi.resetModules();
    });

    it("creates authClient with signIn, signUp, signOut, useSession methods", async () => {
        mockCreateAuthClient.mockReturnValue({
            signIn: { email: vi.fn() },
            signUp: { email: vi.fn() },
            signOut: vi.fn(),
            useSession: vi.fn(),
        });

        const mod = await import("@/lib/auth-client");
        expect(mod.authClient).toBeDefined();
        expect(typeof mod.authClient.signIn).toBe("object");
        expect(typeof mod.authClient.signUp).toBe("object");
        expect(typeof mod.authClient.signOut).toBe("function");
        expect(typeof mod.authClient.useSession).toBe("function");
    });

    it("creates authClient with baseURL from env var", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://app.wwv.local";
        mockCreateAuthClient.mockReturnValue({ signIn: { email: vi.fn() }, useSession: vi.fn() });

        // Re-import with the env var set
        vi.resetModules();
        const mod = await import("@/lib/auth-client");

        expect(mockCreateAuthClient).toHaveBeenCalled();
        const callArg = mockCreateAuthClient.mock.calls[0][0] || {};
        expect(callArg.baseURL).toBe("https://app.wwv.local");
    });

    it("falls back to localhost:3000 when NEXT_PUBLIC_APP_URL is not set", async () => {
        delete process.env.NEXT_PUBLIC_APP_URL;
        mockCreateAuthClient.mockReturnValue({ signIn: { email: vi.fn() }, useSession: vi.fn() });

        vi.resetModules();
        const mod = await import("@/lib/auth-client");

        expect(mockCreateAuthClient).toHaveBeenCalled();
        const callArg = mockCreateAuthClient.mock.calls[0][0] || {};
        expect(callArg.baseURL).toBe("http://localhost:3000");
    });

    it("exports getAuthClientUrl helper returning baseURL config", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://globe.wwv.local/";
        mockCreateAuthClient.mockReturnValue({ signIn: { email: vi.fn() }, useSession: vi.fn() });

        vi.resetModules();
        const mod = await import("@/lib/auth-client");

        const urlConfig = mod.getAuthClientUrl();
        expect(urlConfig).toBeDefined();
        expect(urlConfig.baseURL).toBe("https://globe.wwv.local");
    });
});
