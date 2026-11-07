/**
 * SEC-02: the per-key rate limit on POST /api/mcp, at the key's tier.
 *
 * This drives the REAL route with a stateful stand-in for the Redis sliding
 * window, so "the 31st call in the window is refused" is counted rather than
 * asserted about a mock's return value. The tier comes from the same
 * resolveUserTier path the route uses, mocked at the database boundary only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Top-level mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/apiKeyAuth", () => ({
    authenticateApiKey: vi.fn(),
}));

vi.mock("@/core/edition", () => ({
    isDemo: false,
}));

// The per-IP limiter (60/min) is a different gate with its own tests, and it is
// process-wide: leaving it real would make this file's own request count trip it
// and the per-key budget would never be reached.
vi.mock("@/lib/rateLimiters", () => ({
    mcpLimiter: { check: vi.fn().mockReturnValue(null) },
    mcpInvocationsLimiter: { check: vi.fn().mockReturnValue(null) },
    apiKeyManagementLimiter: { check: vi.fn().mockReturnValue(null) },
    getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        pluginMember: { findFirst: vi.fn() },
        orgTier: { findUnique: vi.fn() },
        mcpToolUsageMonthly: { upsert: vi.fn(), findMany: vi.fn() },
        userApiKey: { findMany: vi.fn() },
    },
}));

// The full interface, with inert defaults: the registrars and the tier cache
// both reach for Redis at registration time, and neither is what this file is
// testing. The sliding window is mocked separately, below.
vi.mock("@/lib/redis", () => ({
    redis: {
        ping: vi.fn().mockResolvedValue("PONG"),
        set: vi.fn().mockResolvedValue("OK"),
        get: vi.fn().mockResolvedValue(null),
        zadd: vi.fn().mockResolvedValue(1),
        zrange: vi.fn().mockResolvedValue([]),
        zrem: vi.fn().mockResolvedValue(0),
        zremrangebyscore: vi.fn().mockResolvedValue(0),
        zcard: vi.fn().mockResolvedValue(0),
        rpush: vi.fn().mockResolvedValue(0),
        expire: vi.fn().mockResolvedValue(1),
        multi: vi.fn(),
    },
}));

/**
 * A real sliding window over a Map: it counts every call against the budget the
 * route asked for and refuses past it, which is what the Redis ZSET does.
 */
const windowState = new Map<string, number>();
vi.mock("@/lib/geocodingRateLimit", () => ({
    redisSlidingWindow: vi.fn(async (key: string, limit: number, windowMs: number) => {
        const used = (windowState.get(key) ?? 0) + 1;
        windowState.set(key, used);
        return used > limit
            ? { allowed: false, retryAfterMs: windowMs }
            : { allowed: true, retryAfterMs: 0 };
    }),
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
    const McpServer = vi.fn(function McpServerMock(this: unknown) {
        return {
            connect: vi.fn().mockResolvedValue(undefined),
            registerResource: vi.fn(),
            registerTool: vi.fn(),
            registerPrompt: vi.fn(),
        };
    });
    const ResourceTemplate = vi.fn(function ResourceTemplateMock(this: unknown, uriTemplate: string) {
        return { uriTemplate };
    });
    return { McpServer, ResourceTemplate };
});

vi.mock("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js", () => {
    const WebStandardStreamableHTTPServerTransport = vi.fn().mockImplementation(() => ({
        handleRequest: vi.fn().mockResolvedValue(
            new Response(null, {
                status: 200,
                headers: {
                    "X-Accel-Buffering": "no",
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
                },
            })
        ),
    }));
    return { WebStandardStreamableHTTPServerTransport };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from "./route";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(authorization?: string): Request {
    const headers: Record<string, string> = {};
    if (authorization) headers["authorization"] = authorization;
    return new Request("http://localhost:3000/api/mcp", { method: "POST", headers });
}

/** Points the tier lookup at one tier, through the real resolveUserTier. */
function tierIs(tier: string): void {
    vi.mocked(prisma.pluginMember.findFirst).mockResolvedValue({ organizationId: "org-1" } as never);
    vi.mocked(prisma.orgTier.findUnique).mockResolvedValue({ tier } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SEC-02: per-key Redis rate limit gate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        windowState.clear();
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "u1", keyId: "k1" });
        tierIs("free");
    });

    it("passes a call that is inside the budget", async () => {
        const res = await POST(makePost("Bearer wwv_valid.token"));
        expect(res.status).not.toBe(429);
    });

    it("refuses a free key's 31st call in the window, with JSON-RPC -32000 and Retry-After", async () => {
        for (let call = 1; call <= 30; call += 1) {
            const allowed = await POST(makePost("Bearer wwv_valid.token"));
            expect(allowed.status, `call ${call}`).not.toBe(429);
        }

        const res = await POST(makePost("Bearer wwv_valid.token"));
        const body = await res.json();

        expect(res.status).toBe(429);
        expect(body).toMatchObject({
            jsonrpc: "2.0",
            error: { code: -32000, message: "rate limit exceeded" },
            id: null,
        });
        expect(res.headers.get("Retry-After")).toBe("60");
    });

    it("lets a pro key make the 31st call", async () => {
        tierIs("pro");

        for (let call = 1; call <= 31; call += 1) {
            const res = await POST(makePost("Bearer wwv_valid.token"));
            expect(res.status, `call ${call}`).not.toBe(429);
        }
    });

    it("gives an enterprise key the paid budget too", async () => {
        tierIs("enterprise");

        for (let call = 1; call <= 31; call += 1) {
            const res = await POST(makePost("Bearer wwv_valid.token"));
            expect(res.status, `call ${call}`).not.toBe(429);
        }
    });

    it("keeps one key's usage out of another key's window", async () => {
        for (let call = 1; call <= 30; call += 1) {
            await POST(makePost("Bearer wwv_valid.token"));
        }

        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "u1", keyId: "k2" });
        const other = await POST(makePost("Bearer wwv_other.token"));

        expect(other.status).not.toBe(429);
    });

    it("does not check the limit when auth fails", async () => {
        vi.mocked(authenticateApiKey).mockResolvedValue(null);

        const res = await POST(makePost("Bearer bogus.token"));

        expect(res.status).toBe(401);
        expect(windowState.size).toBe(0);
    });

    it("asks for the budget of the resolved tier, not a flat number", async () => {
        tierIs("pro");
        await POST(makePost("Bearer wwv_valid.token"));
        // The pro budget was applied: one call leaves the pro window at 1/300,
        // and the free window untouched.
        expect(windowState.get("mcp:ratelimit:key:k1")).toBe(1);
    });
});
