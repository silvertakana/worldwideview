/**
 * Tests for auth-client.ts — base-URL resolution and the Better Auth client.
 *
 * The rule under test is the one that fixes sign-in on 127.0.0.1: the auth
 * client always talks to the host the page is served from. A configured
 * NEXT_PUBLIC_APP_URL is honoured only when its host matches the page host —
 * otherwise the request would be cross-origin, the auth server would reject it,
 * and any cookie would land on a host the browser is not using.
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

/** Origin jsdom serves this test file from — used by the module-level tests. */
const PAGE_ORIGIN = window.location.origin;

// Assigning undefined to process.env stores the string "undefined", so an
// originally-unset variable must be restored by deleting it.
const ENV_ORIGINALS: Record<string, string | undefined> = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_AUTH_BASE_URL: process.env.NEXT_PUBLIC_AUTH_BASE_URL,
};

function restoreEnv(): void {
    for (const [name, original] of Object.entries(ENV_ORIGINALS)) {
        if (original === undefined) delete process.env[name];
        else process.env[name] = original;
    }
}

/** Import the module with a clean cache so resolveBaseUrl() runs again. */
async function loadModule() {
    mockCreateAuthClient.mockReturnValue({
        signIn: { email: vi.fn() },
        signUp: { email: vi.fn() },
        signOut: vi.fn(),
        useSession: vi.fn(),
    });
    vi.resetModules();
    return import("@/lib/auth-client");
}

function baseUrlPassedToClient(): string {
    const callArg = mockCreateAuthClient.mock.calls[0]?.[0] ?? {};
    return callArg.baseURL;
}

afterEach(() => {
    vi.clearAllMocks();
    restoreEnv();
    vi.resetModules();
});

describe("resolveAuthBaseUrl", () => {
    it("uses the page origin when no URL is configured", async () => {
        const { resolveAuthBaseUrl } = await import("@/lib/auth-client");
        const result = resolveAuthBaseUrl({ pageOrigin: "http://127.0.0.1:3000" });
        expect(result.baseURL).toBe("http://127.0.0.1:3000");
        expect(result.source).toBe("page-origin");
    });

    it("uses the page origin when NEXT_PUBLIC_APP_URL names a different host", async () => {
        const { resolveAuthBaseUrl } = await import("@/lib/auth-client");
        // The reported defect: app opened at 127.0.0.1, config says localhost.
        const result = resolveAuthBaseUrl({
            pageOrigin: "http://127.0.0.1:3000",
            configuredUrl: "http://localhost:3000",
        });
        expect(result.baseURL).toBe("http://127.0.0.1:3000");
        expect(result.source).toBe("page-origin");
        expect(result.ignoredConfiguredUrl).toBe("http://localhost:3000");
    });

    it("honours a configured URL whose host matches the page host", async () => {
        const { resolveAuthBaseUrl } = await import("@/lib/auth-client");
        const result = resolveAuthBaseUrl({
            pageOrigin: "https://cloud-wwv.dev",
            configuredUrl: "https://cloud-wwv.dev/",
        });
        expect(result.baseURL).toBe("https://cloud-wwv.dev");
        expect(result.source).toBe("configured");
        expect(result.ignoredConfiguredUrl).toBeUndefined();
    });

    it("treats a different port on the same hostname as a mismatch", async () => {
        const { resolveAuthBaseUrl } = await import("@/lib/auth-client");
        const result = resolveAuthBaseUrl({
            pageOrigin: "http://localhost:3000",
            configuredUrl: "http://localhost:3001",
        });
        expect(result.baseURL).toBe("http://localhost:3000");
        expect(result.source).toBe("page-origin");
    });

    it("honours the configured URL when there is no page context (SSR)", async () => {
        const { resolveAuthBaseUrl } = await import("@/lib/auth-client");
        const result = resolveAuthBaseUrl({
            pageOrigin: null,
            configuredUrl: "https://cloud-wwv.dev",
        });
        expect(result.baseURL).toBe("https://cloud-wwv.dev");
        expect(result.source).toBe("configured");
    });

    it("falls back to the local dev default with neither page origin nor config", async () => {
        const { resolveAuthBaseUrl } = await import("@/lib/auth-client");
        const result = resolveAuthBaseUrl({ pageOrigin: null, configuredUrl: null });
        expect(result.baseURL).toBe("http://localhost:3000");
        expect(result.source).toBe("default");
    });

    it("lets NEXT_PUBLIC_AUTH_BASE_URL override the page origin (escape hatch)", async () => {
        const { resolveAuthBaseUrl } = await import("@/lib/auth-client");
        const result = resolveAuthBaseUrl({
            pageOrigin: "http://127.0.0.1:3000",
            configuredUrl: "http://localhost:3000",
            overrideUrl: "https://auth.example.com/",
        });
        expect(result.baseURL).toBe("https://auth.example.com");
        expect(result.source).toBe("override");
    });

    it("ignores an unparseable configured URL and keeps the page origin", async () => {
        const { resolveAuthBaseUrl } = await import("@/lib/auth-client");
        const result = resolveAuthBaseUrl({
            pageOrigin: "http://127.0.0.1:3000",
            configuredUrl: "not a url",
        });
        expect(result.baseURL).toBe("http://127.0.0.1:3000");
    });
});

describe("authClient module", () => {
    it("creates authClient with signIn, signUp, signOut, useSession methods", async () => {
        const mod = await loadModule();
        expect(mod.authClient).toBeDefined();
        expect(typeof mod.authClient.signIn).toBe("object");
        expect(typeof mod.authClient.signUp).toBe("object");
        expect(typeof mod.authClient.signOut).toBe("function");
        expect(typeof mod.authClient.useSession).toBe("function");
    });

    it("uses the page origin when NEXT_PUBLIC_APP_URL names another host", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
        await loadModule();
        expect(baseUrlPassedToClient()).toBe(PAGE_ORIGIN);
    });

    it("uses the page origin when NEXT_PUBLIC_APP_URL is not set", async () => {
        delete process.env.NEXT_PUBLIC_APP_URL;
        await loadModule();
        expect(baseUrlPassedToClient()).toBe(PAGE_ORIGIN);
    });

    it("uses a configured URL that matches the page host, trailing slash stripped", async () => {
        process.env.NEXT_PUBLIC_APP_URL = `${PAGE_ORIGIN}/`;
        await loadModule();
        expect(baseUrlPassedToClient()).toBe(PAGE_ORIGIN);
    });

    it("uses NEXT_PUBLIC_AUTH_BASE_URL when explicitly set", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
        process.env.NEXT_PUBLIC_AUTH_BASE_URL = "https://auth.example.com";
        await loadModule();
        expect(baseUrlPassedToClient()).toBe("https://auth.example.com");
    });

    it("exports getAuthClientUrl helper returning the same baseURL", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
        const mod = await loadModule();
        expect(mod.getAuthClientUrl()).toEqual({ baseURL: PAGE_ORIGIN });
    });
});
