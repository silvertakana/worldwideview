/**
 * Client-side alert engine (P2, v1 — app-side evaluation).
 *
 * Attaches to the app DataBus: on `dataUpdated` it evaluates the current
 * user's enabled rules for that plugin channel, emits `alertFired` on the
 * same bus (UI agent subscribes for toasts/panel), and fire-and-forget
 * persists an AlertEvent via POST /api/alerts/events.
 *
 * SSR-safe: no ambient browser state at module scope and the React hook only
 * attaches inside useEffect (which never runs during SSR).
 */

import { useEffect } from "react";
import type { AlertRuleSnapshot, DataBusEvents, GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import { dataBus } from "@/core/data/DataBus";
import { evaluateRule } from "./evaluate";

export const DEDUPE_WINDOW_MS = 60_000;
export const RULES_REFRESH_MS = 60_000;

/** Rule as loaded from the API (snapshot + server flags). */
export interface RuleRecord extends AlertRuleSnapshot {
    enabled: boolean;
}

/** Structural subset of the DataBus the engine needs (mockable in tests). */
export interface AlertBusLike {
    on<K extends keyof DataBusEvents>(event: K, handler: (data: DataBusEvents[K]) => void): () => void;
    off<K extends keyof DataBusEvents>(event: K, handler: (data: DataBusEvents[K]) => void): void;
    emit<K extends keyof DataBusEvents>(event: K, data: DataBusEvents[K]): void;
}

export interface AlertEngineOptions {
    /** Rule source; defaults to GET /api/alerts. Injectable for tests. */
    fetchRules?: () => Promise<RuleRecord[]>;
    /** Match persister; defaults to POST /api/alerts/events. Injectable for tests. */
    persistEvent?: (match: {
        ruleId: string;
        pluginId: string;
        entityId: string | null;
        summary: string;
    }) => Promise<unknown>;
    /** Clock source (dedupe window); injectable for tests. */
    now?: () => number;
}

async function defaultFetchRules(): Promise<RuleRecord[]> {
    const res = await fetch("/api/alerts", { cache: "no-store" });
    if (!res.ok) throw new Error(`[alerts] Failed to load rules: ${res.status}`);
    const data = (await res.json()) as { rules?: RuleRecord[] };
    return data.rules ?? [];
}

function defaultPersistEvent(match: {
    ruleId: string;
    pluginId: string;
    entityId: string | null;
    summary: string;
}): Promise<unknown> {
    return fetch("/api/alerts/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(match),
    }).catch(() => undefined);
}

/**
 * Subscribe a bus to data updates and fire alerts per the user's enabled rules.
 * Returns a cleanup function (unsubscribe + stop rule refresh).
 */
export function attachAlertEngine(
    bus: AlertBusLike,
    opts: AlertEngineOptions = {},
): () => void {
    const fetchRules = opts.fetchRules ?? defaultFetchRules;
    const persistEvent = opts.persistEvent ?? defaultPersistEvent;
    const now = opts.now ?? Date.now;

    let rules: RuleRecord[] = [];
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    const lastFired = new Map<string, number>();

    const refreshRules = async (): Promise<void> => {
        try {
            rules = await fetchRules();
        } catch {
            // Keep the last-known rules; the next refresh retries.
        }
    };

    const handleDataUpdated = ({ pluginId, entities }: DataBusEvents["dataUpdated"]): void => {
        if (entities.length === 0) return;
        const relevant = rules.filter((rule) => rule.enabled && rule.pluginId === pluginId);
        if (relevant.length === 0) return;

        for (const entity of entities) {
            for (const rule of relevant) {
                if (!evaluateRule({ condition: rule.condition, name: rule.name, pluginId }, entity)) {
                    continue;
                }
                const key = `${rule.id}:${entity.id}`;
                const last = lastFired.get(key);
                if (last !== undefined && now() - last < DEDUPE_WINDOW_MS) continue;
                lastFired.set(key, now());

                bus.emit("alertFired", { rule, entity: entity as GeoEntity, pluginId });
                void persistEvent({
                    ruleId: rule.id,
                    pluginId,
                    entityId: entity.id,
                    summary: `${rule.name} matched ${pluginId} entity ${entity.id}`,
                });

                if (lastFired.size > 500) {
                    for (const [k, t] of lastFired) {
                        if (now() - t >= DEDUPE_WINDOW_MS) lastFired.delete(k);
                    }
                }
            }
        }
    };

    const unsubscribe = bus.on("dataUpdated", handleDataUpdated);
    void refreshRules();
    refreshTimer = setInterval(() => void refreshRules(), RULES_REFRESH_MS);

    return () => {
        unsubscribe();
        if (refreshTimer !== null) clearInterval(refreshTimer);
        lastFired.clear();
    };
}

/**
 * React hook — attach the engine to the app-level dataBus for the lifetime of
 * the mounting client component. Returns nothing; `alertFired` events surface
 * through the dataBus for UI consumers (toasts/badge/panel — UI agent).
 */
export function useAlertEngine(): void {
    useEffect(() => {
        if (typeof window === "undefined") return;
        return attachAlertEngine(dataBus);
    }, []);
}