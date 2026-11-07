/**
 * @file usagePeriod.ts
 * @description The UTC month window every metered number is quoted against, and
 * the one write the MCP meter makes.
 *
 * WHY UTC IS THE ONLY TIMEZONE HERE. The invoices this meter will eventually
 * feed are cut on UTC periods. A local-time boundary would make the counter and
 * the invoice disagree by a few calls at every month edge, and there would be no
 * way to tell that from a real drift. So month arithmetic happens exactly here,
 * over getUTC* fields, and nowhere else.
 *
 * WHY recordToolCall NEVER THROWS. Metering is an observability concern on a
 * hot path that must still answer the agent. A failed counter write is reported
 * once to the console and swallowed: a tool call never fails because the meter
 * could not keep up.
 */

/** The half-open UTC window [start, end) that a usage number belongs to. */
export interface UsagePeriod {
    /** First instant of the UTC month, e.g. 2026-11-01T00:00:00.000Z. */
    readonly start: Date;
    /** First instant of the NEXT UTC month -- exclusive. */
    readonly end: Date;
    /** "2026-11" -- the label used in every response. */
    readonly label: string;
}

/**
 * First instant of the UTC month containing `at`.
 *
 * Built with Date.UTC rather than setUTCDate(1) so a date near a month boundary
 * cannot carry a timezone-dependent offset into the result.
 */
export function monthStart(at: Date): Date {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * First instant of the following UTC month.
 *
 * Date.UTC normalises month 12 into January of the next year, which is what
 * makes the December -> January rollover a one-line expression instead of a
 * special case.
 */
export function monthEnd(at: Date): Date {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/** "2026-11" -- zero-padded so the label sorts lexicographically. */
export function periodLabel(start: Date): string {
    const year = start.getUTCFullYear();
    const month = String(start.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

/**
 * The period a "YYYY-MM" label names, or null when it names none.
 *
 * Used by the cross-service read, which takes the period from its caller. It
 * accepts nothing but the canonical form: a permissive parser would let an
 * off-by-one month look like a valid period and report somebody else's window.
 */
export function periodStartFromLabel(label: string): Date | null {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(label);
    if (!match) return null;

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
}

/** The window the given instant falls in, with its label. */
export function currentUsagePeriod(at: Date = new Date()): UsagePeriod {
    const start = monthStart(at);
    return { start, end: monthEnd(at), label: periodLabel(start) };
}

export interface RecordToolCallInput {
    /** Owner of the key at call time. */
    userId: string;
    /** UserApiKey.id the call authenticated with. */
    keyId: string;
    /** Exact registered tool name. */
    toolName: string;
    /** Handler wall time. Not persisted yet; carried so a later histogram need not re-plumb callers. */
    durationMs: number;
    /** Injectable clock for tests; defaults to now. */
    at?: Date;
}

/**
 * Records one metered call. Never throws.
 *
 * The unique index (keyId, periodStart, toolName) is what makes this safe under
 * concurrency: two calls in the same millisecond both land as an increment on
 * one row instead of racing into duplicates.
 *
 * The Prisma client is imported dynamically, like resolveUserTier does, so
 * importing this module (from the route, from a test) never constructs a pool.
 */
export async function recordToolCall(input: RecordToolCallInput): Promise<void> {
    const at = input.at ?? new Date();
    const start = monthStart(at);

    try {
        const { prisma } = await import("@/lib/db");
        await prisma.mcpToolUsageMonthly.upsert({
            where: {
                keyId_periodStart_toolName: {
                    keyId: input.keyId,
                    periodStart: start,
                    toolName: input.toolName,
                },
            },
            create: {
                keyId: input.keyId,
                userId: input.userId,
                toolName: input.toolName,
                periodStart: start,
                periodEnd: monthEnd(at),
                calls: 1,
                lastCallAt: at,
            },
            update: {
                calls: { increment: 1 },
                lastCallAt: at,
            },
        });
    } catch (err) {
        // Never fail a tool call because the meter is unavailable. The error
        // NAME only: a Prisma message can quote row values.
        console.error("[mcp/metering] recordToolCall failed:", err instanceof Error ? err.name : "unknown");
    }
}
