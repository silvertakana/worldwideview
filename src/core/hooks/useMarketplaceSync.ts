"use client";

import {
 useEffect, useRef, useState, useCallback
} from "react";
import { pluginManager } from "@/core/plugins/PluginManager";
import { useStore } from "@/core/state/store";
import type { PluginManifest } from "@/core/plugins/PluginManifest";
import {
  getApprovedUnverifiedIds,
  approveUnverifiedPlugin,
  getDeniedUnverifiedIds,
  denyUnverifiedPlugin,
} from "@/lib/marketplace/trustedPlugins";
import { getDisabledPluginIds } from "@/core/plugins/pluginPreferences";
import { isDemo } from "@/core/edition";

/**
 * Syncs marketplace-installed plugins on window focus.
 * - Hot-loads new marketplace plugins without a page refresh.
 * - Detects built-in plugin changes that require a reload.
 * - Gates unverified plugins behind user approval (batch dialog).
 */
export function useMarketplaceSync(hostReady: boolean) {
    const initLayer = useStore((s) => s.initLayer);
    const loadedIds = useRef<Set<string>>(new Set());
    const initialDisabledIds = useRef<Set<string> | null>(null);
    const [needsReload, setNeedsReload] = useState(false);
    const [pendingUnverified, setPendingUnverified] = useState<PluginManifest[]>([]);

    /** Snapshot current disabled set on first run. */
    async function captureInitialDisabled() {
        if (initialDisabledIds.current !== null) return;
        try {
            const res = await fetch("/api/marketplace/disabled-builtins");
            if (res.ok) {
                const data = await res.json();
                initialDisabledIds.current = new Set<string>(data.disabledIds ?? []);
            } else {
                initialDisabledIds.current = new Set();
            }
        } catch {
            initialDisabledIds.current = new Set();
        }
    }

    /** Detect if disabled built-in set has changed since startup. */
    async function checkBuiltinChanges() {
        try {
            const res = await fetch("/api/marketplace/disabled-builtins");
            if (!res.ok) return;
            const data = await res.json();
            const currentDisabled = new Set<string>(data.disabledIds ?? []);

            if (!initialDisabledIds.current) return;
            const initial = initialDisabledIds.current;

            if (currentDisabled.size !== initial.size) {
                setNeedsReload(true);
                return;
            }
            for (const id of currentDisabled) {
                if (!initial.has(id)) { setNeedsReload(true); return; }
            }
        } catch {
            // Non-critical
        }
    }

    async function loadManifest(manifest: PluginManifest) {
        if (!manifest.id || loadedIds.current.has(manifest.id)) return;
        if (getDisabledPluginIds().has(manifest.id)) return;
        if (pluginManager.getPlugin(manifest.id)) {
            loadedIds.current.add(manifest.id);
            return;
        }

        try {
            console.log(`[MarketplaceSync] Loading manifest: ${manifest.id}`);
            await pluginManager.loadFromManifest(manifest);

            let shouldEnable = false;
            if (isDemo) {
                const envVar = process.env.NEXT_PUBLIC_DEMO_DEFAULT_PLUGINS || "";
                const demoDefaultPlugins = new Set<string>();
                envVar.split(",").forEach((s) => {
                    const clean = s.trim();
                    if (clean) demoDefaultPlugins.add(clean);
                });
                shouldEnable = demoDefaultPlugins.has(manifest.id);
            }

            initLayer(manifest.id, shouldEnable);
            if (shouldEnable) {
                await pluginManager.enablePlugin(manifest.id);
            }

            loadedIds.current.add(manifest.id);
            console.log(`[MarketplaceSync] Hot-loaded plugin "${manifest.id}"`);
        } catch (err) {
            console.error(`[MarketplaceSync] Failed to load "${manifest.id}":`, err);
            const store = useStore.getState();
            if (store.showErrorToast) {
                store.showErrorToast(`Failed to load plugin: ${manifest.name || manifest.id}. Check console.`);
            }
        }
    }

    /** Hot-load new marketplace plugins, gating unverified ones. */
    async function syncMarketplacePlugins() {
        try {
            const res = await fetch("/api/marketplace/load");
            const json = await res.json();
            console.debug(`[MarketplaceSync] Received marketplace manifest json`);

            if (!res.ok) {
                throw new Error(json.error || `Failed to fetch marketplace configuration (Status ${res.status})`);
            }

            const { manifests } = json as { manifests: PluginManifest[] };
            const approved = getApprovedUnverifiedIds();
            const denied = getDeniedUnverifiedIds();
            const newPending: PluginManifest[] = [];

            for (const manifest of manifests) {
                if (!manifest.id) continue;
                if (loadedIds.current.has(manifest.id)) continue;

                // Unverified + not yet approved → collect for batch review.
                // Permanently denied plugins are skipped so re-syncs don't re-open the dialog.
                // On demo, skip the gate — admin already approved by installing
                if (!isDemo && manifest.trust === "unverified" && !approved.has(manifest.id)) {
                    if (!denied.has(manifest.id)) {
                        newPending.push(manifest);
                    }
                    continue;
                }

                await loadManifest(manifest);
            }

            // Present all pending unverified plugins at once
            if (newPending.length > 0) {
                setPendingUnverified((prev) => {
                    const existingIds = new Set(prev.map((m) => m.id));
                    const merged = [...prev];
                    for (const m of newPending) {
                        if (!existingIds.has(m.id)) merged.push(m);
                    }
                    return merged;
                });
            }
        } catch (err) {
            console.error("[MarketplaceSync] Sync failed:", err);
        }
    }

    /** Called when user selects which unverified plugins to install. */
    const approveSelected = useCallback(async (ids: string[]) => {
        const idSet = new Set(ids);
        const toLoad: PluginManifest[] = [];

        for (const manifest of pendingUnverified) {
            if (idSet.has(manifest.id)) {
                approveUnverifiedPlugin(manifest.id);
                toLoad.push(manifest);
            }
        }

        for (const manifest of toLoad) {
            await loadManifest(manifest);
        }

        setPendingUnverified([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingUnverified, initLayer]);

    /** Called when user denies all pending unverified plugins. */
    const denyAll = useCallback(() => {
        // Persist the denials so a later sync (e.g. window focus) doesn't re-pend them.
        for (const manifest of pendingUnverified) {
            denyUnverifiedPlugin(manifest.id);
        }
        setPendingUnverified([]);
    }, [pendingUnverified]);

    const syncPlugins = useCallback(async () => {
        if (!hostReady) return;
        await captureInitialDisabled();
        await syncMarketplacePlugins();
        await checkBuiltinChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initLayer, hostReady]);

    useEffect(() => {
        if (!hostReady) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        syncPlugins();

        // Debounce focus-triggered re-syncs: rapid focus/blur pairs (e.g. from
        // iframe or sibling-window activity) shouldn't each trigger a full sync.
        const FOCUS_SYNC_DEBOUNCE_MS = 1500;
        let lastSyncAt = Date.now();
        let syncInFlight = false;

        const handleFocus = () => {
            if (syncInFlight) return;
            if (Date.now() - lastSyncAt < FOCUS_SYNC_DEBOUNCE_MS) return;
            syncInFlight = true;
            lastSyncAt = Date.now();
            syncPlugins().finally(() => {
                syncInFlight = false;
            });
        };
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [syncPlugins, hostReady]);

    return {
 syncPlugins, needsReload, pendingUnverified, approveSelected, denyAll
};
}
