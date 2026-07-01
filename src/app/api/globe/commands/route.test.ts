/**
 * RED test scaffold for GET /api/globe/commands (Phase 19a Wave 0).
 *
 * These tests INTENTIONALLY FAIL because route.ts does not exist yet.
 * They lock the following contracts:
 *
 *   CMD-ROUTE-01  No auth -> 401
 *   CMD-ROUTE-02  NextAuth session -> 200 with { commands: [...] } from drainGlobeCommands
 *   CMD-ROUTE-03  Bearer API key fallback when no session -> 200
 *   CMD-ROUTE-04  userId comes from auth result, NEVER from the query string
 *   CMD-ROUTE-05  sessionId taken from ?sessionId query param, scoped to that tab
 *   CMD-ROUTE-06  missing or malformed sessionId -> 400
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BetterAuthSession } from "@/lib/ba-session";
import { GET } from "./route";
import { getServerSession } from "@/lib/ba-session";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { drainGlobeCommands } from "@/lib/globeCommandQueue";

// ---------------------------------------------------------------------------
// Top-level mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/ba-session", () => ({
    getServerSession: vi.fn(),
}));

vi.mock("@/lib/apiKeyAuth", () => ({
    authenticateApiKey: vi.fn(),
}));

vi.mock("@/lib/globeCommandQueue", () => ({
    drainGlobeCommands: vi.fn(),
}));

// Bypass rate limiting for route unit tests
vi.mock("@/lib/rateLimiters", () => ({
    globeCommandsLimiter: { check: vi.fn().mockReturnValue(null) },
    getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetSession = vi.mocked(getServerSession);
const mockAuthApiKey = vi.mocked(authenticateApiKey);
const mockDrain = vi.mocked(drainGlobeCommands);

function makeRequest(sessionId?: string, bearer?: string): Request {
    const url = sessionId
        ? `http://localhost/api/globe/commands?sessionId=${sessionId}`
        : "http://localhost/api/globe/commands";
    const headers: Record<string, string> = {};
    if (bearer) headers["authorization"] = `Bearer ${bearer}`;
    return new Request(url, { method: "GET", headers });
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.resetAllMocks();
    mockGetSession.mockResolvedValue(null);
    mockAuthApiKey.mockResolvedValue(null);
    mockDrain.mockResolvedValue([]);
});

// Valid UUID-format sessionIds used throughout these tests
const SESS_1 = "a0000000-0000-0000-0000-000000000001";
const SESS_ABC = "b0000000-0000-0000-0000-0000000000ab";
const SESS_TAB = "c0000000-0000-0000-0000-00000000000c";

// ---------------------------------------------------------------------------
// CMD-ROUTE-01: unauthenticated -> 401
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands — 401 when unauthenticated (CMD-ROUTE-01)", () => {
    it("returns 401 when neither session nor Bearer key is present", async () => {
        const req = makeRequest(SESS_1);
        const res = await GET(req);

        expect(res.status).toBe(401);
        expect(mockDrain).not.toHaveBeenCalled();
    });

    it("returns 401 when session is null and api key auth returns null", async () => {
        mockGetSession.mockResolvedValue(null);
        mockAuthApiKey.mockResolvedValue(null);

        const req = makeRequest(SESS_1, "invalid.token");
        const res = await GET(req);

        expect(res.status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// CMD-ROUTE-02: NextAuth session path -> 200 + { commands }
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands — NextAuth session (CMD-ROUTE-02)", () => {
    beforeEach(() => {
        mockGetSession.mockResolvedValue({
            user: { id: "u1", name: "Test User", email: "test@example.com" },
            session: { id: "s1", token: "tok1" },
        } as BetterAuthSession);
        mockDrain.mockResolvedValue([
            { type: "pan", lat: 1, lon: 2, alt: 3 },
        ]);
    });

    it("returns 200", async () => {
        const req = makeRequest(SESS_ABC);
        const res = await GET(req);

        expect(res.status).toBe(200);
    });

    it("returns { commands: [...] } from drainGlobeCommands", async () => {
        const req = makeRequest(SESS_ABC);
        const res = await GET(req);
        const body = await res.json() as { commands: unknown[] };

        expect(body).toHaveProperty("commands");
        expect(Array.isArray(body.commands)).toBe(true);
        expect(body.commands).toHaveLength(1);
    });

    it("calls drainGlobeCommands with userId from session and sessionId from query string", async () => {
        const req = makeRequest(SESS_ABC);
        await GET(req);

        expect(mockDrain).toHaveBeenCalledWith("u1", SESS_ABC);
    });

    it("returns { commands: [] } when queue is empty", async () => {
        mockDrain.mockResolvedValue([]);
        const req = makeRequest(SESS_ABC);
        const res = await GET(req);
        const body = await res.json() as { commands: unknown[] };

        expect(body.commands).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// CMD-ROUTE-03: Bearer API key fallback
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands — Bearer fallback (CMD-ROUTE-03)", () => {
    beforeEach(() => {
        mockGetSession.mockResolvedValue(null);
        mockAuthApiKey.mockResolvedValue({ userId: "api-user", keyId: "key-99" });
        mockDrain.mockResolvedValue([]);
    });

    it("returns 200 when no session but valid Bearer token", async () => {
        const req = makeRequest(SESS_1, "wwv_valid.token");
        const res = await GET(req);

        expect(res.status).toBe(200);
    });

    it("calls drainGlobeCommands with userId from API key auth result", async () => {
        const req = makeRequest(SESS_1, "wwv_valid.token");
        await GET(req);

        expect(mockDrain).toHaveBeenCalledWith("api-user", SESS_1);
    });
});

// ---------------------------------------------------------------------------
// CMD-ROUTE-04: userId always from auth, never from query string
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands — userId source invariant (CMD-ROUTE-04)", () => {
    it("uses the session userId, not any userId in the query string", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "real-user", name: "Alice", email: "alice@example.com" },
            session: { id: "s2", token: "tok2" },
        } as BetterAuthSession);
        mockDrain.mockResolvedValue([]);

        // The URL includes a userId query param that should be ignored
        const req = new Request(
            `http://localhost/api/globe/commands?sessionId=${SESS_1}&userId=injected-user`,
            { method: "GET" }
        );
        await GET(req);

        const [calledUserId] = mockDrain.mock.calls[0] as [string, string];
        expect(calledUserId).toBe("real-user");
        expect(calledUserId).not.toBe("injected-user");
    });
});

// ---------------------------------------------------------------------------
// CMD-ROUTE-05: sessionId from query string
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands — sessionId from query (CMD-ROUTE-05)", () => {
    it("passes the sessionId query param to drainGlobeCommands", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "u1", name: "Test", email: "t@t.com" },
            session: { id: "s3", token: "tok3" },
        } as BetterAuthSession);
        mockDrain.mockResolvedValue([]);

        const req = makeRequest(SESS_TAB);
        await GET(req);

        const [, calledSessionId] = mockDrain.mock.calls[0] as [string, string];
        expect(calledSessionId).toBe(SESS_TAB);
    });
});

// ---------------------------------------------------------------------------
// CMD-ROUTE-06: missing or malformed sessionId -> 400
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands — invalid sessionId -> 400 (CMD-ROUTE-06)", () => {
    // Use the API key auth path to avoid the NextMiddleware typing quirk on mockGetSession.
    // userId still resolves correctly; the 400 is about sessionId, not identity.
    beforeEach(() => {
        mockAuthApiKey.mockResolvedValue({ userId: "u1", keyId: "k1" });
        mockDrain.mockResolvedValue([]);
    });

    it("returns 400 when sessionId is missing", async () => {
        const req = makeRequest(undefined, "wwv_valid.token");
        const res = await GET(req);

        expect(res.status).toBe(400);
        expect(mockDrain).not.toHaveBeenCalled();
    });

    it("returns 400 when sessionId is not UUID format", async () => {
        const req = makeRequest("not-a-uuid", "wwv_valid.token");
        const res = await GET(req);

        expect(res.status).toBe(400);
        expect(mockDrain).not.toHaveBeenCalled();
    });

    it("returns { error: 'invalid sessionId' } in the body", async () => {
        const req = makeRequest("bad-id", "wwv_valid.token");
        const res = await GET(req);
        const body = await res.json() as { error: string };

        expect(body.error).toBe("invalid sessionId");
    });
});
