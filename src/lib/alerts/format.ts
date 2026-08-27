/**
 * Human-readable rendering + operator rules for alert conditions (P2, v1).
 * Pure helpers — no I/O — so the condition builder and rule list can share
 * one source of truth for "which operators fit which field type".
 */

import type {
    AlertCondition,
    AlertFieldDefinition,
    AlertFieldType,
    AlertOperator,
} from "@worldwideview/wwv-plugin-sdk";

/** Operators available by default for a field type (when the plugin omits `operators`). */
export const DEFAULT_OPERATORS_BY_TYPE: Record<AlertFieldType, AlertOperator[]> = {
    number: ["gt", "lt", "gte", "lte", "eq", "neq", "exists"],
    string: ["eq", "neq", "contains", "exists"],
    boolean: ["eq", "neq", "exists"],
};

export const OPERATOR_LABELS: Record<AlertOperator, string> = {
    gt: "greater than",
    lt: "less than",
    gte: "greater than or equal to",
    lte: "less than or equal to",
    eq: "equals",
    neq: "does not equal",
    contains: "contains",
    exists: "exists",
};

/** Operators allowed for a field: the field's declared list, else the type defaults. */
export function operatorsForField(field: Pick<AlertFieldDefinition, "type" | "operators">): AlertOperator[] {
    return field.operators && field.operators.length > 0
        ? field.operators
        : DEFAULT_OPERATORS_BY_TYPE[field.type];
}

/** True when the operator is allowed for a field of this type. */
export function isOperatorAllowed(
    field: Pick<AlertFieldDefinition, "type" | "operators">,
    op: AlertOperator,
): boolean {
    return operatorsForField(field).includes(op);
}

function renderValue(value: unknown): string {
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "boolean") return value ? "true" : "false";
    if (value === null || value === undefined) return "";
    return String(value);
}

/**
 * Render a stored condition as human text, using the plugin's field labels
 * when available (e.g. "Magnitude greater than 5"). Falls back to the raw
 * field key when the plugin is unknown or not loaded.
 */
export function formatCondition(
    condition: AlertCondition,
    definitions?: AlertFieldDefinition[] | null,
): string {
    if (
        !condition ||
        typeof condition.field !== "string" ||
        condition.field.trim() === "" ||
        typeof condition.op !== "string" ||
        !Object.prototype.hasOwnProperty.call(OPERATOR_LABELS, condition.op)
    ) {
        return "Invalid condition";
    }
    const definition = definitions?.find((d) => d.key === condition.field);
    const fieldLabel = definition?.label ?? condition.field;
    const opLabel = OPERATOR_LABELS[condition.op] ?? condition.op;

    if (condition.op === "exists") {
        return `${fieldLabel} ${opLabel}`;
    }
    return `${fieldLabel} ${opLabel} ${renderValue(condition.value)}`;
}

/** Short raw form used in compact rows/tooltips: "magnitude gt 5". */
export function formatConditionShort(condition: AlertCondition): string {
    if (
        !condition ||
        typeof condition.field !== "string" ||
        condition.field.trim() === "" ||
        typeof condition.op !== "string" ||
        !Object.prototype.hasOwnProperty.call(OPERATOR_LABELS, condition.op)
    ) {
        return "Invalid condition";
    }
    return condition.op === "exists"
        ? `${condition.field} ${condition.op}`
        : `${condition.field} ${condition.op} ${renderValue(condition.value)}`;
}