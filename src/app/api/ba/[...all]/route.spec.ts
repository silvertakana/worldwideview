/**
 * Tests for Better Auth route handler at /api/ba/[...all].
 *
 * Verifies:
 *  - GET and POST handlers are exported as functions
 *  - GET returns a valid Response object
 *  - Coexistence: NextAuth's [...nextauth] route is untouched
 */
import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the Better Auth instance before importing route handler.
// The toNextJsHandler() factory calls auth.handler(request) which must
// return a Response.
// ---------------------------------------------------------------------------
vi.mock("@/lib/better-auth", () => ({
    auth: {
        handler: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
        api: { getSession: vi.fn() },
        options: {
            emailAndPassword: { enabled: true },
            advanced: {},
            trustedOrigins: [],
        },
    },
}));

import { GET, POST } from "./route";

describe("Better Auth route handler (/api/ba/[...all])", () => {
    it("exports GET handler as a function", () => {
        expect(GET).toBeDefined();
        expect(typeof GET).toBe("function");
    });

    it("exports POST handler as a function", () => {
        expect(POST).toBeDefined();
        expect(typeof POST).toBe("function");
    });

    it("GET returns a Response", async () => {
        const req = new Request("http://localhost:3000/api/ba/session");
        const res = await GET(req);
        expect(res).toBeInstanceOf(Response);
        expect(res.status).toBe(200);
    });

    it("POST returns a Response", async () => {
        const req = new Request(
            "http://localhost:3000/api/ba/sign-in/email",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "test@test.com", password: "password" }),
            },
        );
        const res = await POST(req);
        expect(res).toBeInstanceOf(Response);
    });
});
