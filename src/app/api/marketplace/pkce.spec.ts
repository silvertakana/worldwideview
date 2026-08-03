import {
 describe, it, expect, vi, beforeEach, afterEach
} from "vitest";
import { NextRequest } from "next/server";
import { GET as connectRoute } from "./connect/route";
import { GET as callbackRoute } from "./callback/route";

vi.mock("openid-client", () => ({
    Configuration: vi.fn().mockImplementation(function(this: object) { return this; }),
    randomState: vi.fn(() => "mock-state"),
    randomPKCECodeVerifier: vi.fn(() => "mock-verifier"),
    calculatePKCECodeChallenge: vi.fn(() => "mock-challenge"),
    discoveryRequest: vi.fn(),
    processAuthorizationResponse: vi.fn(),
    validateAuthResponse: vi.fn(),
    authorizationCodeGrant: vi.fn().mockResolvedValue({ access_token: "mock-token" })
}));

vi.mock("@/lib/auth/encryption", () => ({
    encryptCredential: vi.fn().mockResolvedValue({
        version: 1,
        salt: "mock-salt",
        nonce: "mock-nonce",
        ciphertext: "mock-ciphertext"
    })
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        marketplaceCredential: {
            upsert: vi.fn().mockResolvedValue({})
        }
    }
}));

// Hoisted so the demo-gate tests can set/clear the session value through the
// same mock instance the routes resolve, even after vi.resetModules().
const baSessionMocks = vi.hoisted(() => ({
    getServerSession: vi.fn(),
}));

vi.mock("@/lib/ba-session", () => baSessionMocks);

describe("PKCE Flow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Connect Route", () => {
        it("should generate PKCE parameters and redirect with secure cookies", async () => {
            const req = new NextRequest("https://localhost:3000/api/marketplace/connect");
            const res = await connectRoute(req);

            expect(res.status).toBe(302);

            // Check redirect URL
            const location = res.headers.get("Location");
            expect(location).toContain("response_type=code");
            expect(location).toContain("code_challenge_method=S256");

            // Check cookie flags
            const cookies = res.headers.get("Set-Cookie");
            expect(cookies).toBeDefined();
            expect(cookies).toContain("HttpOnly");
            expect(cookies).toContain("Secure");
            expect(cookies).toContain("SameSite=lax");
            expect(cookies).toContain("Path=/"); // __Host- prefix requires Path=/ per RFC 6265bis
            // Check __Host- prefix if in production (assuming https testing context)
            expect(cookies).toMatch(/__Host-pkce_verifier/);
        });
    });

    describe("Callback Route — redirect-based error handling", () => {
        it("should redirect with ?error=state_mismatch when state does not match", async () => {
            const req = new NextRequest("https://localhost:3000/api/marketplace/callback?state=wrong-state&code=test-code");
            req.cookies.set("__Host-pkce_state", "correct-state");

            const res = await callbackRoute(req);
            expect(res.status).toBe(302);

            const location = res.headers.get("Location");
            expect(location).toContain("error=state_mismatch");
        });

        it("should redirect with ?error=missing_verifier when code verifier is missing", async () => {
            const req = new NextRequest("https://localhost:3000/api/marketplace/callback?state=correct-state&code=test-code");
            req.cookies.set("__Host-pkce_state", "correct-state");
            // code_verifier cookie is intentionally omitted

            const res = await callbackRoute(req);
            expect(res.status).toBe(302);

            const location = res.headers.get("Location");
            expect(location).toContain("error=missing_verifier");
        });

        it("should clear the state cookie after use to prevent replay", async () => {
            const req = new NextRequest("https://localhost:3000/api/marketplace/callback?state=correct-state&code=test-code");
            req.cookies.set("__Host-pkce_state", "correct-state");
            req.cookies.set("__Host-pkce_verifier", "mock-verifier");

            const res = await callbackRoute(req);

            const cookies = res.headers.get("Set-Cookie");
            expect(cookies).toContain("__Host-pkce_state=;");
            expect(cookies).toContain("Max-Age=0");
        });

        it("should redirect with ?connected=true on successful exchange", async () => {
            const req = new NextRequest("https://localhost:3000/api/marketplace/callback?state=correct-state&code=test-code");
            req.cookies.set("__Host-pkce_state", "correct-state");
            req.cookies.set("__Host-pkce_verifier", "mock-verifier");

            const res = await callbackRoute(req);
            expect(res.status).toBe(302);

            const location = res.headers.get("Location");
            expect(location).toContain("connected=true");
        });
    });
});

describe("Demo edition gate", () => {
    beforeEach(async () => {
        // The edition constant is read at module load time, so each test must
        // re-import the route fresh after stubbing NEXT_PUBLIC_WWV_EDITION.
        vi.resetModules();
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("Connect Route", () => {
        it("returns 403 with admin_required error when no session", async () => {
            baSessionMocks.getServerSession.mockResolvedValue(null);
            const { GET: connectRoute } = await import("./connect/route");

            const req = new NextRequest("https://localhost:3000/api/marketplace/connect");
            const res = await connectRoute(req);

            expect(res.status).toBe(403);
            expect(await res.json()).toEqual({ error: "Admin access required on Demo edition" });
        });

        it("returns 403 when session role is not admin", async () => {
            baSessionMocks.getServerSession.mockResolvedValue({
                user: { id: "u1", email: "user@example.com", role: "user" },
                session: { id: "s1", token: "t1" }
            });
            const { GET: connectRoute } = await import("./connect/route");

            const req = new NextRequest("https://localhost:3000/api/marketplace/connect");
            const res = await connectRoute(req);

            expect(res.status).toBe(403);
            expect(await res.json()).toEqual({ error: "Admin access required on Demo edition" });
        });

        it("proceeds to PKCE redirect when demo admin session", async () => {
            baSessionMocks.getServerSession.mockResolvedValue({
                user: { id: "u1", email: "admin@example.com", role: "admin" },
                session: { id: "s1", token: "t1" }
            });
            const { GET: connectRoute } = await import("./connect/route");

            const req = new NextRequest("https://localhost:3000/api/marketplace/connect");
            const res = await connectRoute(req);

            expect(res.status).toBe(302);

            const location = res.headers.get("Location");
            expect(location).toContain("response_type=code");
            expect(location).toContain("code_challenge_method=S256");
        });
    });

    describe("Callback Route", () => {
        it("redirects with error=admin_required when no session", async () => {
            baSessionMocks.getServerSession.mockResolvedValue(null);
            const { GET: callbackRoute } = await import("./callback/route");

            const req = new NextRequest("https://localhost:3000/api/marketplace/callback?state=test&code=test-code");
            const res = await callbackRoute(req);

            expect(res.status).toBe(302);

            const location = res.headers.get("Location");
            expect(location).toContain("error=admin_required");
        });

        it("redirects with error=admin_required when session role is not admin", async () => {
            baSessionMocks.getServerSession.mockResolvedValue({
                user: { id: "u1", email: "user@example.com", role: "user" },
                session: { id: "s1", token: "t1" }
            });
            const { GET: callbackRoute } = await import("./callback/route");

            const req = new NextRequest("https://localhost:3000/api/marketplace/callback?state=test&code=test-code");
            const res = await callbackRoute(req);

            expect(res.status).toBe(302);

            const location = res.headers.get("Location");
            expect(location).toContain("error=admin_required");
        });

        it("proceeds past the gate for demo admin (state_mismatch without PKCE cookies)", async () => {
            baSessionMocks.getServerSession.mockResolvedValue({
                user: { id: "u1", email: "admin@example.com", role: "demo-admin" },
                session: { id: "s1", token: "t1" }
            });
            const { GET: callbackRoute } = await import("./callback/route");

            const req = new NextRequest("https://localhost:3000/api/marketplace/callback?state=test&code=test-code");
            const res = await callbackRoute(req);

            expect(res.status).toBe(302);

            const location = res.headers.get("Location");
            expect(location).toContain("error=state_mismatch");
            expect(location).not.toContain("admin_required");
        });
    });
});
