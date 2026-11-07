/**
 * @file usageQuery.ts
 * @description The read side of the meter, shared by the three surfaces that
 * quote it: the get_usage tool, GET /api/usage/summary, and the cross-service
 * read. SELECT only -- nothing in this module increments a counter.
 */

import { prisma } from "@/lib/db";
import type { UsagePeriod } from "./usagePeriod";

/** One (key, tool) row from the meter. */
export interface ToolUsageRow {
    keyId: string;
    /** Owner of the key. Every row for one key carries the same id. */
    userId: string;
    toolName: string;
    calls: number;
    lastCallAt: Date;
}

/** The per-tool shape every response quotes. */
export interface ToolUsageSummary {
    toolName: string;
    calls: number;
    /** ISO instant of the most recent counted call in this period. */
    lastCallAt: string;
}

export interface KeyUsageTotals {
    keyId: string;
    calls: number;
    tools: ToolUsageSummary[];
}

/**
 * The meter's rows for one UTC month.
 *
 * A key-month is at most one row per tool (~25), so this is a bounded read that
 * fits in one query and one response; no rollup table is involved.
 */
export async function readUsageRows(args: {
    period: UsagePeriod;
    userId?: string;
    keyId?: string;
}): Promise<ToolUsageRow[]> {
    return prisma.mcpToolUsageMonthly.findMany({
        where: {
            periodStart: args.period.start,
            ...(args.userId ? { userId: args.userId } : {}),
            ...(args.keyId ? { keyId: args.keyId } : {}),
        },
        select: { keyId: true, userId: true, toolName: true, calls: true, lastCallAt: true },
    });
}

/**
 * Groups rows into per-key totals with a per-tool split.
 *
 * Ordering is fixed (key calls descending, then keyId; tool calls descending,
 * then tool name) so two runs against the same data print the same invoice and a
 * diff means the numbers moved, not the sort.
 */
export function groupUsageByKey(rows: readonly ToolUsageRow[]): KeyUsageTotals[] {
    const byKey = new Map<string, Map<string, ToolUsageSummary>>();

    for (const row of rows) {
        const tools = byKey.get(row.keyId) ?? new Map<string, ToolUsageSummary>();
        tools.set(row.toolName, {
            toolName: row.toolName,
            calls: row.calls,
            lastCallAt: row.lastCallAt.toISOString(),
        });
        byKey.set(row.keyId, tools);
    }

    return [...byKey.entries()]
        .map(([keyId, tools]) => {
            const sortedTools = [...tools.values()].sort(
                (a, b) => b.calls - a.calls || a.toolName.localeCompare(b.toolName),
            );
            return {
                keyId,
                calls: sortedTools.reduce((sum, tool) => sum + tool.calls, 0),
                tools: sortedTools,
            };
        })
        .sort((a, b) => b.calls - a.calls || a.keyId.localeCompare(b.keyId));
}

/** The tool split for a single key, ordered like groupUsageByKey's inner list. */
export function summarizeKeyTools(rows: readonly ToolUsageRow[]): ToolUsageSummary[] {
    const tools = new Map<string, ToolUsageSummary>();
    for (const row of rows) {
        tools.set(row.toolName, {
            toolName: row.toolName,
            calls: row.calls,
            lastCallAt: row.lastCallAt.toISOString(),
        });
    }
    return [...tools.values()].sort(
        (a, b) => b.calls - a.calls || a.toolName.localeCompare(b.toolName),
    );
}
