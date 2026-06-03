/**
 * @file mcpRelay.ts
 * @description Redis request/response relay for plugin tool invocations (Phase 21 Wave 3 -- PLUG-03).
 *
 * The server enqueues an invocation for the browser to pick up, then waits on a
 * result list using blpop with a deadline. The browser executes the tool and
 * posts the result back via RPUSH. The server returns the result or a graceful
 * timeout to the MCP agent.
 *
 * Redis key layout (all scoped by userId + sessionId):
 *   Invocation queue: mcp:invocations:{userId}:{sessionId}               (RPUSH list)
 *   Invocation owner: mcp:inv-owner:{userId}:{sessionId}:{requestId}     (SET -- ownership record)
 *   Result list:      mcp:result:{userId}:{sessionId}:{requestId}        (RPUSH by browser, BLPOP by server)
 *
 * Server-side wait approach: blpop with a per-request timeout (converted from ms to seconds).
 * This is simpler and more responsive than a poll loop, and avoids busy-waiting.
 * blpop is available on the ioredis client via the extended type cast; it is NOT declared
 * on the narrow RedisClient interface in redis.ts (which is intentionally kept minimal).
 *
 * Security invariants (Wave 0 / SEC-01..05):
 *   SEC-01  All keys scoped {userId}:{sessionId}.
 *   SEC-02  waitForToolResult uses blpop with a bounded deadline; returns a timeout object on expiry. NEVER throws.
 *   SEC-03  postToolResult checks ownership before writing.
 *   SEC-04  Arg payload is size-capped before enqueue.
 *   SEC-05  Result payload is size-capped before write.
 */

import { redis } from "@/lib/redis";
import type { RedisMultiChain } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Extended redis type -- adds exists() and blpop() which are declared in
// ioredis but not in our narrow RedisClient interface. Casting avoids
// modifying redis.ts.
// ---------------------------------------------------------------------------

interface ExtendedRedisClient {
    set(key: string, value: string, exFlag: "EX", ttlSeconds: number): Promise<string | null>;
    get(key: string): Promise<string | null>;
    rpush(key: string, ...values: string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    exists(key: string): Promise<number>;
    /**
     * BLPOP with a per-call timeout in seconds.
     * Returns [key, value] tuple on success, null on timeout.
     * Used for server-side wait on the result list.
     */
    blpop(key: string, timeout: number): Promise<[string, string] | null>;
    multi(): RedisMultiChain;
}

const redisExt = redis as unknown as ExtendedRedisClient;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** TTL for the invocation queue list (seconds). */
const INVOCATION_TTL_SECONDS = 120;

/** TTL for the ownership record key (seconds). */
const OWNER_TTL_SECONDS = 300;

/** TTL for the result list after the browser writes to it (seconds). */
const RESULT_TTL_SECONDS = 120;

/** Maximum allowed byte size for serialized tool args (~64 KB). */
const MAX_ARG_BYTES = 64 * 1024;

/** Maximum allowed byte size for serialized result payload (~512 KB). */
const MAX_RESULT_BYTES = 512 * 1024;

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

function invocationQueueKey(userId: string, sessionId: string): string {
    return `mcp:invocations:${userId}:${sessionId}`;
}

function ownerKey(userId: string, sessionId: string, requestId: string): string {
    return `mcp:inv-owner:${userId}:${sessionId}:${requestId}`;
}

function resultKey(userId: string, sessionId: string, requestId: string): string {
    return `mcp:result:${userId}:${sessionId}:${requestId}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single tool invocation payload stored in the queue. */
export interface ToolInvocation {
    requestId: string;
    tool: string;
    args: Record<string, unknown>;
}

/** Return shape of enqueueToolInvocation and postToolResult. */
export interface RelayOpResult {
    rejected: boolean;
    reason?: string;
}

/** Return shape of waitForToolResult. */
export interface ToolResultOrTimeout {
    timedOut: boolean;
    value?: unknown;
    error?: string;
}

// ---------------------------------------------------------------------------
// enqueueToolInvocation (RELAY-01, SEC-01, SEC-04)
// ---------------------------------------------------------------------------

/**
 * Write a namespaced tool invocation to the session-scoped Redis list.
 * Also writes an ownership record so postToolResult can verify the requestId.
 *
 * Rejects (returns { rejected: true }) if the serialized args exceed MAX_ARG_BYTES.
 */
export async function enqueueToolInvocation(
    userId: string,
    sessionId: string,
    invocation: ToolInvocation,
): Promise<RelayOpResult> {
    const json = JSON.stringify(invocation);
    if (Buffer.byteLength(json, "utf8") > MAX_ARG_BYTES) {
        return { rejected: true, reason: "args payload too large" };
    }

    const qKey = invocationQueueKey(userId, sessionId);
    const oKey = ownerKey(userId, sessionId, invocation.requestId);

    try {
        await redisExt
            .multi()
            .rpush(qKey, json)
            .expire(qKey, INVOCATION_TTL_SECONDS)
            .set(oKey, "1", "EX", OWNER_TTL_SECONDS)
            .exec();
    } catch (err) {
        console.error("[mcpRelay] enqueueToolInvocation failed:", err);
        return { rejected: true, reason: "enqueue failed" };
    }

    return { rejected: false };
}

// ---------------------------------------------------------------------------
// waitForToolResult (SEC-01, SEC-02)
// ---------------------------------------------------------------------------

/**
 * Wait for the browser to post a result by blocking on the result list with blpop.
 * The timeout is the deadlineMs converted to seconds (rounded up, minimum 1s).
 *
 * NEVER throws. Returns { timedOut: true } when blpop returns null (deadline passed).
 *
 * Server-side wait approach: blpop. The ioredis client supports blpop natively;
 * it is accessed via the ExtendedRedisClient cast to avoid widening the narrow
 * RedisClient interface declared in redis.ts.
 */
export async function waitForToolResult(
    userId: string,
    sessionId: string,
    requestId: string,
    deadlineMs: number,
): Promise<ToolResultOrTimeout> {
    const rKey = resultKey(userId, sessionId, requestId);
    const timeoutSeconds = Math.max(1, Math.ceil(deadlineMs / 1000));

    try {
        const reply = await redisExt.blpop(rKey, timeoutSeconds);
        if (reply === null) {
            return { timedOut: true, error: "Plugin tool did not respond before the deadline." };
        }

        // reply is [key, value]; parse the value.
        const raw = reply[1];
        try {
            const parsed: unknown = JSON.parse(raw);
            return { timedOut: false, value: parsed };
        } catch {
            return { timedOut: false, value: raw };
        }
    } catch (err) {
        console.error("[mcpRelay] waitForToolResult failed:", err);
        // Return a graceful error object -- never throw to the caller.
        return { timedOut: true, error: "Plugin tool relay encountered an error." };
    }
}

// ---------------------------------------------------------------------------
// postToolResult (SEC-01, SEC-03, SEC-05)
// ---------------------------------------------------------------------------

/**
 * Write the browser-executed tool result to the session-scoped result list.
 * The server's blpop call on the same key will unblock when this RPUSH fires.
 *
 * Rejects (returns { rejected: true }) when:
 *   - The requestId is not owned by this session (ownership check via EXISTS).
 *   - The serialized result exceeds MAX_RESULT_BYTES.
 */
export async function postToolResult(
    userId: string,
    sessionId: string,
    requestId: string,
    result: unknown,
): Promise<RelayOpResult> {
    // SEC-03: Ownership check -- the requestId must be owned by this session.
    const oKey = ownerKey(userId, sessionId, requestId);
    let owned = false;
    try {
        const existsVal = await redisExt.exists(oKey);
        owned = existsVal === 1;
    } catch (err) {
        console.error("[mcpRelay] postToolResult ownership check failed:", err);
        return { rejected: true, reason: "ownership check error" };
    }

    if (!owned) {
        return { rejected: true, reason: "requestId not owned by this session" };
    }

    // SEC-05: Result size cap.
    const json = JSON.stringify(result);
    if (Buffer.byteLength(json, "utf8") > MAX_RESULT_BYTES) {
        return { rejected: true, reason: "result payload too large" };
    }

    const rKey = resultKey(userId, sessionId, requestId);
    try {
        // RPUSH to the result list; the server's blpop on the same key unblocks.
        await redisExt.multi().rpush(rKey, json).expire(rKey, RESULT_TTL_SECONDS).exec();
    } catch (err) {
        console.error("[mcpRelay] postToolResult write failed:", err);
    }

    return { rejected: false };
}

// ---------------------------------------------------------------------------
// drainToolInvocations
// ---------------------------------------------------------------------------

/**
 * Atomically drain all pending tool invocations for a session.
 * Mirrors drainGlobeCommands from globeCommandQueue.ts.
 */
export async function drainToolInvocations(
    userId: string,
    sessionId: string,
): Promise<ToolInvocation[]> {
    const qKey = invocationQueueKey(userId, sessionId);
    try {
        const results = await redisExt.multi().lrange(qKey, 0, -1).del(qKey).exec();

        const lrangeReply = results[0];
        if (!lrangeReply || lrangeReply[0] !== null) return [];

        const raw = lrangeReply[1];
        if (!Array.isArray(raw)) return [];

        const invocations: ToolInvocation[] = [];
        for (const entry of raw) {
            if (typeof entry !== "string") continue;
            try {
                const parsed: unknown = JSON.parse(entry);
                if (isToolInvocation(parsed)) {
                    invocations.push(parsed);
                }
            } catch {
                // Drop unparseable entries silently.
            }
        }

        return invocations;
    } catch (err) {
        console.error("[mcpRelay] drainToolInvocations failed:", err);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isToolInvocation(value: unknown): value is ToolInvocation {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.requestId === "string" &&
        typeof v.tool === "string" &&
        typeof v.args === "object" &&
        v.args !== null
    );
}
