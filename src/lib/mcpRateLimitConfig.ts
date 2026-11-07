/**
 * Tier-based rate limit configuration for the MCP endpoints.
 *
 * TWO BUDGETS, DELIBERATELY. They meter different things and must not share a
 * constant:
 *   TIER_MAX      -- the browser bridge (GET /api/mcp/invocations). That tab
 *                    polls while it runs, so it needs headroom: 100/300/1200.
 *   MCP_CALL_TIER_MAX -- POST /api/mcp, the metered tool surface: 30/min free,
 *                    300/min paid. One constant for both would either throttle
 *                    the globe tab to a crawl or give an agent 4x the announced
 *                    budget.
 *
 * Budgets are configurable via environment variables for self-hosted deployments:
 *   MCP_INVOCATIONS_FREE_MAX=100   MCP_INVOCATIONS_BASIC_MAX=300
 *   MCP_INVOCATIONS_PRO_MAX=1200   MCP_INVOCATIONS_WINDOW_MS=60000
 *   MCP_CALL_FREE_MAX=30           MCP_CALL_BASIC_MAX=300
 *   MCP_CALL_PRO_MAX=300           MCP_CALL_ENTERPRISE_MAX=300
 */

import { redisSlidingWindow } from "@/lib/geocodingRateLimit";
import { redis } from "@/lib/redis";

export interface RateLimitBudget {
    maxRequests: number;
    windowMs: number;
}

const DEFAULT_WINDOW_MS = Number(process.env.MCP_INVOCATIONS_WINDOW_MS) || 60_000;

const TIER_MAX: Record<string, number> = {
    free: Number(process.env.MCP_INVOCATIONS_FREE_MAX) || 100,
    basic: Number(process.env.MCP_INVOCATIONS_BASIC_MAX) || 300,
    pro: Number(process.env.MCP_INVOCATIONS_PRO_MAX) || 1200,
};

/**
 * Budgets for POST /api/mcp (the metered tool surface). SEPARATE from TIER_MAX
 * above, which budgets the browser bridge's polling and stays at 100/300/1200 --
 * applying these numbers there would break the globe tab.
 *
 * `|| default` rather than `??`: an env var set to the empty string or to a
 * non-number must fall back to the shipped budget, not become 0 (which would
 * reject every call) or NaN (which would allow every call).
 */
const MCP_CALL_TIER_MAX: Record<string, number> = {
    free: Number(process.env.MCP_CALL_FREE_MAX) || 30,
    basic: Number(process.env.MCP_CALL_BASIC_MAX) || 300,
    pro: Number(process.env.MCP_CALL_PRO_MAX) || 300,
    enterprise: Number(process.env.MCP_CALL_ENTERPRISE_MAX) || 300,
};

/** How long a resolved tier may be reused before the database is asked again. */
const TIER_CACHE_TTL_SECONDS = 60;
const TIER_CACHE_PREFIX = "mcp:tier:";

/**
 * Returns the effective rate limit budget for a given tier.
 * Unknown tiers fall back to "free" limits.
 */
export function getTierBudget(tier: string): RateLimitBudget {
    const maxRequests = TIER_MAX[tier.toLowerCase()] ?? TIER_MAX.free;
    return { maxRequests, windowMs: DEFAULT_WINDOW_MS };
}

/**
 * Returns the metered tool-call budget for a given tier (POST /api/mcp).
 * Unknown tiers fall back to the free budget.
 */
export function getCallBudget(tier: string): RateLimitBudget {
    const maxRequests = MCP_CALL_TIER_MAX[tier.toLowerCase()] ?? MCP_CALL_TIER_MAX.free;
    return { maxRequests, windowMs: DEFAULT_WINDOW_MS };
}

/**
 * Resolve a user's org tier from their BetterAuth user ID.
 *
 * Queries PluginMember -> OrgTier chain. Returns "free" on any failure
 * (no membership, no tier record, DB outage) so a broken rate limiter
 * never blocks legit traffic.
 *
 * Cached for 60 s in Redis because this runs on every metered call and costs two
 * reads. Staleness only ever under-grants for at most a minute after an upgrade,
 * which is the safe direction, and there is no invalidation plumbing to get
 * wrong. A cache that cannot be reached is simply not a cache.
 */
export async function resolveUserTier(userId: string): Promise<string> {
    const cacheKey = `${TIER_CACHE_PREFIX}${userId}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) return cached;
    } catch {
        // A cache miss and a cache outage take the same path: ask the database.
    }

    const tier = await readTierFromDb(userId);

    try {
        await redis.set(cacheKey, tier, "EX", TIER_CACHE_TTL_SECONDS);
    } catch {
        // Not being able to remember the answer is not a reason to lose it.
    }

    return tier;
}

/** The uncached tier read. Fails closed to "free" on every error path. */
async function readTierFromDb(userId: string): Promise<string> {
    try {
        const { prisma } = await import("@/lib/db");
        const membership = await prisma.pluginMember.findFirst({
            where: { userId },
            select: { organizationId: true },
            orderBy: { createdAt: "asc" },
        });

        if (!membership) return "free";

        const tierRecord = await prisma.orgTier.findUnique({
            where: { organizationId: membership.organizationId },
        });

        return tierRecord?.tier ?? "free";
    } catch {
        return "free";
    }
}

/**
 * Checks the sliding-window rate limit for a given identity and tier.
 *
 * Keyed by `mcp:invocations:<identity>` so the invocations endpoint has
 * its own budget separate from the main MCP endpoint.
 *
 * @param identity  Redis key suffix, e.g. `key:<keyId>` or `user:<userId>`
 * @param tier      The user's effective tier ("free", "basic", "pro")
 * @returns         `{ allowed, retryAfterMs }` from redisSlidingWindow
 */
export async function checkMcpInvocationsRateLimit(
    identity: string,
    tier: string,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
    const { maxRequests, windowMs } = getTierBudget(tier);
    return redisSlidingWindow(`mcp:invocations:${identity}`, maxRequests, windowMs);
}

/**
 * Checks the per-key budget for POST /api/mcp, at the key's tier.
 *
 * The Redis key shape `mcp:ratelimit:key:<keyId>` is unchanged from the flat
 * 120/min limit this replaces, so a deploy does not silently hand every key a
 * fresh window and free-tier ceiling hits stay comparable across the change.
 */
export async function checkMcpCallRateLimit(
    keyId: string,
    tier: string,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
    const { maxRequests, windowMs } = getCallBudget(tier);
    return redisSlidingWindow(`mcp:ratelimit:key:${keyId}`, maxRequests, windowMs);
}
