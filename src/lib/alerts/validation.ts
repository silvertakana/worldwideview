/**
 * Server-side validation for alert rule inputs (P2, v1).
 * Regex / constants / shape checks shared by the alerts routes and their tests.
 */

import type { AlertCondition, AlertFieldType, AlertOperator } from "@worldwideview/wwv-plugin-sdk";

export const ALERT_FIELD_TYPES: AlertFieldType[] = ["number", "string", "boolean"];

export const ALERT_OPERATORS: AlertOperator[] = [
    "gt",
    "lt",
    "gte",
    "lte",
    "eq",
    "neq",
    "contains",
    "exists",
];

export const MAX_RULE_NAME_LENGTH = 120;
export const MAX_FIELD_NAME_LENGTH = 100;
export const MAX_SUMMARY_LENGTH = 500;

/** Channel names are safe URL/engine identifiers (mirrors data-query/service.ts). */
export const PLUGIN_ID_RE = /^[a-zA-Z0-9_-]+$/;

export function isAlertOperator(value: unknown): value is AlertOperator {
    return typeof value === "string" && (ALERT_OPERATORS as string[]).includes(value);
}

/**
 * Validate a condition payload against the SDK shape.
 * Returns an error message string, or null when valid.
 */
export function validateCondition(condition: unknown): string | null {
    if (typeof condition !== "object" || condition === null || Array.isArray(condition)) {
        return "condition must be an object";
    }
    const c = condition as Record<string, unknown>;

    if (typeof c.field !== "string" || c.field.trim() === "") {
        return "condition.field must be a non-empty string";
    }
    if (c.field.length > MAX_FIELD_NAME_LENGTH) {
        return `condition.field must be ${MAX_FIELD_NAME_LENGTH} characters or fewer`;
    }
    if (!isAlertOperator(c.op)) {
        return `condition.op must be one of: ${ALERT_OPERATORS.join(", ")}`;
    }

    const hasValue = "value" in c && c.value !== undefined;
    if (c.op !== "exists" && !hasValue) {
        return `condition.value is required for operator "${c.op}"`;
    }
    if (c.op === "exists" && c.value !== undefined && c.value !== null) {
        return 'condition.value must be omitted for operator "exists"';
    }
    return null;
}

/** Validate a rule name payload. Returns an error message, or null when valid. */
export function validateRuleName(name: unknown): string | null {
    if (typeof name !== "string" || name.trim() === "") {
        return "name must be a non-empty string";
    }
    if (name.length > MAX_RULE_NAME_LENGTH) {
        return `name must be ${MAX_RULE_NAME_LENGTH} characters or fewer`;
    }
    return null;
}

export function isCondition(value: unknown): value is AlertCondition {
    return validateCondition(value) === null;
}