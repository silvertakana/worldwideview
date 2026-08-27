import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useStore } from "@/core/state/store";
import { AlertsPanel } from "./AlertsPanel";

const RULES = [
    {
        id: "rule-a",
        pluginId: "quakes",
        name: "Big quake",
        condition: { field: "magnitude", op: "gt", value: 5 },
        enabled: true,
        createdAt: "2026-08-25T00:00:00Z",
        updatedAt: "2026-08-25T00:00:00Z",
    },
    {
        id: "rule-b",
        pluginId: "quakes",
        name: "Place alert",
        condition: { field: "place", op: "contains", value: "Alaska" },
        enabled: false,
        createdAt: "2026-08-24T00:00:00Z",
        updatedAt: "2026-08-24T00:00:00Z",
    },
];

describe("AlertsPanel — rule list", () => {
    beforeEach(() => {
        useStore.setState({
            alertRules: [],
            alertRulesLoading: false,
            alertRulesError: null,
            alertUnreadCount: 3,
            alertToasts: [],
        });
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders rules with name, plugin and a labelled condition summary", async () => {
        // No alert definitions registered -> raw condition fallback text.
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ rules: RULES }),
        }));
        render(<AlertsPanel />);

        expect(await screen.findByTestId("alerts-list")).toBeDefined();
        expect(screen.getByText("Big quake")).toBeDefined();
        expect(screen.getByText("Place alert")).toBeDefined();
        // No alert definitions registered -> raw key fallback with operator words.
        expect(screen.getByTestId("alert-condition-rule-a").textContent).toBe("magnitude greater than 5");
        expect(screen.getByTestId("alert-condition-rule-b").textContent).toBe("place contains \"Alaska\"");
        // Opening the panel clears the unread badge.
        expect(useStore.getState().alertUnreadCount).toBe(0);
    });

    it("renders the empty state when there are no rules", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rules: [] }) }));
        render(<AlertsPanel />);
        expect(await screen.findByTestId("alerts-empty")).toBeDefined();
        expect(screen.queryByTestId("alerts-list")).toBeNull();
    });

    it("surfaces a load error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ message: "db down" }) }));
        render(<AlertsPanel />);
        expect((await screen.findByTestId("alerts-error")).textContent).toContain("db down");
    });

    it("toggle sends a PATCH and flips the stored rule", async () => {
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ rules: RULES }) }) // GET
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ rule: { ...RULES[0], enabled: false } }) })); // PATCH
        render(<AlertsPanel />);
        await screen.findByTestId("alerts-list");

        fireEvent.click(screen.getByTestId("alert-toggle-rule-a"));
        await waitFor(() => expect(useStore.getState().alertRules[0].enabled).toBe(false));

        const patchCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1] as unknown as [string, RequestInit];
        expect(patchCall[0]).toBe("/api/alerts/rule-a");
        expect(patchCall[1].method).toBe("PATCH");
        expect(JSON.parse(String(patchCall[1].body))).toEqual({ enabled: false });
    });

    it("delete confirms then DELETEs and removes the row", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ rules: RULES }) }) // GET
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) })); // DELETE
        render(<AlertsPanel />);
        await screen.findByTestId("alerts-list");

        fireEvent.click(screen.getByTestId("alert-delete-rule-a"));
        await waitFor(() => expect(useStore.getState().alertRules.some((r) => r.id === "rule-a")).toBe(false));

        const deleteCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1] as unknown as [string, RequestInit];
        expect(deleteCall[0]).toBe("/api/alerts/rule-a");
        expect(deleteCall[1].method).toBe("DELETE");
    });

    it("skips the DELETE when the confirmation is declined", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(false);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rules: RULES }) }));
        render(<AlertsPanel />);
        await screen.findByTestId("alerts-list");

        fireEvent.click(screen.getByTestId("alert-delete-rule-a"));
        expect(useStore.getState().alertRules).toHaveLength(2);
        expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    });

    it("toggles into the create form via New Rule", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rules: [] }) }));
        render(<AlertsPanel />);
        await screen.findByTestId("alerts-empty");

        fireEvent.click(screen.getByTestId("alert-create-button"));
        // With no alertable plugins registered the builder shows its empty state.
        expect(screen.getByTestId("alert-form-empty")).toBeDefined();
    });
});