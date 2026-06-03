import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    writeGlobeState,
    readGlobeState,
    readActiveSessions,
    globeStateKey,
    globeSessionsKey,
} from "./globeStateStore";
import { redis } from "@/lib/redis";

vi.mock("@/lib/redis", () => ({
    redis: {
        set: vi.fn(),
        get: vi.fn(),
        zadd: vi.fn(),
        zrange: vi.fn(),
        zrem: vi.fn(),
    },
}));

const mockRedis = vi.mocked(redis);

beforeEach(() => {
    vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

describe("globeStateKey", () => {
    it("returns 'globe:state:{userId}:{sessionId}'", () => {
        expect(globeStateKey("u1", "s1")).toBe("globe:state:u1:s1");
    });
});

describe("globeSessionsKey", () => {
    it("returns 'globe:sessions:{userId}'", () => {
        expect(globeSessionsKey("u1")).toBe("globe:sessions:u1");
    });
});

// ---------------------------------------------------------------------------
// writeGlobeState (RSRC-01)
// ---------------------------------------------------------------------------

describe("writeGlobeState (RSRC-01)", () => {
    const fakeSnapshot = {
        viewport: { lat: 37.7, lon: -122.4, altitude: 500000, heading: 0, pitch: -90, roll: 0 },
        layers: { aviation: { enabled: true, entityCount: 5, loading: false } },
        timeline: {
            currentTime: "2026-01-15T12:00:00.000Z",
            timeWindow: "24h",
            isPlaybackMode: false,
            playbackTime: 1737000000000,
            playbackSpeed: 1,
        },
        selectedEntity: null,
        lastUpdate: Date.now(),
    };

    it("calls redis.set with the state key, JSON-serialized snapshot, and EX 30 TTL", async () => {
        mockRedis.set.mockResolvedValue("OK");
        mockRedis.zadd.mockResolvedValue(1);

        await writeGlobeState("u1", "s1", fakeSnapshot);

        expect(mockRedis.set).toHaveBeenCalledWith(
            "globe:state:u1:s1",
            JSON.stringify(fakeSnapshot),
            "EX",
            30,
        );
    });

    it("calls redis.zadd with sessions key, a numeric score, and sessionId", async () => {
        mockRedis.set.mockResolvedValue("OK");
        mockRedis.zadd.mockResolvedValue(1);

        await writeGlobeState("u1", "s1", fakeSnapshot);

        const [key, score, member] = mockRedis.zadd.mock.calls[0] as [string, number, string];
        expect(key).toBe("globe:sessions:u1");
        expect(typeof score).toBe("number");
        expect(member).toBe("s1");
    });

    it("resolves (fire-and-forget) even when redis.set rejects", async () => {
        mockRedis.set.mockRejectedValue(new Error("Redis connection refused"));
        mockRedis.zadd.mockResolvedValue(1);

        await expect(writeGlobeState("u1", "s1", fakeSnapshot)).resolves.not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// readGlobeState (RSRC-02)
// ---------------------------------------------------------------------------

describe("readGlobeState (RSRC-02)", () => {
    const storedSnapshot = {
        viewport: { lat: 10, lon: 20, altitude: 100000, heading: 0, pitch: -90, roll: 0 },
        layers: {},
        timeline: {
            currentTime: "2026-01-15T12:00:00.000Z",
            timeWindow: "1h",
            isPlaybackMode: false,
            playbackTime: 1737000000000,
            playbackSpeed: 1,
        },
        selectedEntity: null,
        lastUpdate: 1737000000000,
    };

    it("returns the parsed snapshot when redis.get resolves a JSON string", async () => {
        mockRedis.get.mockResolvedValue(JSON.stringify(storedSnapshot));

        const result = await readGlobeState("u1", "s1");

        expect(result).toEqual(storedSnapshot);
    });

    it("returns null when redis.get resolves null (key expired or not found)", async () => {
        mockRedis.get.mockResolvedValue(null);

        const result = await readGlobeState("u1", "s1");

        expect(result).toBeNull();
    });

    it("queries the correct key", async () => {
        mockRedis.get.mockResolvedValue(null);

        await readGlobeState("u1", "s1");

        expect(mockRedis.get).toHaveBeenCalledWith("globe:state:u1:s1");
    });
});

// ---------------------------------------------------------------------------
// readActiveSessions (RSRC-03)
// ---------------------------------------------------------------------------

describe("readActiveSessions (RSRC-03)", () => {
    it("returns only sessions whose score is within the 45s staleness threshold", async () => {
        const now = Date.now();
        const freshScore = now;
        const staleScore = now - 60_000; // 60s ago — beyond the 45s threshold

        // ioredis WITHSCORES returns flat interleaved [member, score, member, score, ...]
        mockRedis.zrange.mockResolvedValue([
            "fresh",
            String(freshScore),
            "stale",
            String(staleScore),
        ]);
        mockRedis.zrem.mockResolvedValue(1);

        const sessions = await readActiveSessions("u1");

        const ids = sessions.map((s) => s.sessionId);
        expect(ids).toContain("fresh");
        expect(ids).not.toContain("stale");
    });

    it("each entry has { sessionId, lastSeen } shape", async () => {
        const now = Date.now();
        mockRedis.zrange.mockResolvedValue(["sess-a", String(now)]);
        mockRedis.zrem.mockResolvedValue(0);

        const sessions = await readActiveSessions("u1");

        expect(sessions).toHaveLength(1);
        expect(sessions[0]).toHaveProperty("sessionId", "sess-a");
        expect(sessions[0]).toHaveProperty("lastSeen");
        expect(typeof sessions[0].lastSeen).toBe("number");
    });

    it("returns empty array when no sessions exist", async () => {
        mockRedis.zrange.mockResolvedValue([]);

        const sessions = await readActiveSessions("u1");

        expect(sessions).toEqual([]);
    });

    it("scopes the ZSET query to the correct sessions key", async () => {
        mockRedis.zrange.mockResolvedValue([]);

        await readActiveSessions("u1");

        expect(mockRedis.zrange).toHaveBeenCalledWith(
            "globe:sessions:u1",
            expect.anything(),
            expect.anything(),
            expect.anything(),
        );
    });
});
