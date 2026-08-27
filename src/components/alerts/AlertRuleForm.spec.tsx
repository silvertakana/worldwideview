import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useStore } from "@/core/state/store";
import { AlertRuleForm } from "./AlertRuleForm";
import type { AlertablePlugin } from "@/lib/alerts/alertablePlugins";

const PLUGINS: AlertablePlugin[] = [
    {
        id: "quakes",
        name: "Earthquakes",
        definitions: [
            { key: "magnitude", label: "Magnitude", type: "number" },
            { key: "place", label: "Place", type: "string" },
            { key: "felt", label: "Felt", type: "boolean" },
        ],
    },
];

describe("AlertRuleForm — condition builder", () => {
    beforeEach(() => {
        useStore.setState({
            alertRules: [],
            alertRulesLoading: false,
            alertRulesError: null,
            alertUnreadCount: 0,
            alertToasts: [],
        });
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders the plugin, field and operator selects for the default plugin/field", () => {
        render(<AlertRuleForm plugins={PLUGINS} />);

        const pluginSelect = screen.getByTestId("alert-rule-plugin-select");
        expect(pluginSelect).toBeDefined();
        expect(screen.getByTestId("alert-rule-field-select")).toBeDefined();

        const opSelect = screen.getByTestId("alert-rule-op-select") as HTMLSelectElement;
        const ops = Array.from(opSelect.options).map((o) => o.value);
        // Number fields: numeric + eq/neq/exists, never "contains".
        expect(ops).toEqual(["gt", "lt", "gte", "lte", "eq", "neq", "exists"]);
    });

    it("restricts operators when the field changes to a string type", () => {
        render(<AlertRuleForm plugins={PLUGINS} />);
        const fieldSelect = screen.getByTestId("alert-rule-field-select");
        fireEvent.change(fieldSelect, { target: { value: "place" } });

        const opSelect = screen.getByTestId("alert-rule-op-select") as HTMLSelectElement;
        const ops = Array.from(opSelect.options).map((o) => o.value);
        expect(ops).toEqual(["eq", "neq", "contains", "exists"]);
    });

    it("switches the value input to a true/false select for boolean fields", () => {
        render(<AlertRuleForm plugins={PLUGINS} />);
        const fieldSelect = screen.getByTestId("alert-rule-field-select");
        fireEvent.change(fieldSelect, { target: { value: "felt" } });

        const valueSelect = screen.getByTestId("alert-rule-value-select") as HTMLSelectElement;
        expect(Array.from(valueSelect.options).map((o) => o.value)).toEqual(["true", "false"]);
        expect(screen.queryByTestId("alert-rule-value-input")).toBeNull();
    });

    it("hides the value input for the exists operator", () => {
        render(<AlertRuleForm plugins={PLUGINS} />);
        const opSelect = screen.getByTestId("alert-rule-op-select");
        fireEvent.change(opSelect, { target: { value: "exists" } });
        expect(screen.queryByTestId("alert-rule-value-input")).toBeNull();
    });

    it("builds a correct number-typed condition payload on save", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 201,
            json: async () => ({ rule: { id: "r1" } }),
        });
        vi.stubGlobal("fetch", fetchMock);
        const onCreated = vi.fn();
        render(<AlertRuleForm plugins={PLUGINS} onCreated={onCreated} />);

        fireEvent.change(screen.getByTestId("alert-rule-name-input"), { target: { value: "Big quake" } });
        fireEvent.change(screen.getByTestId("alert-rule-value-input"), { target: { value: "5.5" } });
        fireEvent.click(screen.getByTestId("alert-rule-save"));

        await waitFor(() => expect(onCreated).toHaveBeenCalled());
        const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(call[0]).toBe("/api/alerts");
        expect(call[1].method).toBe("POST");
        expect(JSON.parse(String(call[1].body))).toEqual({
            pluginId: "quakes",
            name: "Big quake",
            condition: { field: "magnitude", op: "gt", value: 5.5 },
        });
    });

    it("omits value from the saved condition when operator is exists", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 201,
            json: async () => ({ rule: { id: "r2" } }),
        });
        vi.stubGlobal("fetch", fetchMock);
        const onCreated = vi.fn();
        render(<AlertRuleForm plugins={PLUGINS} onCreated={onCreated} />);

        fireEvent.change(screen.getByTestId("alert-rule-name-input"), { target: { value: "Has place" } });
        const opSelect = screen.getByTestId("alert-rule-op-select");
        fireEvent.change(opSelect, { target: { value: "exists" } });
        const fieldSelect = screen.getByTestId("alert-rule-field-select");
        fireEvent.change(fieldSelect, { target: { value: "place" } });
        // Changing the field resets the operator to the first allowed one (eq);
        // choose exists again after the reset.
        fireEvent.change(screen.getByTestId("alert-rule-op-select"), { target: { value: "exists" } });

        fireEvent.click(screen.getByTestId("alert-rule-save"));

        await waitFor(() => expect(onCreated).toHaveBeenCalled());
        const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        const body = JSON.parse(String(call[1].body)) as { condition: Record<string, unknown> };
        expect(body.condition).toEqual({ field: "place", op: "exists" });
        expect("value" in body.condition).toBe(false);
    });

    it("blocks saving without a rule name", () => {
        render(<AlertRuleForm plugins={PLUGINS} />);
        fireEvent.click(screen.getByTestId("alert-rule-save"));
        expect(screen.getByTestId("alert-form-error").textContent).toContain("name");
    });

    it("shows an explanatory empty state when no alertable plugins exist", () => {
        render(<AlertRuleForm plugins={[]} />);
        expect(screen.getByTestId("alert-form-empty")).toBeDefined();
        expect(screen.getByText(/getAlertDefinitions/)).toBeDefined();
    });
});