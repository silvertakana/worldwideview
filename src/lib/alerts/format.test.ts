import { describe, it, expect } from "vitest";
import type { AlertFieldDefinition } from "@worldwideview/wwv-plugin-sdk";
import {
    DEFAULT_OPERATORS_BY_TYPE,
    OPERATOR_LABELS,
    formatCondition,
    formatConditionShort,
    isOperatorAllowed,
    operatorsForField,
} from "./format";

const EQ_DEF: AlertFieldDefinition = { key: "magnitude", label: "Magnitude", type: "number" };

describe("formatCondition", () => {
    it("renders a numeric condition with the plugin's field label", () => {
        expect(formatCondition({ field: "magnitude", op: "gt", value: 5 }, [EQ_DEF]))
            .toBe("Magnitude greater than 5");
    });

    it("falls back to the raw field key when definitions are missing", () => {
        expect(formatCondition({ field: "place", op: "eq", value: "Alaska" }, null))
            .toBe("place equals \"Alaska\"");
    });

    it("quotes string values and renders booleans plainly", () => {
        const defs: AlertFieldDefinition[] = [
            { key: "place", label: "Place", type: "string" },
            { key: "felt", label: "Felt", type: "boolean" },
        ];
        expect(formatCondition({ field: "place", op: "contains", value: "al" }, defs))
            .toBe("Place contains \"al\"");
        expect(formatCondition({ field: "felt", op: "eq", value: true }, defs))
            .toBe("Felt equals true");
    });

    it("omits the value for the exists operator", () => {
        expect(formatCondition({ field: "place", op: "exists" }, [{ key: "place", label: "Place", type: "string" }]))
            .toBe("Place exists");
    });

    it("renders a safe message for malformed conditions", () => {
        expect(formatCondition({ field: "", op: "gt", value: 1 }, null)).toBe("Invalid condition");
        expect(formatCondition({ field: "x", op: "bogus" as never, value: 1 }, null)).toBe("Invalid condition");
    });
});

describe("formatConditionShort", () => {
    it("renders the raw key/op/value form", () => {
        expect(formatConditionShort({ field: "magnitude", op: "gt", value: 5 })).toBe("magnitude gt 5");
    });

    it("omits value for exists", () => {
        expect(formatConditionShort({ field: "place", op: "exists" })).toBe("place exists");
    });
});

describe("operatorsForField / isOperatorAllowed", () => {
    it("defaults operators per field type", () => {
        expect(DEFAULT_OPERATORS_BY_TYPE.number).toEqual(["gt", "lt", "gte", "lte", "eq", "neq", "exists"]);
        expect(DEFAULT_OPERATORS_BY_TYPE.string).toEqual(["eq", "neq", "contains", "exists"]);
        expect(DEFAULT_OPERATORS_BY_TYPE.boolean).toEqual(["eq", "neq", "exists"]);
        expect(OPERATOR_LABELS.gt).toBe("greater than");
    });

    it("uses the plugin's declared operators when provided", () => {
        const field: AlertFieldDefinition = { key: "mag", label: "Mag", type: "number", operators: ["gt", "exists"] };
        expect(operatorsForField(field)).toEqual(["gt", "exists"]);
        expect(isOperatorAllowed(field, "gt")).toBe(true);
        expect(isOperatorAllowed(field, "lt")).toBe(false);
    });

    it("rejects type-incompatible operators by default", () => {
        expect(isOperatorAllowed({ type: "boolean" }, "gt")).toBe(false);
        expect(isOperatorAllowed({ type: "boolean" }, "eq")).toBe(true);
        expect(isOperatorAllowed({ type: "number" }, "contains")).toBe(false);
        expect(isOperatorAllowed({ type: "string" }, "contains")).toBe(true);
    });
});