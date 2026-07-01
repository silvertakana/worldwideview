/**
 * Tests for ba-session.ts — Better Auth server-side session helpers.
 *
 * Verifies:
 *  1. getServerSession() returns session when valid cookie is present
 *  2. getServerSession() returns null when no cookie is present
 *  3. getServerSession() returns null when cookies contain malformed/expired data
 *  4. requireSession() returns userId for valid session
 *  5. requireSession() returns 401 NextResponse when session is null
 *  6. Module exports getServerSession and requireSession as named exports
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextResponse } from "next/server";


// ---------------------------------------------------------------------------
// Hoisted mocks — must be before vi.mock() calls
// ---------------------------------------------------------------------------
const { mockGetSession, mockHeaders } = vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockHeaders: vi.fn(),
}));

vi.mock("next/headers", () => ({
    headers: mockHeaders,
}));

vi.mock("@/lib/better-auth", () => ({
    auth: {
        api: {
            getSession: mockGetSession,
        },
    },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { getServerSession, requireSession } from "./ba-session";

describe("getServerSession", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHeaders.mockResolvedValue(new Headers({ cookie: "better-auth.session_token=valid-token" }));
    });

    it("returns session when valid Better Auth cookie is present", async () => {
        const mockSession = {
            user: { id: "user-1", email: "test@example.com", name: "Test User" },
            session: { id: "sess-1", token: "valid-token" },
        };
        mockGetSession.mockResolvedValue(mockSession);

        const result = await getServerSession();
        expect(result).toEqual(mockSession);
    });

    it("returns null when no auth cookie is present", async () => {
        mockHeaders.mockResolvedValue(new Headers());
        mockGetSession.mockResolvedValue(null);

        const result = await getServerSession();
        expect(result).toBeNull();
    });

    it("returns null when cookie is expired or malformed", async () => {
        mockHeaders.mockResolvedValue(new Headers({ cookie: "better-auth.session_token=expired-token" }));
        mockGetSession.mockResolvedValue(null);

        const result = await getServerSession();
        expect(result).toBeNull();
    });

    it("calls auth.api.getSession with headers from next/headers", async () => {
        const mockHeadersObj = new Headers({ cookie: "better-auth.session_token=valid-token" });
        mockHeaders.mockResolvedValue(mockHeadersObj);
        mockGetSession.mockResolvedValue({ user: { id: "user-1" }, session: { id: "sess-1" } });

        await getServerSession();
        expect(mockGetSession).toHaveBeenCalledWith({ headers: mockHeadersObj });
    });
});

describe("requireSession", () => {
    it("returns userId when session is valid", () => {
        const session = {
            user: { id: "user-1", email: "test@example.com", name: "Test" },
            session: { id: "sess-1", token: "tok" },
        };
        const result = requireSession(session);
        expect(result).toEqual({ userId: "user-1" });
    });

    it("returns 401 NextResponse when session is null", () => {
        const result = requireSession(null) as NextResponse;
        expect(result).toBeDefined();
        expect(result.status).toBe(401);
    });

    it("returns 401 NextResponse when session has no user", () => {
        const result = requireSession({ user: null, session: null } as any) as NextResponse;
        expect(result.status).toBe(401);
    });

    it("returns userId with correct type", () => {
        const session = {
            user: { id: "abc-123", email: "user@test.com", name: "User" },
            session: { id: "sess-2", token: "tok" },
        };
        const result = requireSession(session) as { userId: string };
        expect(typeof result.userId).toBe("string");
    });
});

describe("module exports", () => {
    it("exports getServerSession as a named export", () => {
        expect(getServerSession).toBeDefined();
        expect(typeof getServerSession).toBe("function");
    });

    it("exports requireSession as a named export", () => {
        expect(requireSession).toBeDefined();
        expect(typeof requireSession).toBe("function");
    });
});
