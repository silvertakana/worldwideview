import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { writeGlobeState } from "@/lib/globeStateStore";

vi.mock("@/lib/ba-session", () => ({
    getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/apiKeyAuth", () => ({
    authenticateApiKey: vi.fn(),
}));

vi.mock("@/lib/globeStateStore", () => ({
    writeGlobeState: vi.fn(),
}));

// Bypass rate limiting so route tests don't need a limiter mock
vi.mock("@/lib/rateLimiters", () => ({
    mcpLimiter: { check: vi.fn().mockReturnValue(null) },
    getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

// Mutable ref so individual tests can toggle the demo edition flag.
// Must be declared with vi.hoisted so it is available when vi.mock is hoisted.
const editionMock = vi.hoisted(() => ({ isDemo: false }));
vi.mock("@/core/edition", () => editionMock);

const mockAuth = vi.mocked(authenticateApiKey);
const mockWrite = vi.mocked(writeGlobeState);

const validSnapshot = {
    viewport: { lat: 37.7, lon: -122.4, altitude: 500000, heading: 0, pitch: -90, roll: 0 },
    layers: {},
    timeline: {
        currentTime: "2026-01-15T12:00:00.000Z",
        timeWindow: "24h",
        isPlaybackMode: false,
        playbackTime: 1737000000000,
        playbackSpeed: 1,
    },
    selectedEntity: null,
    lastUpdate: 1737000000000,
};

function makeRequest(body: unknown): Request {
    return new Request("http://localhost/api/globe/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    editionMock.isDemo = false;
    mockAuth.mockResolvedValue({ userId: "user-1", keyId: "key-1" });
    mockWrite.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// POST /api/globe/state (RSRC-01)
// ---------------------------------------------------------------------------

describe("POST /api/globe/state (RSRC-01)", () => {
    it("returns 200 and calls writeGlobeState with valid auth + body", async () => {
        const req = makeRequest({ sessionId: "sess-abc", snapshot: validSnapshot });
        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(mockWrite).toHaveBeenCalledWith("user-1", "sess-abc", validSnapshot);
    });

    it("returns 401 and does NOT call writeGlobeState when auth returns null", async () => {
        mockAuth.mockResolvedValue(null);

        const req = makeRequest({ sessionId: "sess-abc", snapshot: validSnapshot });
        const res = await POST(req);

        expect(res.status).toBe(401);
        expect(mockWrite).not.toHaveBeenCalled();
    });

    it("returns 400 and does NOT call writeGlobeState when sessionId is missing", async () => {
        const req = makeRequest({ snapshot: validSnapshot });
        const res = await POST(req);

        expect(res.status).toBe(400);
        expect(mockWrite).not.toHaveBeenCalled();
    });

    it("returns 400 when snapshot is missing from body", async () => {
        const req = makeRequest({ sessionId: "sess-abc" });
        const res = await POST(req);

        expect(res.status).toBe(400);
        expect(mockWrite).not.toHaveBeenCalled();
    });

    it("still yields 200 when writeGlobeState rejects (fire-and-forget contract)", async () => {
        mockWrite.mockRejectedValue(new Error("Redis unavailable"));

        const req = makeRequest({ sessionId: "sess-abc", snapshot: validSnapshot });
        const res = await POST(req);

        expect(res.status).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// POST /api/globe/state -- demo edition gate (GAP-01)
// ---------------------------------------------------------------------------

describe("POST /api/globe/state -- demo edition gate", () => {
    it("returns 403 and does NOT call writeGlobeState when isDemo is true", async () => {
        editionMock.isDemo = true;
        const req = makeRequest({ sessionId: "sess-abc", snapshot: validSnapshot });
        const res = await POST(req);
        const body = await res.json();
        expect(res.status).toBe(403);
        expect(body).toEqual({ error: "Not available in demo edition" });
        expect(mockWrite).not.toHaveBeenCalled();
    });
});
