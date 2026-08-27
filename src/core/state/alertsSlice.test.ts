import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { AlertRuleSnapshot, GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import type { AlertRuleRecord } from "@/lib/alerts/api";
import { createAlertsSlice, type AlertsSlice } from "./alertsSlice";

/** Slice-only store: other slices are absent, so cross-slice helpers no-op. */
type TestStore = AlertsSlice;
let store: StoreApi<TestStore>;

const RULE: AlertRuleRecord = {
    id: "rule-1",
    pluginId: "earthquakes",
    name: "Big quake",
    condition: { field: "magnitude", op: "gt", value: 5 },
    enabled: true,
    createdAt: "2026-08-25T00:00:00Z",
    updatedAt: "2026-08-25T00:00:00Z",
};

const firedEvent: { rule: AlertRuleSnapshot; entity: GeoEntity; pluginId: string } = {
    rule: { id: "rule-1", name: "Big quake", pluginId: "earthquakes", condition: { field: "magnitude", op: "gt", value: 5 } },
    entity: {
        id: "q-1",
        pluginId: "earthquakes",
        latitude: 61,
        longitude: -149,
        timestamp: new Date("2026-08-25T00:00:00Z"),
        label: "M6.2 Alaska",
        properties: { magnitude: 6.2, place: "Alaska" },
    },
    pluginId: "earthquakes",
};

describe("alertsSlice", () => {
    beforeEach(() => {
        store = createStore<TestStore>((set, get, api) =>
            createAlertsSlice(set as never, get as never, api as never),
        );
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("initializes with empty rules and no unread alerts", () => {
        const state = store.getState();
        expect(state.alertRules).toEqual([]);
        expect(state.alertUnreadCount).toBe(0);
        expect(state.alertToasts).toEqual([]);
        expect(state.alertRulesLoading).toBe(false);
    });

    it("fetchAlerts loads rules from GET /api/alerts", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ rules: [RULE] }),
        });
        vi.stubGlobal("fetch", fetchMock);

        await store.getState().fetchAlerts();
        expect(fetchMock).toHaveBeenCalledWith("/api/alerts", expect.objectContaining({ cache: "no-store" }));
        expect(store.getState().alertRules).toEqual([RULE]);
        expect(store.getState().alertRulesLoading).toBe(false);
    });

    it("fetchAlerts records an error when the request fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ message: "boom" }) }));
        await store.getState().fetchAlerts();
        expect(store.getState().alertRulesError).toBe("boom");
        expect(store.getState().alertRulesLoading).toBe(false);
    });

    it("createAlert POSTs the payload and prepends the created rule", async () => {
        const created = { ...RULE, id: "rule-2" };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 201,
            json: async () => ({ rule: created }),
        });
        vi.stubGlobal("fetch", fetchMock);
        store.setState({ alertRules: [] });

        const result = await store.getState().createAlert({
            pluginId: "earthquakes",
            name: "Big quake",
            condition: { field: "magnitude", op: "gt", value: 5 },
        });

        expect(result.ok).toBe(true);
        const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("/api/alerts");
        expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)))
            .toEqual({ pluginId: "earthquakes", name: "Big quake", condition: { field: "magnitude", op: "gt", value: 5 } });
        expect(store.getState().alertRules[0]).toEqual(created);
    });

    it("createAlert surfaces the server error without mutating the list", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 422,
            json: async () => ({ message: "condition.op must be one of: ..." }),
        }));
        const result = await store.getState().createAlert({
            pluginId: "earthquakes",
            name: "x",
            condition: { field: "m", op: "bogus" as never, value: 1 },
        });
        expect(result.ok).toBe(false);
        expect(result.error).toContain("condition.op");
        expect(store.getState().alertRules).toEqual([]);
    });

    it("setAlertEnabled PATCHes enabled and updates the rule", async () => {
        store.setState({ alertRules: [{ ...RULE, enabled: true }] });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ rule: { ...RULE, enabled: false } }),
        });
        vi.stubGlobal("fetch", fetchMock);

        await store.getState().setAlertEnabled("rule-1", false);
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/alerts/rule-1",
            expect.objectContaining({ method: "PATCH" }),
        );
        expect(store.getState().alertRules[0].enabled).toBe(false);
    });

    it("setAlertEnabled reverts on failure", async () => {
        store.setState({ alertRules: [{ ...RULE, enabled: true }] });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 422,
            json: async () => ({ message: "enabled must be a boolean" }),
        }));
        await store.getState().setAlertEnabled("rule-1", false);
        expect(store.getState().alertRules[0].enabled).toBe(true);
    });

    it("deleteAlert removes the rule after a successful DELETE", async () => {
        store.setState({ alertRules: [RULE] });
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
        vi.stubGlobal("fetch", fetchMock);

        await store.getState().deleteAlert("rule-1");
        expect(fetchMock).toHaveBeenCalledWith("/api/alerts/rule-1", expect.objectContaining({ method: "DELETE" }));
        expect(store.getState().alertRules).toEqual([]);
    });

    it("handles a fired alert: increments unread and queues a toast", () => {
        store.getState().handleAlertFired(firedEvent);
        expect(store.getState().alertUnreadCount).toBe(1);
        expect(store.getState().alertToasts).toHaveLength(1);
        expect(store.getState().alertToasts[0].entityLabel).toBe("M6.2 Alaska");
        expect(store.getState().alertToasts[0].ruleName).toBe("Big quake");
    });

    it("uses the entity properties place as fallback toast label", () => {
        const event = {
            ...firedEvent,
            entity: { ...firedEvent.entity, label: undefined },
        };
        store.getState().handleAlertFired(event);
        expect(store.getState().alertToasts[0].entityLabel).toBe("Alaska");
    });

    it("caps the toast queue at four entries", () => {
        for (let i = 0; i < 6; i += 1) store.getState().handleAlertFired(firedEvent);
        expect(store.getState().alertToasts).toHaveLength(4);
        expect(store.getState().alertUnreadCount).toBe(6);
    });

    it("clearAlertUnread and dismissAlertToast update state", () => {
        store.getState().handleAlertFired(firedEvent);
        store.getState().dismissAlertToast(store.getState().alertToasts[0].id);
        expect(store.getState().alertToasts).toHaveLength(0);
        store.getState().clearAlertUnread();
        expect(store.getState().alertUnreadCount).toBe(0);
    });
});