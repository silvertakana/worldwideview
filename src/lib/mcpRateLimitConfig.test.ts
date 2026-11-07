/**
 * The two budget tables, and the tier lookup that feeds them.
 *
 * The regression this file exists for: `TIER_MAX` budgets the browser bridge's
 * polling and must stay at 100/300/1200 forever, while `MCP_CALL_TIER_MAX`
 * budgets the metered tool surface at 30/min free and 300/min paid. One table
 * edited for the other's purpose would either throttle the globe tab or hand an
 * agent four times the announced budget.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/geocodingRateLimit", () => ({
    redisSlidingWindow: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
    redis: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        pluginMember: { findFirst: vi.fn() },
        orgTier: { findUnique: vi.fn() },
    },
}));

import { redisSlidingWindow } from "@/lib/geocodingRateLimit";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/db";
import {
    checkMcpCallRateLimit,
    checkMcpInvocationsRateLimit,
    getCallBudget,
    getTierBudget,
    resolveUserTier,
} from "./mcpRateLimitConfig";

const windowSpy = vi.mocked(redisSlidingWindow);
const getSpy = vi.mocked(redis.get);
const setSpy = vi.mocked(redis.set);
const memberSpy = vi.mocked(prisma.pluginMember.findFirst);
const tierSpy = vi.mocked(prisma.orgTier.findUnique);

describe("getCallBudget -- POST /api/mcp", () => {
    it("gives free keys 30 calls per minute", () => {
        expect(getCallBudget("free")).toEqual({ maxRequests: 30, windowMs: 60_000 });
    });

    it("gives every paid tier 300 calls per minute", () => {
        for (const tier of ["pro", "enterprise", "basic", "PRO", "Pro"]) {
            expect(getCallBudget(tier).maxRequests, tier).toBe(300);
        }
    });

    it("falls back to the free budget for an unknown tier", () => {
        expect(getCallBudget("mystery").maxRequests).toBe(30);
        expect(getCallBudget("").maxRequests).toBe(30);
    });
});

describe("getTierBudget -- GET /api/mcp/invocations (the browser bridge)", () => {
    it("is still 100/300/1200, so the globe tab keeps its polling budget", () => {
        expect(getTierBudget("free").maxRequests).toBe(100);
        expect(getTierBudget("basic").maxRequests).toBe(300);
        expect(getTierBudget("pro").maxRequests).toBe(1200);
    });

    it("is a different table from the call budget, not a scaled copy of it", () => {
        expect(getTierBudget("free").maxRequests).not.toBe(getCallBudget("free").maxRequests);
        expect(getTierBudget("pro").maxRequests).not.toBe(getCallBudget("pro").maxRequests);
    });
});

describe("environment overrides", () => {
    const saved = { ...process.env };

    afterEach(() => {
        process.env = { ...saved };
        vi.resetModules();
    });

    it("lets a deployment raise the free call budget", async () => {
        process.env.MCP_CALL_FREE_MAX = "45";
        vi.resetModules();
        const reloaded = await import("./mcpRateLimitConfig");
        expect(reloaded.getCallBudget("free").maxRequests).toBe(45);
    });

    it("ignores a non-numeric override instead of allowing or blocking everything", async () => {
        process.env.MCP_CALL_FREE_MAX = "not-a-number";
        vi.resetModules();
        const reloaded = await import("./mcpRateLimitConfig");
        // `Number("not-a-number") || default`: NaN is falsy, so the shipped
        // budget stands. `??` would have produced NaN and admitted everything.
        expect(reloaded.getCallBudget("free").maxRequests).toBe(30);
    });

    it("never changes the browser bridge budget through the call variables", async () => {
        process.env.MCP_CALL_PRO_MAX = "5";
        vi.resetModules();
        const reloaded = await import("./mcpRateLimitConfig");
        expect(reloaded.getCallBudget("pro").maxRequests).toBe(5);
        expect(reloaded.getTierBudget("pro").maxRequests).toBe(1200);
    });
});

describe("checkMcpCallRateLimit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        windowSpy.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    });

    it("keeps the existing Redis key shape so a deploy does not reset every window", async () => {
        await checkMcpCallRateLimit("key-abc", "free");
        expect(windowSpy).toHaveBeenCalledWith("mcp:ratelimit:key:key-abc", 30, 60_000);
    });

    it("applies the paid budget at the paid tier", async () => {
        await checkMcpCallRateLimit("key-abc", "pro");
        expect(windowSpy).toHaveBeenCalledWith("mcp:ratelimit:key:key-abc", 300, 60_000);
    });

    it("reports a denial with the wait the window computed", async () => {
        windowSpy.mockResolvedValue({ allowed: false, retryAfterMs: 42_000 });
        await expect(checkMcpCallRateLimit("key-abc", "free")).resolves.toEqual({
            allowed: false,
            retryAfterMs: 42_000,
        });
    });

    it("does not touch the browser bridge's own Redis keyspace", async () => {
        await checkMcpCallRateLimit("key-abc", "free");
        const keys = windowSpy.mock.calls.map((call) => call[0]);
        expect(keys.every((key) => !key.startsWith("mcp:invocations:"))).toBe(true);
    });
});

describe("checkMcpInvocationsRateLimit (regression guard)", () => {
    it("still asks for the invocations keyspace at the bridge's budget", async () => {
        windowSpy.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
        await checkMcpInvocationsRateLimit("key:k1", "pro");
        expect(windowSpy).toHaveBeenCalledWith("mcp:invocations:key:k1", 1200, 60_000);
    });
});

describe("resolveUserTier", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSpy.mockResolvedValue(null);
        setSpy.mockResolvedValue("OK");
    });

    it("reads the tier through the oldest membership", async () => {
        memberSpy.mockResolvedValue({ organizationId: "org-1" } as never);
        tierSpy.mockResolvedValue({ tier: "pro" } as never);

        await expect(resolveUserTier("u1")).resolves.toBe("pro");
        expect(memberSpy).toHaveBeenCalledWith({
            where: { userId: "u1" },
            select: { organizationId: true },
            orderBy: { createdAt: "asc" },
        });
    });

    it("caches the answer for a minute and reuses it", async () => {
        memberSpy.mockResolvedValue({ organizationId: "org-1" } as never);
        tierSpy.mockResolvedValue({ tier: "pro" } as never);

        await resolveUserTier("u1");
        expect(setSpy).toHaveBeenCalledWith("mcp:tier:u1", "pro", "EX", 60);

        getSpy.mockResolvedValue("pro");
        await expect(resolveUserTier("u1")).resolves.toBe("pro");
        expect(memberSpy).toHaveBeenCalledTimes(1);
    });

    it("fails closed to free when the database is unreachable", async () => {
        memberSpy.mockRejectedValue(new Error("db down"));
        await expect(resolveUserTier("u1")).resolves.toBe("free");
    });

    it("answers from the database when the cache is unreachable", async () => {
        getSpy.mockRejectedValue(new Error("redis down"));
        setSpy.mockRejectedValue(new Error("redis down"));
        memberSpy.mockResolvedValue({ organizationId: "org-1" } as never);
        tierSpy.mockResolvedValue({ tier: "basic" } as never);

        await expect(resolveUserTier("u1")).resolves.toBe("basic");
    });

    it("is free for a user with no organization", async () => {
        memberSpy.mockResolvedValue(null);
        await expect(resolveUserTier("u1")).resolves.toBe("free");
    });
});
