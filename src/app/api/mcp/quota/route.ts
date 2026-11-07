/**
 * GET /api/mcp/quota
 *
 * Public and keyless on purpose: this is what an agent can read BEFORE it holds
 * a credential, so "what does this server cost me and what may I call" is
 * answerable without one. Behind the same coarse per-IP limiter as /api/mcp, so
 * a keyless endpoint does not become a free amplifier.
 *
 * It exposes only what the repository already publishes: the tool names (the
 * registry the generated connect brief is built from) and the call budgets as
 * configured. It reads no counter and names no customer.
 */

import { NextResponse } from "next/server";
import { isDemo } from "@/core/edition";
import { mcpLimiter, getClientIp } from "@/lib/rateLimiters";
import { MCP_TOOLS } from "@/lib/mcp/toolRegistry";
import { getCallBudget } from "@/lib/mcpRateLimitConfig";
import { currentUsagePeriod } from "@/lib/mcp/usagePeriod";

/** The tiers whose budget is published. Anything else is quoted the free one. */
const PUBLIC_TIERS = ["free", "basic", "pro", "enterprise"] as const;

export async function GET(request: Request): Promise<NextResponse> {
    const limited = mcpLimiter.check(getClientIp(request));
    if (limited) return limited as NextResponse;

    if (isDemo) {
        return NextResponse.json({ error: "MCP is not available in demo mode" }, { status: 403 });
    }

    const period = currentUsagePeriod();

    return NextResponse.json({
        endpoint: "/api/mcp",
        period: { start: period.start.toISOString(), end: period.end.toISOString(), label: period.label },
        call_budgets: PUBLIC_TIERS.map((tier) => {
            const budget = getCallBudget(tier);
            return {
                tier,
                calls_per_minute: budget.maxRequests,
                window_seconds: Math.round(budget.windowMs / 1000),
            };
        }),
        // The same names the connect brief and tools/list publish.
        tools: MCP_TOOLS.map((tool) => ({
            name: tool.name,
            summary: tool.summary,
            metered: tool.metered,
        })),
        tool_count: MCP_TOOLS.length,
    });
}

export const runtime = "nodejs";
