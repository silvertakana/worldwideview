/**
 * Envelope shaping for entity list results (v2 AX overhaul).
 *
 * Pure: no I/O, no service calls. It sits beside fieldProjection.ts because it is
 * the other half of "return the payload an agent actually wants": projection
 * trims each entity, and this decides what the result MEANS -- count, ordering,
 * truncation, and, the v2 rule, why it is empty.
 *
 * The empty reason always goes through resolveEmptyReason, so a source that
 * stated nothing resolves to "unknown" and NEVER to no_data_matches. The single
 * exception is EntityOutcome.liveButFilteredOut, which is provable from the call
 * itself: that call already returned entities, so the feed was demonstrably live.
 *
 * File: src/lib/mcp/entityResponse.ts
 */

import type { EmptyReason, SearchResult } from "@/lib/data-query/types";
import { applyFields } from "@/lib/mcp/fieldProjection";
import {
    mcpEmpty,
    mcpOk,
    resolveEmptyReason,
    type McpEmptyReason,
    type McpMeta,
    type McpTextResult,
} from "@/lib/mcp/responseEnvelope";

/** Hard cap on entities returned by any query tool here, whatever the caller asks for. */
export const MAX_LIMIT = 200;

/** Clamps the caller's limit into [1, MAX_LIMIT]. */
export function clampLimit(limit: number | undefined, fallback: number): number {
    const value = limit ?? fallback;
    return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT);
}

/** Distinct, non-empty layer ids; undefined means "every streaming layer". */
export function normalizePluginIds(pluginIds?: string[]): string[] | undefined {
    if (pluginIds === undefined) return undefined;
    const ids = Array.from(new Set(pluginIds.map((id) => id.trim()).filter((id) => id.length > 0)));
    return ids.length > 0 ? ids : undefined;
}

/**
 * Shallow-copies entities into plain records, then projects them. The copy is
 * what makes the projection type-safe: entity types in this codebase are
 * interfaces, and interfaces get no implicit index signature, so they are not
 * assignable to Record<string, unknown>.
 */
function projectEntities(
    entities: SearchResult[],
    fields?: string[],
): { entities: Record<string, unknown>[]; unknownFields: string[] } {
    const projected = applyFields(entities.map((entity) => ({ ...entity })), fields);
    return { entities: projected.items, unknownFields: projected.unknownFields };
}

/** What a mode runner hands back to the envelope. */
export interface EntityOutcome {
    entities: SearchResult[];
    /** Absent when no source stated a reason. */
    emptyReason?: EmptyReason;
    /** Only trustworthy when this call neither filtered nor re-capped the set. */
    totalMatched?: number;
    order: "distance" | "unspecified";
    /** This call returned entities that its own query intersection removed. */
    liveButFilteredOut?: boolean;
}

/** Wraps an entity outcome in the v2 envelope: project, then empty reason or success meta. */
export function respondEntities(outcome: EntityOutcome, fields?: string[]): McpTextResult {
    const projected = projectEntities(outcome.entities, fields);
    const unknownFields =
        projected.unknownFields.length > 0 ? { unknownFields: projected.unknownFields } : {};

    if (projected.entities.length === 0) {
        const serviceReason =
            outcome.emptyReason ?? (outcome.liveButFilteredOut === true ? "no_data_matches" : undefined);
        const reason: McpEmptyReason = resolveEmptyReason(serviceReason);
        return mcpEmpty({ entities: [] }, reason, { order: outcome.order, ...unknownFields });
    }

    const meta: McpMeta = {
        count: projected.entities.length,
        order: outcome.order,
        ...(outcome.totalMatched !== undefined && {
            truncated: true,
            totalMatched: outcome.totalMatched,
        }),
        ...unknownFields,
    };
    return mcpOk({ entities: projected.entities }, meta);
}
