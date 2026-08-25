/**
 * @file alertsSlice.ts
 * @description Zustand slice for alert rules, alert toasts and the unread badge.
 * Owns the rules list (GET/POST/PATCH/DELETE /api/alerts) and the client-side
 * side-effects of the `alertFired` bus event (toast queue + unread count).
 */

import type { StateCreator } from "zustand";
import type { AlertCondition, AlertRuleSnapshot, GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import type { AppStore } from "./store";
import {
    createAlertRule,
    deleteAlertRule,
    fetchAlertRules,
    updateAlertRule,
    type AlertRuleRecord,
} from "@/lib/alerts/api";
import { requestAlertRulesRefresh } from "@/lib/alerts/engine";

export interface AlertToastItem {
    id: string;
    ruleName: string;
    pluginId: string;
    entityLabel: string;
    firedAt: number;
}

export interface CreateAlertInput {
    pluginId: string;
    name: string;
    condition: AlertCondition;
}

export interface CreateAlertResult {
    ok: boolean;
    error?: string;
    rule?: AlertRuleRecord;
}

export interface AlertsSlice {
    /** The current user's alert rules, newest first. */
    alertRules: AlertRuleRecord[];
    alertRulesLoading: boolean;
    alertRulesError: string | null;
    /** Unread alert count shown on the bell/badge. */
    alertUnreadCount: number;
    /** Recently fired alerts rendered as toasts (newest last). */
    alertToasts: AlertToastItem[];
    fetchAlerts: () => Promise<void>;
    createAlert: (input: CreateAlertInput) => Promise<CreateAlertResult>;
    setAlertEnabled: (id: string, enabled: boolean) => Promise<void>;
    deleteAlert: (id: string) => Promise<void>;
    handleAlertFired: (event: { rule: AlertRuleSnapshot; entity: GeoEntity; pluginId: string }) => void;
    clearAlertUnread: () => void;
    dismissAlertToast: (id: string) => void;
}

const MAX_TOASTS = 4;
let toastSeq = 0;

function entityLabel(entity: GeoEntity): string {
    if (entity.label) return entity.label;
    const place = entity.properties?.place;
    if (typeof place === "string" && place !== "") return place;
    return entity.id;
}

export const createAlertsSlice: StateCreator<AppStore, [], [], AlertsSlice> = (set, get) => ({
    alertRules: [],
    alertRulesLoading: false,
    alertRulesError: null,
    alertUnreadCount: 0,
    alertToasts: [],

    fetchAlerts: async () => {
        set({ alertRulesLoading: true, alertRulesError: null });
        try {
            const rules = await fetchAlertRules();
            set({ alertRules: rules, alertRulesLoading: false });
        } catch (err) {
            set({
                alertRulesError: err instanceof Error ? err.message : "Failed to load alert rules",
                alertRulesLoading: false,
            });
        }
    },

    createAlert: async (input) => {
        const result = await createAlertRule(input);
        if (!result.ok || !result.rule) {
            return { ok: false, error: result.error ?? "Failed to create alert rule" };
        }
        set((state) => ({
            alertRules: [result.rule as AlertRuleRecord, ...state.alertRules],
        }));
        requestAlertRulesRefresh();
        return { ok: true, rule: result.rule };
    },

    setAlertEnabled: async (id, enabled) => {
        // Optimistic flip; revert + surface the error when the server disagrees.
        set((state) => ({
            alertRules: state.alertRules.map((rule) =>
                rule.id === id ? { ...rule, enabled } : rule,
            ),
        }));
        const result = await updateAlertRule(id, { enabled });
        if (!result.ok) {
            set((state) => ({
                alertRules: state.alertRules.map((rule) =>
                    rule.id === id ? { ...rule, enabled: !enabled } : rule,
                ),
                alertRulesError: result.error ?? "Failed to update rule",
            }));
            get().showErrorToast?.(result.error ?? "Failed to update alert rule");
            return;
        }
        requestAlertRulesRefresh();
    },

    deleteAlert: async (id) => {
        const result = await deleteAlertRule(id);
        if (!result.ok) {
            get().showErrorToast?.(result.error ?? "Failed to delete alert rule");
            return;
        }
        set((state) => ({
            alertRules: state.alertRules.filter((rule) => rule.id !== id),
        }));
        requestAlertRulesRefresh();
    },

    handleAlertFired: ({ rule, entity, pluginId }) => {
        set((state) => {
            const nextToast: AlertToastItem = {
                id: `alert-toast-${++toastSeq}-${Date.now()}`,
                ruleName: rule.name,
                pluginId,
                entityLabel: entityLabel(entity),
                firedAt: Date.now(),
            };
            const alertToasts = [...state.alertToasts, nextToast].slice(-MAX_TOASTS);
            return {
                alertUnreadCount: state.alertUnreadCount + 1,
                alertToasts,
            };
        });
    },

    clearAlertUnread: () => set({ alertUnreadCount: 0 }),

    dismissAlertToast: (id) =>
        set((state) => ({
            alertToasts: state.alertToasts.filter((toast) => toast.id !== id),
        })),
});