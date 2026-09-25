/**
 * Server-side field projection for MCP data-query results.
 *
 * WHY THIS EXISTS (AX overhaul, 2026-09-25)
 * v1 returned whole entity records. A single region query could dump 100
 * entities' worth of Cesium styling properties (iconUrl, iconScale, size,
 * outlineColor...) that the calling agent never reads -- tokens spent on data
 * nobody asked for, in a context window the agent has to keep clean. 'fields'
 * is the caller's lever on that, and the unknownFields report is how a caller
 * learns the real field vocabulary without a second round trip.
 *
 * Projection is ADVISORY, not a hard failure: an unrecognised field name is
 * reported back rather than rejected, so one typo cannot fail a whole query.
 *
 * Pure -- no I/O, no service access, no side effects.
 *
 * File: src/lib/mcp/fieldProjection.ts
 */

/** Result of a projection: the (possibly projected) items plus the requested field names nothing carried. */
export interface FieldProjectionResult<T extends Record<string, unknown>> {
    items: T[];
    /**
     * Requested field names that NO returned item carried. Empty when nothing
     * was requested, when every requested name existed somewhere, or when there
     * were no items to check the names against.
     * Agent-facing: this is the signal that the field vocabulary was wrong.
     */
    unknownFields: string[];
}

/**
 * Projects every item down to the requested keys.
 *
 * - fields undefined or empty: items are returned untouched (the same array
 *   reference, no copy) with unknownFields: [].
 * - Otherwise each item keeps only the requested keys it actually has, and any
 *   requested name that NO item carried is collected into unknownFields. Never
 *   throws, never rejects a call: projection cannot fail a query.
 * - unknownFields is deliberately batch-level, not per-item: entity fields are
 *   optional (name?, altitude?, distanceKm), so flagging a name because one item
 *   happened to lack it would tell the caller to drop a field that is real.
 * - Fallback decision: if the projection would leave an item with NO keys at
 *   all, that item is returned UNPROJECTED rather than as {}. An empty object
 *   reads to an agent as "this entity carries no data", which is false, and a
 *   wrong field name is not an error either -- so the honest answer is the whole
 *   record, and the wrong name is reported in unknownFields because no item had
 *   it. (Rejected alternative: always keeping "id" -- it silently ignores the
 *   caller's request and makes the projection unpredictable.)
 */
export function applyFields<T extends Record<string, unknown>>(
    items: T[],
    fields?: string[],
): FieldProjectionResult<T> {
    if (fields === undefined || fields.length === 0) {
        return { items, unknownFields: [] };
    }

    const requested = Array.from(new Set(fields));

    const present = new Set<string>();
    for (const item of items) {
        for (const key of Object.keys(item)) present.add(key);
    }
    // With no items there is nothing to check the names against, so nothing is
    // claimed -- an invented "unknown field" is as bad as an invented reason.
    const unknownFields =
        items.length === 0 ? [] : requested.filter((key) => !present.has(key));

    const projected = items.map((item): T => {
        const kept: Record<string, unknown> = {};
        let keptCount = 0;
        for (const key of requested) {
            if (Object.prototype.hasOwnProperty.call(item, key)) {
                kept[key] = item[key];
                keptCount += 1;
            }
        }
        return keptCount === 0 ? item : (kept as T);
    });

    return { items: projected, unknownFields };
}
