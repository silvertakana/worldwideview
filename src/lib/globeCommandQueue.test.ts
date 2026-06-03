/**
 * Tests for globeCommandQueue (Phase 19a Wave 0, updated for review fixes).
 *
 *   QUEUE-01  enqueueGlobeCommand atomically rpush+expire via multi() chain
 *   QUEUE-02  drainGlobeCommands atomically lranges + dels, returns parsed GlobeCommand[]
 *   QUEUE-03  drainGlobeCommands drops invalid JSON and invalid command shapes silently
 *   QUEUE-04  resolveActiveSessionId returns the newest session within 45s threshold
 *   QUEUE-05  resolveActiveSessionId returns null when all sessions are older than 45s
 *   QUEUE-06  setTimeline validation: invalid timeWindow and non-date currentTime are rejected
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    enqueueGlobeCommand,
    drainGlobeCommands,
    resolveActiveSessionId,
} from "./globeCommandQueue";

// ---------------------------------------------------------------------------
// Mock @/lib/redis
// vi.mock is hoisted above variable declarations, so the mock objects must be
// declared with vi.hoisted() to be accessible inside the factory function.
// ---------------------------------------------------------------------------

const mockExecResult: [[null, string[]], [null, number]] = [
    [null, []],
    [null, 1],
];

const { mockMultiChain, mockRedis } = vi.hoisted(() => {
    const mockMultiChain = {
        lrange: vi.fn().mockReturnThis(),
        del: vi.fn().mockReturnThis(),
        rpush: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn(),
    };
    const mockRedis = {
        rpush: vi.fn(),
        expire: vi.fn(),
        zrange: vi.fn(),
        multi: vi.fn(() => mockMultiChain),
    };
    return { mockMultiChain, mockRedis };
});

vi.mock("@/lib/redis", () => ({
    redis: mockRedis,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import type { GlobeCommand } from "@/core/globe/types/GlobeCommand";
import { isValidGlobeCommand } from "@/core/globe/types/GlobeCommand";

beforeEach(() => {
    vi.resetAllMocks();
    // Re-wire multi chain after reset
    mockMultiChain.lrange.mockReturnThis();
    mockMultiChain.del.mockReturnThis();
    mockMultiChain.rpush.mockReturnThis();
    mockMultiChain.expire.mockReturnThis();
    mockMultiChain.exec.mockResolvedValue(mockExecResult);
    mockRedis.multi.mockReturnValue(mockMultiChain);
});

// ---------------------------------------------------------------------------
// QUEUE-01: enqueueGlobeCommand — atomic multi() path
// ---------------------------------------------------------------------------

describe("enqueueGlobeCommand (QUEUE-01)", () => {
    const panCmd: GlobeCommand = { type: "pan", lat: 1, lon: 2, alt: 3 };

    it("calls multi().rpush(key, json).expire(key, ttl).exec() atomically", async () => {
        await enqueueGlobeCommand("u1", "s1", panCmd);

        expect(mockRedis.multi).toHaveBeenCalledTimes(1);
        expect(mockMultiChain.rpush).toHaveBeenCalledWith(
            "globe:commandqueue:u1:s1",
            JSON.stringify(panCmd),
        );
        expect(mockMultiChain.expire).toHaveBeenCalledWith(
            "globe:commandqueue:u1:s1",
            expect.any(Number),
        );
        expect(mockMultiChain.exec).toHaveBeenCalledTimes(1);
    });

    it("uses a TTL in the range 55-120 seconds", async () => {
        await enqueueGlobeCommand("u1", "s1", panCmd);

        const ttl = (mockMultiChain.expire.mock.calls[0] as [string, number])[1];
        expect(ttl).toBeGreaterThanOrEqual(55);
        expect(ttl).toBeLessThanOrEqual(120);
    });

    it("scopes key to userId and sessionId independently", async () => {
        await enqueueGlobeCommand("alice", "sess-abc", panCmd);

        expect(mockMultiChain.rpush).toHaveBeenCalledWith(
            "globe:commandqueue:alice:sess-abc",
            expect.any(String),
        );
    });

    it("does NOT call rpush or expire directly on redis (atomic path only)", async () => {
        await enqueueGlobeCommand("u1", "s1", panCmd);

        expect(mockRedis.rpush).not.toHaveBeenCalled();
        expect(mockRedis.expire).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// QUEUE-02: drainGlobeCommands -- happy path
// ---------------------------------------------------------------------------

describe("drainGlobeCommands (QUEUE-02)", () => {
    const toggleCmd: GlobeCommand = { type: "toggleLayer", layerId: "ais" };
    const panCmd: GlobeCommand = { type: "pan", lat: 10, lon: 20, alt: 500 };

    it("uses multi().lrange(key, 0, -1).del(key).exec() atomically", async () => {
        mockMultiChain.exec.mockResolvedValue([
            [null, [JSON.stringify(toggleCmd)]],
            [null, 1],
        ]);

        await drainGlobeCommands("u1", "s1");

        expect(mockRedis.multi).toHaveBeenCalledTimes(1);
        expect(mockMultiChain.lrange).toHaveBeenCalledWith(
            "globe:commandqueue:u1:s1",
            0,
            -1,
        );
        expect(mockMultiChain.del).toHaveBeenCalledWith("globe:commandqueue:u1:s1");
        expect(mockMultiChain.exec).toHaveBeenCalledTimes(1);
    });

    it("returns an array of parsed GlobeCommands", async () => {
        mockMultiChain.exec.mockResolvedValue([
            [null, [JSON.stringify(panCmd), JSON.stringify(toggleCmd)]],
            [null, 1],
        ]);

        const result = await drainGlobeCommands("u1", "s1");

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(panCmd);
        expect(result[1]).toEqual(toggleCmd);
    });

    it("returns an empty array when the queue is empty", async () => {
        mockMultiChain.exec.mockResolvedValue([
            [null, []],
            [null, 0],
        ]);

        const result = await drainGlobeCommands("u1", "s1");

        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// QUEUE-03: drainGlobeCommands -- invalid entry filtering
// ---------------------------------------------------------------------------

describe("drainGlobeCommands invalid entry filtering (QUEUE-03)", () => {
    it("silently drops entries that are invalid JSON", async () => {
        mockMultiChain.exec.mockResolvedValue([
            [null, ["not-json{{{", JSON.stringify({ type: "toggleLayer", layerId: "x" })]],
            [null, 1],
        ]);

        const result = await drainGlobeCommands("u1", "s1");

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ type: "toggleLayer", layerId: "x" });
    });

    it("silently drops entries that fail the GlobeCommand shape check", async () => {
        const validCmd: GlobeCommand = { type: "pan", lat: 1, lon: 2, alt: 3 };
        mockMultiChain.exec.mockResolvedValue([
            [
                null,
                [
                    JSON.stringify({ type: "unknown_type" }),
                    JSON.stringify({ type: "pan", lat: "bad" }),
                    JSON.stringify(validCmd),
                ],
            ],
            [null, 1],
        ]);

        const result = await drainGlobeCommands("u1", "s1");

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(validCmd);
    });
});

// ---------------------------------------------------------------------------
// QUEUE-04 / QUEUE-05: resolveActiveSessionId
// ---------------------------------------------------------------------------

describe("resolveActiveSessionId (QUEUE-04 / QUEUE-05)", () => {
    it("returns the newest session whose score is within 45s of Date.now()", async () => {
        const now = Date.now();
        const freshScore = now - 5_000;   // 5s ago -- fresh
        const olderScore = now - 30_000;  // 30s ago -- still fresh

        // ioredis WITHSCORES flat interleaved array: [member, score, ...]
        mockRedis.zrange.mockResolvedValue([
            "sess-old", String(olderScore),
            "sess-new", String(freshScore),
        ]);

        const result = await resolveActiveSessionId("u1");

        // Must return the newest (highest score = most recent)
        expect(result).toBe("sess-new");
    });

    it("queries globe:sessions:{userId} with WITHSCORES", async () => {
        mockRedis.zrange.mockResolvedValue([]);

        await resolveActiveSessionId("u1");

        expect(mockRedis.zrange).toHaveBeenCalledWith(
            "globe:sessions:u1",
            expect.anything(),
            expect.anything(),
            "WITHSCORES",
        );
    });

    it("returns null when the only entry is older than 45s", async () => {
        const now = Date.now();
        const staleScore = now - 60_000; // 60s ago -- stale

        mockRedis.zrange.mockResolvedValue(["sess-stale", String(staleScore)]);

        const result = await resolveActiveSessionId("u1");

        expect(result).toBeNull();
    });

    it("returns null when no sessions exist", async () => {
        mockRedis.zrange.mockResolvedValue([]);

        const result = await resolveActiveSessionId("u1");

        expect(result).toBeNull();
    });

    it("returns null when all sessions are stale", async () => {
        const now = Date.now();
        mockRedis.zrange.mockResolvedValue([
            "sess-a", String(now - 50_000),
            "sess-b", String(now - 90_000),
        ]);

        const result = await resolveActiveSessionId("u1");

        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// QUEUE-06: setTimeline validation -- tightened timeWindow + currentTime checks
// ---------------------------------------------------------------------------

describe("isValidGlobeCommand setTimeline validation (QUEUE-06)", () => {
    it("accepts a valid timeWindow value", () => {
        expect(isValidGlobeCommand({ type: "setTimeline", timeWindow: "24h" })).toBe(true);
        expect(isValidGlobeCommand({ type: "setTimeline", timeWindow: "1h" })).toBe(true);
        expect(isValidGlobeCommand({ type: "setTimeline", timeWindow: "7d" })).toBe(true);
    });

    it("rejects an unrecognised timeWindow string", () => {
        expect(isValidGlobeCommand({ type: "setTimeline", timeWindow: "2d" })).toBe(false);
        expect(isValidGlobeCommand({ type: "setTimeline", timeWindow: "30m" })).toBe(false);
        expect(isValidGlobeCommand({ type: "setTimeline", timeWindow: "" })).toBe(false);
    });

    it("accepts a valid ISO 8601 currentTime string", () => {
        expect(isValidGlobeCommand({ type: "setTimeline", currentTime: "2024-01-15T12:00:00Z" })).toBe(true);
        expect(isValidGlobeCommand({ type: "setTimeline", currentTime: "2024-01-15" })).toBe(true);
    });

    it("rejects a currentTime that is not a parseable date", () => {
        expect(isValidGlobeCommand({ type: "setTimeline", currentTime: "not-a-date" })).toBe(false);
        expect(isValidGlobeCommand({ type: "setTimeline", currentTime: "25h" })).toBe(false);
    });

    it("accepts setTimeline with no optional fields", () => {
        expect(isValidGlobeCommand({ type: "setTimeline" })).toBe(true);
    });

    it("accepts setTimeline with all valid fields", () => {
        expect(isValidGlobeCommand({
            type: "setTimeline",
            currentTime: "2024-06-01T00:00:00Z",
            timeWindow: "6h",
            isPlaybackMode: true,
        })).toBe(true);
    });
});
