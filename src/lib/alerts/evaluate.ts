/**
 * Pure rule evaluator for app-side alert conditions (P2, v1).
 * No I/O and no ambient state — fully unit-testable.
 *
 * Field resolution: alertable fields live in the GeoEntity metadata bag
 * (`entity.properties`, mirroring FilterDefinition.propertyKey); a field is
 * read from `properties` when the bag owns the key, otherwise from the
 * entity's top level. Semantics:
 * - gt/lt/gte/lte: numeric comparison after Number() coercion on BOTH sides.
 *   Missing fields, non-numeric values, NaN, or arrays -> false.
 * - eq/neq: natural equality restricted to string/number/boolean with
 *   coercion between numeric strings and numbers and "true"/"false" strings
 *   and booleans. Anything else falls back to String() comparison.
 *   Missing fields -> false (a rule cannot fire on data it cannot see).
 * - contains: case-insensitive string inclusion after String() coercion
 *   on both sides (arrays coerce to their joined string form).
 * - exists: field present AND not null/undefined.
 */

import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import type { AlertCondition } from "@worldwideview/wwv-plugin-sdk";

/** Entity shapes evaluable by conditions: mapped GeoEntity or any flat record. */
export type AlertableEntity = Record<string, unknown> | GeoEntity;

function getField(entity: AlertableEntity, field: string): unknown {
    const record = entity as Record<string, unknown>;
    const bag = record.properties;
    if (typeof bag === "object" && bag !== null && !Array.isArray(bag)) {
        const props = bag as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(props, field)) return props[field];
    }
    return record[field];
}

function isPresent(value: unknown): boolean {
    return value !== undefined && value !== null;
}

/** Number() coercion that rejects non-numeric input (NaN, "", [], objects). */
function toNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

/**
 * Natural equality over string/number/boolean. Same-type values compare with
 * ===; numeric strings compare numerically; "true"/"false" strings compare
 * as booleans; anything else falls back to String() comparison.
 */
function looseEquals(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    if (typeof a === "number" && typeof b === "string") {
        const nb = toNumber(b);
        return b.trim() !== "" && nb !== null && a === nb;
    }
    if (typeof a === "string" && typeof b === "number") {
        const na = toNumber(a);
        return a.trim() !== "" && na !== null && na === b;
    }
    if (typeof a === "boolean" && typeof b === "string") {
        const lower = b.trim().toLowerCase();
        if (lower === "true") return a;
        if (lower === "false") return !a;
        return false;
    }
    if (typeof a === "string" && typeof b === "boolean") {
        return looseEquals(b, a);
    }

    return String(a) === String(b);
}

function compareNumeric(
    left: unknown,
    right: unknown,
    op: "gt" | "lt" | "gte" | "lte",
): boolean {
    if (!isPresent(left)) return false;
    const a = toNumber(left);
    const b = toNumber(right);
    if (a === null || b === null) return false;

    switch (op) {
        case "gt": return a > b;
        case "lt": return a < b;
        case "gte": return a >= b;
        case "lte": return a <= b;
    }
}

function matches(condition: AlertCondition, entity: AlertableEntity): boolean {
    const { field, op, value } = condition;
    const actual = getField(entity, field);
    const present = isPresent(actual);

    switch (op) {
        case "gt":
        case "lt":
        case "gte":
        case "lte":
            return compareNumeric(actual, value, op);
        case "eq":
            return present ? looseEquals(actual, value) : false;
        case "neq":
            return present ? !looseEquals(actual, value) : false;
        case "contains":
            if (!present || !isPresent(value)) return false;
            return String(actual).toLowerCase().includes(String(value).toLowerCase());
        case "exists":
            return present;
        default:
            return false;
    }
}

/** Evaluate a single condition against an entity (flat record or GeoEntity). */
export function evaluateCondition(
    condition: AlertCondition,
    entity: AlertableEntity,
): boolean {
    if (!condition || typeof condition.field !== "string" || !condition.op) {
        return false;
    }
    try {
        return matches(condition, entity);
    } catch {
        return false;
    }
}

/** Evaluate a persisted rule (single-condition shape, v1) against an entity. */
export function evaluateRule(
    rule: { condition: AlertCondition; name?: string; pluginId?: string },
    entity: AlertableEntity,
): boolean {
    if (!rule?.condition) return false;
    return evaluateCondition(rule.condition, entity);
}