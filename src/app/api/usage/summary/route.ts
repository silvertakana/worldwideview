/**
 * GET /api/usage/summary[?keyId=<id>]
 *
 * The owner's own view of the meter: per-key, per-tool call counts for the
 * current UTC month. Read-only in the strongest sense -- this route has no write
 * path to a counter and makes no billing call.
 *
 * Auth is dual, mirroring GET /api/mcp/invocations: a Better Auth session (the
 * browser) or a Bearer API key (a program). WHO YOU ARE comes only from that
 * result, never from the query string:
 *   - session  -> every key the session's user owns
 *   - API key  -> that key only
 * A keyId query parameter may narrow the answer, but it can never widen it: an
 * id belonging to somebody else is a 404, not an empty 200, so a probe cannot
 * learn that it exists.
 *
 * No envelope, no overage, no price: those belong to the phase that owns the
 * pricing decision, and a read endpoint that had to know a price would be a
 * second place to change it.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { prisma } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { isDemo } from "@/core/edition";
import { apiKeyManagementLimiter, getClientIp } from "@/lib/rateLimiters";
import { currentUsagePeriod } from "@/lib/mcp/usagePeriod";
import { groupUsageByKey, readUsageRows } from "@/lib/mcp/usageQuery";

interface KeyIdentity {
    userId: string;
    /** Set when the caller authenticated with an API key: the only key it may read. */
    keyId?: string;
}

async function resolveCaller(request: Request): Promise<KeyIdentity | null> {
    const session = await getServerSession();
    if (session?.user?.id) return { userId: session.user.id };

    const apiKey = await authenticateApiKey(request);
    if (apiKey) return { userId: apiKey.userId, keyId: apiKey.keyId };

    return null;
}

export async function GET(request: Request): Promise<NextResponse> {
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const limited = apiKeyManagementLimiter.check(getClientIp(request));
    if (limited) return limited as NextResponse;

    const caller = await resolveCaller(request);
    if (!caller) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestedKeyId = new URL(request.url).searchParams.get("keyId") ?? undefined;
    const keyId = caller.keyId ?? requestedKeyId;

    // An API key may only ever read its own rows. A session may read any of its
    // own keys, so a keyId it does not own resolves to no row at all.
    if (caller.keyId && requestedKeyId && requestedKeyId !== caller.keyId) {
        return NextResponse.json({ error: "key not found" }, { status: 404 });
    }

    const period = currentUsagePeriod();

    try {
        const [rows, keys] = await Promise.all([
            readUsageRows({ period, userId: caller.userId, keyId }),
            prisma.userApiKey.findMany({
                where: { userId: caller.userId, ...(keyId ? { id: keyId } : {}) },
                select: { id: true, name: true, prefix: true, lastUsedAt: true },
                orderBy: { createdAt: "asc" },
            }),
        ]);

        const keyMeta = new Map(keys.map((key) => [key.id, key]));
        const grouped = groupUsageByKey(rows);

        // A key with no calls this month still belongs in the answer: "this key
        // has used nothing" is the fact a caller is usually looking for.
        const byKeyId = new Map(grouped.map((entry) => [entry.keyId, entry]));
        const responseKeys = keys.map((key) => {
            const usage = byKeyId.get(key.id);
            return {
                keyId: key.id,
                name: key.name,
                prefix: key.prefix,
                lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
                calls: usage?.calls ?? 0,
                tools: usage?.tools ?? [],
            };
        });

        // Rows can outlive a deleted key (the meter is a ledger), so a key-month
        // with no surviving key row is still reported, named by its id.
        for (const entry of grouped) {
            if (keyMeta.has(entry.keyId)) continue;
            responseKeys.push({
                keyId: entry.keyId,
                name: "(deleted key)",
                prefix: "",
                lastUsedAt: null,
                calls: entry.calls,
                tools: entry.tools,
            });
        }

        return NextResponse.json({
            period: {
                start: period.start.toISOString(),
                end: period.end.toISOString(),
                label: period.label,
            },
            keys: responseKeys,
            totalCalls: responseKeys.reduce((sum, key) => sum + key.calls, 0),
        });
    } catch (err) {
        console.error("[usage/summary] GET error:", err instanceof Error ? err.name : "unknown");
        return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
    }
}

export const runtime = "nodejs";
