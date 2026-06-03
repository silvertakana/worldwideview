/**
 * RED tests for the MCP request/response relay (Phase 21 Wave 0).
 *
 * These tests INTENTIONALLY FAIL because src/lib/mcpRelay.ts does not exist yet.
 * Wave 3 creates enqueueToolInvocation, waitForToolResult, and postToolResult.
 *
 * Security invariants encoded (cannot be regressed in later waves):
 *   SEC-01  Every Redis key is scoped {userId}:{sessionId}
 *   SEC-02  waitForToolResult returns a graceful timeout object, never hangs
 *   SEC-03  postToolResult rejects a result whose requestId the session does not own
 *   SEC-04  Arg size is capped (oversize rejected before enqueue)
 *   SEC-05  Result size is capped (oversize rejected on postback)
 *
 * Mock style mirrors globeCommandQueue.test.ts (vi.hoisted + vi.mock on @/lib/redis).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    enqueueToolInvocation,
    waitForToolResult,
    postToolResult,
} from "@/lib/mcpRelay";

// ---------------------------------------------------------------------------
// Mock @/lib/redis
// ---------------------------------------------------------------------------

// vi.mock is hoisted above variable declarations; objects declared with vi.hoisted()
// are accessible inside the factory function.
const { mockRedis, mockMultiChain } = vi.hoisted(() => {
    // Chainable multi() mock: each method returns the chain; exec resolves successfully.
    const mockMultiChain = {
        rpush: vi.fn(),
        expire: vi.fn(),
        set: vi.fn(),
        lrange: vi.fn(),
        del: vi.fn(),
        exec: vi.fn().mockResolvedValue([]),
    };
    mockMultiChain.rpush.mockReturnValue(mockMultiChain);
    mockMultiChain.expire.mockReturnValue(mockMultiChain);
    mockMultiChain.set.mockReturnValue(mockMultiChain);
    mockMultiChain.lrange.mockReturnValue(mockMultiChain);
    mockMultiChain.del.mockReturnValue(mockMultiChain);

    const mockRedis = {
        set: vi.fn(),
        get: vi.fn(),
        rpush: vi.fn(),
        expire: vi.fn(),
        blpop: vi.fn(),
        exists: vi.fn(),
        multi: vi.fn().mockReturnValue(mockMultiChain),
    };
    return { mockRedis, mockMultiChain };
});

vi.mock("@/lib/redis", () => ({
    redis: mockRedis,
}));

// ---------------------------------------------------------------------------
// Helper: extract the first argument of the first call to a mock function
// ---------------------------------------------------------------------------

function allFirstArgs(mockFn: ReturnType<typeof vi.fn>): string[] {
    return (mockFn.mock.calls as unknown[][]).map((c) => c[0] as string);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.resetAllMocks();

    // Restore multi chain fluent API after resetAllMocks() clears mockReturnValue.
    mockMultiChain.rpush.mockReturnValue(mockMultiChain);
    mockMultiChain.expire.mockReturnValue(mockMultiChain);
    mockMultiChain.set.mockReturnValue(mockMultiChain);
    mockMultiChain.lrange.mockReturnValue(mockMultiChain);
    mockMultiChain.del.mockReturnValue(mockMultiChain);
    mockMultiChain.exec.mockResolvedValue([]);
    mockRedis.multi.mockReturnValue(mockMultiChain);

    // Direct-call mocks for blpop, exists, get (not on the multi chain).
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.rpush.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.blpop.mockResolvedValue(null);
    mockRedis.exists.mockResolvedValue(0);
});

// ---------------------------------------------------------------------------
// RELAY-01: enqueueToolInvocation writes to Redis
// ---------------------------------------------------------------------------

describe("enqueueToolInvocation writes session-scoped invocation (RELAY-01)", () => {
    it("calls rpush on the multi chain with a key that includes userId and sessionId", async () => {
        await enqueueToolInvocation("u1", "s1", {
            requestId: "req-abc",
            tool: "aviation__decode_squawk",
            args: { squawk: "7700" },
        });

        // enqueueToolInvocation uses multi().rpush().expire().set().exec() atomically.
        const allKeys = allFirstArgs(mockMultiChain.rpush);
        const scopedKey = allKeys.find((k) => k.includes("u1") && k.includes("s1"));
        expect(scopedKey).toBeDefined();
    });

    it("the enqueued payload contains requestId, tool, and args", async () => {
        await enqueueToolInvocation("u1", "s1", {
            requestId: "req-abc",
            tool: "aviation__decode_squawk",
            args: { squawk: "7700" },
        });

        // Payload is the second argument to chain.rpush(key, json).
        const rpushCalls = mockMultiChain.rpush.mock.calls as unknown[][];
        expect(rpushCalls.length).toBeGreaterThan(0);
        const payloadJson = rpushCalls[0][1] as string;

        expect(payloadJson).toBeDefined();
        const payload: unknown = JSON.parse(payloadJson);
        expect(payload).toMatchObject({
            requestId: "req-abc",
            tool: "aviation__decode_squawk",
        });
    });
});

// ---------------------------------------------------------------------------
// SEC-01: all keys scoped {userId}:{sessionId}
// ---------------------------------------------------------------------------

describe("all Redis keys scoped {userId}:{sessionId} (SEC-01)", () => {
    it("enqueueToolInvocation key contains both userId and sessionId", async () => {
        await enqueueToolInvocation("alice", "sess-X", {
            requestId: "r1",
            tool: "aviation__decode_squawk",
            args: {},
        });

        // Both rpush (queue key) and set (owner key) go through the multi chain.
        const allKeys = [
            ...allFirstArgs(mockMultiChain.rpush),
            ...allFirstArgs(mockMultiChain.set),
        ];
        const scopedKey = allKeys.find((k) => k.includes("alice") && k.includes("sess-X"));
        expect(scopedKey).toBeDefined();
    });

    it("waitForToolResult polls a key that contains userId and sessionId", async () => {
        // Resolve immediately with a result so the function does not block
        mockRedis.blpop.mockResolvedValue(["result:alice:sess-Y:r1", JSON.stringify({ ok: true })]);

        await waitForToolResult("alice", "sess-Y", "r1", 5000);

        const allKeys = [
            ...allFirstArgs(mockRedis.blpop),
            ...allFirstArgs(mockRedis.get),
        ];
        const scopedKey = allKeys.find((k) => k.includes("alice") && k.includes("sess-Y"));
        expect(scopedKey).toBeDefined();
    });

    it("postToolResult writes to a key that contains userId and sessionId", async () => {
        mockRedis.exists.mockResolvedValue(1);

        await postToolResult("u2", "s2", "r2", { data: "ok" });

        // postToolResult uses multi().rpush().expire().exec() atomically.
        const allKeys = allFirstArgs(mockMultiChain.rpush);
        const scopedKey = allKeys.find((k) => k.includes("u2") && k.includes("s2"));
        expect(scopedKey).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// SEC-02: waitForToolResult -- graceful timeout (never hangs)
// ---------------------------------------------------------------------------

describe("waitForToolResult graceful timeout (SEC-02)", () => {
    it("returns a timeout error object when no result appears before the deadline", async () => {
        // blpop returns null (simulates a timeout with a very short deadline)
        mockRedis.blpop.mockResolvedValue(null);
        mockRedis.get.mockResolvedValue(null);

        const result = await waitForToolResult("u1", "s1", "req-timeout", 100);

        expect(result).toBeDefined();
        expect(result.timedOut).toBe(true);
    });

    it("does NOT throw when the deadline passes with no result", async () => {
        mockRedis.blpop.mockResolvedValue(null);
        mockRedis.get.mockResolvedValue(null);

        await expect(
            waitForToolResult("u1", "s1", "req-timeout", 100),
        ).resolves.not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// SEC-03: postToolResult ownership check
// ---------------------------------------------------------------------------

describe("postToolResult rejects unowned requestId (SEC-03)", () => {
    it("rejects a result for a requestId not owned by the caller's session", async () => {
        mockRedis.exists.mockResolvedValue(0);

        const result = await postToolResult("u1", "s1", "foreign-req", { data: "evil" });

        expect(result.rejected).toBe(true);
        expect(mockRedis.rpush).not.toHaveBeenCalled();
        expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it("accepts a result for a requestId the session DOES own", async () => {
        mockRedis.exists.mockResolvedValue(1);

        const result = await postToolResult("u1", "s1", "owned-req", { data: "ok" });

        expect(result.rejected).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// SEC-04: arg size cap
// ---------------------------------------------------------------------------

describe("enqueueToolInvocation arg size cap (SEC-04)", () => {
    it("rejects args whose JSON serialization exceeds the size cap", async () => {
        const oversizeArgs = { payload: "x".repeat(1_024 * 1_024) };

        const result = await enqueueToolInvocation("u1", "s1", {
            requestId: "r-oversize",
            tool: "aviation__decode_squawk",
            args: oversizeArgs,
        });

        expect(result.rejected).toBe(true);
        // Size guard fires before multi() is called -- chain must stay untouched.
        expect(mockRedis.multi).not.toHaveBeenCalled();
        expect(mockMultiChain.rpush).not.toHaveBeenCalled();
    });

    it("accepts args within the size cap", async () => {
        const result = await enqueueToolInvocation("u1", "s1", {
            requestId: "r-normal",
            tool: "aviation__decode_squawk",
            args: { squawk: "7700" },
        });

        expect(result.rejected).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// SEC-05: result size cap
// ---------------------------------------------------------------------------

describe("postToolResult result size cap (SEC-05)", () => {
    it("rejects a result payload that exceeds the size cap", async () => {
        mockRedis.exists.mockResolvedValue(1);

        const oversizeResult = { data: "x".repeat(1_024 * 1_024) };
        const result = await postToolResult("u1", "s1", "r-bigresult", oversizeResult);

        expect(result.rejected).toBe(true);
        expect(mockRedis.rpush).not.toHaveBeenCalled();
        expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it("accepts a result within the size cap", async () => {
        mockRedis.exists.mockResolvedValue(1);

        const result = await postToolResult("u1", "s1", "r-normal", { squawkMeaning: "Emergency" });

        expect(result.rejected).toBe(false);
    });
});
