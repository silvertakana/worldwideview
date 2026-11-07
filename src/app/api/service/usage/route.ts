/**
 * GET /api/service/usage?period=YYYY-MM[&email=<email>]
 *
 * The cross-service read of the meter: signed, read-only, and the only way the
 * hub learns what a customer's keys consumed. Guarded by crossServiceAuth
 * exactly like POST /api/service/tier-sync, so an unsigned caller learns nothing
 * -- not even whether an address has keys.
 *
 * WHY A ROUTE AND NOT A SHARED DATABASE. The two services may sit on one
 * Postgres, but the table's shape is owned by this repo's Prisma migrations and
 * a second reader would be a second schema contract. The signed route is the
 * boundary that survives either topology.
 *
 * `period` names a UTC month. A malformed period is a 400 rather than a
 * fallback to "now", because silently reporting the current month when the caller
 * asked for October would produce a wrong invoice that looks right.
 *
 * WITHOUT `email` the answer covers every key in the period: that is what a
 * shadow-bill run needs, and it is reachable only with the cross-service secret.
 * WITH `email` it covers that account's keys, and an address with no account
 * here is a 404 -- the same answer tier-sync gives, so the hub maps both the same
 * way.
 */

import { NextRequest, NextResponse } from "next/server";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { prisma } from "@/lib/db";
import {
    currentUsagePeriod,
    monthEnd,
    periodLabel,
    periodStartFromLabel,
    type UsagePeriod,
} from "@/lib/mcp/usagePeriod";
import { groupUsageByKey, readUsageRows } from "@/lib/mcp/usageQuery";

function resolvePeriod(label: string | null): UsagePeriod | null {
    if (!label) return currentUsagePeriod();

    const start = periodStartFromLabel(label);
    if (!start) return null;
    return { start, end: monthEnd(start), label: periodLabel(start) };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    const authError = await crossServiceAuth(request);
    if (authError) return authError;

    const searchParams = new URL(request.url).searchParams;

    const period = resolvePeriod(searchParams.get("period"));
    if (!period) {
        return NextResponse.json(
            { error: "Invalid period. Expected YYYY-MM." },
            { status: 400 },
        );
    }

    const email = searchParams.get("email");
    let userId: string | undefined;
    if (email) {
        const user = await prisma.betterAuthUser.findUnique({
            where: { email },
            select: { id: true },
        });
        if (!user) {
            return NextResponse.json({ error: "Account not found for email" }, { status: 404 });
        }
        userId = user.id;
    }

    try {
        const rows = await readUsageRows({ period, userId });
        const grouped = groupUsageByKey(rows);

        // Key names come from the keys themselves; a ledger row whose key was
        // deleted still reports, by id, with no name.
        const keys = await prisma.userApiKey.findMany({
            where: { id: { in: grouped.map((entry) => entry.keyId) } },
            select: { id: true, name: true, prefix: true },
        });
        const keyMeta = new Map(keys.map((key) => [key.id, key]));
        const ownerByKey = new Map(rows.map((row) => [row.keyId, row.userId]));

        const toolTotals = new Map<string, number>();
        for (const row of rows) {
            toolTotals.set(row.toolName, (toolTotals.get(row.toolName) ?? 0) + row.calls);
        }

        return NextResponse.json({
            period: {
                start: period.start.toISOString(),
                end: period.end.toISOString(),
                label: period.label,
            },
            keys: grouped.map((entry) => ({
                keyId: entry.keyId,
                userId: ownerByKey.get(entry.keyId) ?? null,
                name: keyMeta.get(entry.keyId)?.name ?? null,
                prefix: keyMeta.get(entry.keyId)?.prefix ?? null,
                calls: entry.calls,
                tools: entry.tools,
            })),
            totalCalls: grouped.reduce((sum, entry) => sum + entry.calls, 0),
            toolTotals: [...toolTotals.entries()]
                .map(([toolName, calls]) => ({ toolName, calls }))
                .sort((a, b) => b.calls - a.calls || a.toolName.localeCompare(b.toolName)),
        });
    } catch (err) {
        console.error("[service/usage] GET error:", err instanceof Error ? err.name : "unknown");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export const runtime = "nodejs";
