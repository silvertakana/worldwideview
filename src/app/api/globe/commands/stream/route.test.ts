/**
 * RED tests for GET /api/globe/commands/stream (Phase 19b Wave 0).
 *
 * These tests lock the SSE streaming route contract. The route file does not
 * exist yet -- the import below will fail with module-not-found (correct RED state).
 *
 *   SSE-01  No auth -> 401
 *   SSE-02  Demo edition -> 403 (gate fires BEFORE auth)
 *   SSE-03  Invalid sessionId format -> 400
 *   SSE-04  Missing sessionId -> 400
 *   SSE-05  Valid auth + valid sessionId -> 200 with SSE headers
 *   SSE-06  Commands from drainGlobeCommands appear as SSE data events
 *   SSE-07  Keepalive comment ':keepalive' sent approximately every 15 seconds
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";

// This import will fail (RED) until Wave 1 creates the route implementation.
import { GET } from "./route";

// ---------------------------------------------------------------------------
// Hoisted mock functions
// ---------------------------------------------------------------------------

const {
    mockGetSession,
    mockAuthApiKey,
    mockDrain,
    mockStreamCheck,
    mockGetClientIp,
} = vi.hoisted(() => ({
    mockGetSession: vi.fn<() => Promise<Session | null>>(),
    mockAuthApiKey: vi.fn(),
    mockDrain: vi.fn(),
    mockStreamCheck: vi.fn(),
    mockGetClientIp: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
    auth: mockGetSession,
}));

vi.mock("@/lib/apiKeyAuth", () => ({
    authenticateApiKey: mockAuthApiKey,
}));

vi.mock("@/lib/globeCommandQueue", () => ({
    drainGlobeCommands: mockDrain,
}));

vi.mock("@/lib/rateLimiters", () => ({
    globeCommandsStreamLimiter: { check: mockStreamCheck },
    getClientIp: mockGetClientIp,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SESSION_ID = "a0000000-0000-0000-0000-000000000001";

function makeRequest(sessionId?: string, bearer?: string): Request {
    const url = sessionId
        ? `http://localhost/api/globe/commands/stream?sessionId=${sessionId}`
        : "http://localhost/api/globe/commands/stream";
    const headers: Record<string, string> = {};
    if (bearer) headers["authorization"] = `Bearer ${bearer}`;
    return new Request(url, { method: "GET", headers });
}

/** Reads all available bytes from a ReadableStream within maxMs. */
async function collectStreamChunks(response: Response, maxMs = 100): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return "";
    const decoder = new TextDecoder();
    let result = "";
    const deadline = Date.now() + maxMs;
    try {
        while (Date.now() < deadline) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) result += decoder.decode(value, { stream: true });
        }
    } finally {
        reader.releaseLock();
    }
    return result;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.resetAllMocks();
    mockGetSession.mockResolvedValue(null);
    mockAuthApiKey.mockResolvedValue(null);
    mockDrain.mockResolvedValue([]);
    mockStreamCheck.mockReturnValue(null); // not rate-limited
    mockGetClientIp.mockReturnValue("127.0.0.1");
});

afterEach(() => {
    vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// SSE-01: no auth -> 401
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands/stream -- 401 when unauthenticated (SSE-01)", () => {
    it("returns 401 when neither session nor Bearer key is present", async () => {
        const req = makeRequest(VALID_SESSION_ID);
        const res = await GET(req);

        expect(res.status).toBe(401);
        expect(mockDrain).not.toHaveBeenCalled();
    });

    it("returns 401 when session is null and apiKey auth returns null", async () => {
        mockGetSession.mockResolvedValue(null);
        mockAuthApiKey.mockResolvedValue(null);

        const req = makeRequest(VALID_SESSION_ID, "invalid.token");
        const res = await GET(req);

        expect(res.status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// SSE-02: demo edition -> 403 (BEFORE auth)
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands/stream -- 403 in demo edition (SSE-02)", () => {
    it("returns 403 when edition is demo, before attempting auth", async () => {
        // The route must check isDemo first -- mockGetSession should NOT be called.
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");

        const req = makeRequest(VALID_SESSION_ID);
        const res = await GET(req);

        expect(res.status).toBe(403);
        // Auth must NOT have been called -- demo gate is pre-auth
        expect(mockGetSession).not.toHaveBeenCalled();
        expect(mockAuthApiKey).not.toHaveBeenCalled();

        vi.unstubAllEnvs();
    });
});

// ---------------------------------------------------------------------------
// SSE-03: invalid sessionId format -> 400
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands/stream -- 400 for invalid sessionId (SSE-03)", () => {
    beforeEach(() => {
        mockAuthApiKey.mockResolvedValue({ userId: "u1", keyId: "k1" });
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

// ---------------------------------------------------------------------------
// SSE-04: missing sessionId -> 400
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands/stream -- 400 for missing sessionId (SSE-04)", () => {
    it("returns 400 when sessionId query param is absent", async () => {
        mockAuthApiKey.mockResolvedValue({ userId: "u1", keyId: "k1" });

        const req = makeRequest(undefined, "wwv_valid.token");
        const res = await GET(req);

        expect(res.status).toBe(400);
        expect(mockDrain).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// SSE-05: valid auth + valid sessionId -> 200 with SSE headers
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands/stream -- 200 with SSE headers (SSE-05)", () => {
    beforeEach(() => {
        mockGetSession.mockResolvedValue({
            user: { id: "u1", name: "Test User", email: "test@example.com" },
            expires: "2099-01-01",
        } as Session);
        mockDrain.mockResolvedValue([]);
    });

    it("returns 200", async () => {
        const req = makeRequest(VALID_SESSION_ID);
        const res = await GET(req);

        expect(res.status).toBe(200);
    });

    it("sets Content-Type: text/event-stream", async () => {
        const req = makeRequest(VALID_SESSION_ID);
        const res = await GET(req);

        expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    });

    it("sets Cache-Control: no-cache", async () => {
        const req = makeRequest(VALID_SESSION_ID);
        const res = await GET(req);

        expect(res.headers.get("Cache-Control")).toBe("no-cache");
    });

    it("sets X-Accel-Buffering: no (disables nginx buffering)", async () => {
        const req = makeRequest(VALID_SESSION_ID);
        const res = await GET(req);

        expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    });
});

// ---------------------------------------------------------------------------
// SSE-06: commands from drainGlobeCommands appear as SSE data events
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands/stream -- commands pushed as SSE events (SSE-06)", () => {
    it("includes command JSON as a 'data: ...' SSE event line", async () => {
        vi.useFakeTimers();

        mockGetSession.mockResolvedValue({
            user: { id: "u1", name: "Test User", email: "test@example.com" },
            expires: "2099-01-01",
        } as Session);

        // First call returns a command; subsequent calls return empty
        mockDrain
            .mockResolvedValueOnce([{ type: "pan", lat: 1, lon: 2, alt: 3 }])
            .mockResolvedValue([]);

        const req = makeRequest(VALID_SESSION_ID);
        const res = await GET(req);

        expect(res.status).toBe(200);

        // Advance time slightly so the first poll loop iteration executes
        await vi.runAllTimersAsync();

        const text = await collectStreamChunks(res, 50);

        // SSE data line must be present
        expect(text).toContain("data: ");
        // Must end event with double newline (SSE spec)
        expect(text).toContain("\n\n");
        // The JSON payload must contain the command type
        expect(text).toContain('"pan"');
    });
});

// ---------------------------------------------------------------------------
// SSE-07: keepalive comment sent every ~15 seconds
// ---------------------------------------------------------------------------

describe("GET /api/globe/commands/stream -- keepalive comment every 15s (SSE-07)", () => {
    it("includes ':keepalive' comment after 16 seconds", async () => {
        vi.useFakeTimers();

        mockGetSession.mockResolvedValue({
            user: { id: "u1", name: "Test User", email: "test@example.com" },
            expires: "2099-01-01",
        } as Session);
        mockDrain.mockResolvedValue([]);

        const req = makeRequest(VALID_SESSION_ID);
        const res = await GET(req);

        expect(res.status).toBe(200);

        // Advance past one keepalive interval (15s)
        await vi.advanceTimersByTimeAsync(16_000);

        const text = await collectStreamChunks(res, 50);

        expect(text).toContain(":keepalive");
    });
});
