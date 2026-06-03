"use client";

/**
 * @file PluginsTab.tsx
 * @description Advanced management interface for the plugin ecosystem.
 * Handles discovery, installation, updates, and lifecycle management of
 * both built-in and marketplace plugins.
 * @module src/components/panels
 */

import { useState, useEffect, useCallback } from "react";
import {
 Trash2, ExternalLink, RefreshCw, Download, PowerOff, Power,
 ShieldCheck, ShieldAlert, HardDrive
} from "lucide-react";
import { PluginIcon } from "@/components/common/PluginIcon";
import type { ComponentType } from "react";
import { pluginManager } from "@/core/plugins/PluginManager";
import { useStore } from "@/core/state/store";
import { getDisabledPluginIds, setPluginDisabled } from "@/core/plugins/pluginPreferences";
import { trackEvent } from "@/lib/analytics";
import { isPluginInstallEnabled } from "@/core/edition";
import type { PluginManifest } from "@/core/plugins/PluginManifest";
import "./PluginsTab.css";

// ─── Types ──────────────────────────────────────────────────

interface PluginRecord {
    pluginId: string;
    version: string;
    config: string;
    installedAt: string;
    enabled?: boolean;
}

// ─── Trust Badge ────────────────────────────────────────────

function TrustBadge({ trust }: { trust: string }) {
    if (trust === "built-in") {
        return (
          <span className="trust-badge trust-badge--builtin">
            <HardDrive size={9} />
            {' '}
            Local
          </span>
        );
    }
    if (trust === "verified") {
        return (
          <span className="trust-badge trust-badge--verified">
            <ShieldCheck size={9} />
            {' '}
            Verified
          </span>
        );
    }
    return (
      <span className="trust-badge trust-badge--unverified">
        <ShieldAlert size={9} />
        {' '}
        Unverified
      </span>
    );
}

// ─── Browse Link ────────────────────────────────────────────

const MARKETPLACE_BASE = process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? "https://marketplace.worldwideview.dev";

function BrowseLink() {
    function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();
        trackEvent("marketplace-browse-click");
        const url = `${MARKETPLACE_BASE}?from_instance=${encodeURIComponent(window.location.origin)}`;
        window.open(url, "_blank", "noopener,noreferrer");
    }
    return (
      <a
        href={MARKETPLACE_BASE}
        target="_blank"
        rel="noopener noreferrer"
        className="plugins-tab__browse"
        data-testid="browse-plugins-btn"
        onClick={handleClick}
      >
        <ExternalLink size={14} />
        Browse Plugins
      </a>
    );
}

// ─── Helpers ────────────────────────────────────────────────

function getTrust(record: PluginRecord): string {
    if (record.version === "built-in") return "built-in";
    try {
        return JSON.parse(record.config).trust ?? "unverified";
    } catch {
        return "unverified";
    }
}

function getIcon(record: PluginRecord): string | ComponentType<{ size?: number; color?: string }> {
    const managed = pluginManager.getPlugin(record.pluginId);
    if (managed) return managed.plugin.icon ?? "📦";
    try {
        return JSON.parse(record.config).icon ?? "📦";
    } catch {
        return "📦";
    }
}

function getName(record: PluginRecord): string {
    const managed = pluginManager.getPlugin(record.pluginId);
    if (managed) return managed.plugin.name;
    try {
        return JSON.parse(record.config).name ?? record.pluginId;
    } catch {
        return record.pluginId;
    }
}

function getVersion(record: PluginRecord): string {
    if (record.version !== "built-in") return record.version;
    return pluginManager.getManifest(record.pluginId)?.version ?? "";
}

// ─── PluginsTab ─────────────────────────────────────────────

/**
 * @component PluginsTab
 * @description The marketplace and plugin management view.
 * Facilitates asynchronous plugin operations (install/uninstall/update)
 * and verifies integrity via trust badges.
 */
export function PluginsTab() {
    const [plugins, setPlugins] = useState<PluginRecord[]>([]);
    const [removing, setRemoving] = useState<string | null>(null);
    const [updates, setUpdates] = useState<Record<string, string>>({});
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null);
    const [needsReload, setNeedsReload] = useState(false);
    const [canInstall, setCanInstall] = useState<boolean>(isPluginInstallEnabled);

    const loadPlugins = useCallback(async () => {
        try {
            const res = await fetch("/api/marketplace/status");
            if (!res.ok) return;
            const data = await res.json();
            const dbPlugins: PluginRecord[] = data.plugins ?? [];
            const dbPluginMap = new Map(dbPlugins.map((p) => [p.pluginId, p]));

            // Add built-in and local plugins that don't have a DB record yet
            const disabledIds = getDisabledPluginIds();
            const allManaged = pluginManager.getAllPlugins();
            for (const managed of allManaged) {
                if (!dbPluginMap.has(managed.plugin.id)) {
                    dbPlugins.push({
                        pluginId: managed.plugin.id,
                        version: "built-in",
                        config: "{}",
                        installedAt: new Date().toISOString(),
                        enabled: !disabledIds.has(managed.plugin.id)
                    });
                }
            }

            // Apply localStorage disabled state to all records
            dbPlugins.forEach((p) => {
                if (disabledIds.has(p.pluginId)) p.enabled = false;
            });

            setPlugins(dbPlugins);
            if (typeof data.canManagePlugins === "boolean") {
                setCanInstall(data.canManagePlugins);
            }
        } catch {
            /* non-critical */
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadPlugins();
    }, [loadPlugins]);

    const handleUninstall = async (pluginId: string) => {
        if (!confirm(`Uninstall "${pluginId}"?`))
            { return; }
        setRemoving(pluginId);
        try {
            await fetch("/api/marketplace/uninstall", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pluginId }),
            });
            trackEvent("plugin-uninstall", { plugin: pluginId });
            setNeedsReload(true);
        } catch {
            setRemoving(null);
        }
    };

    const handleDisable = async (pluginId: string) => {
        setRemoving(pluginId);
        setPluginDisabled(pluginId, true);
        pluginManager.disablePlugin(pluginId);
        const state = useStore.getState();
        state.setLayerEnabled(pluginId, false);
        state.clearEntities(pluginId);
        state.setEntityCount(pluginId, 0);
        if (state.hoveredEntity?.pluginId === pluginId) state.setHoveredEntity(null, null);
        if (state.selectedEntity?.pluginId === pluginId) state.setSelectedEntity(null);
        setNeedsReload(true);
        trackEvent("plugin-disable", { plugin: pluginId });
        await loadPlugins();
        setRemoving(null);
    };

    const handleEnable = async (pluginId: string) => {
        setRemoving(pluginId);
        setPluginDisabled(pluginId, false);
        setNeedsReload(false);

        const alreadyRegistered = pluginManager.getPlugin(pluginId);
        if (!alreadyRegistered) {
            // Plugin was disabled at startup — its script was never loaded.
            // Hot-load the script so it's available; leave the layer toggle off.
            try {
                const res = await fetch("/api/marketplace/load");
                if (res.ok) {
                    const { manifests } = await res.json() as { manifests: PluginManifest[] };
                    const manifest = manifests.find((m) => m.id === pluginId);
                    if (manifest) {
                        await pluginManager.loadFromManifest(manifest);
                        useStore.getState().initLayer(pluginId, false);
                    }
                }
            } catch (err) {
                console.error("[PluginsTab] Failed to hot-load plugin:", pluginId, err);
            }
        }
        // Layer stays off — user controls it via the Data Layers toggle.

        trackEvent("plugin-enable", { plugin: pluginId });
        await loadPlugins();
        setRemoving(null);
    };

    const handleCheckUpdates = async () => {
        setCheckingUpdates(true);
        try {
            const res = await fetch("/api/marketplace/check-updates");
            if (res.ok) {
                const data = await res.json();
                setUpdates(data.updates || {});
                trackEvent("check-plugin-updates", { count: Object.keys(data.updates || {}).length });
            }
        } finally {
            setCheckingUpdates(false);
        }
    };

    const handleUpdate = async (pluginId: string, newVersion: string) => {
        setUpdating(pluginId);
        try {
            const res = await fetch("/api/marketplace/install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pluginId, version: newVersion }),
            });
            if (res.ok) {
                trackEvent("plugin-update", { plugin: pluginId, version: newVersion });
                setUpdates((prev) => {
                    const next = { ...prev };
                    delete next[pluginId];
                    return next;
                });
                setUpdating(null);
                setNeedsReload(true);
            } else {
                setUpdating(null);
                alert("Failed to update plugin.");
            }
        } catch {
            setUpdating(null);
            alert("Network error during update.");
        }
    };

    const handleUpdateAll = async () => {
        const updateKeys = Object.keys(updates);
        if (updateKeys.length === 0) return;

        let allSuccess = true;
        for (const pluginId of updateKeys) {
            setUpdating(pluginId);
            try {
                const res = await fetch("/api/marketplace/install", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pluginId, version: updates[pluginId] }),
                });
                if (res.ok) {
                    trackEvent("plugin-update", { plugin: pluginId, version: updates[pluginId] });
                    setUpdates((prev) => {
                        const next = { ...prev };
                        delete next[pluginId];
                        return next;
                    });
                } else {
                    allSuccess = false;
                }
            } catch {
                allSuccess = false;
            }
        }
        setUpdating(null);
        if (!allSuccess) {
            alert("Some updates failed.");
        } else {
            setNeedsReload(true);
        }
    };

    if (plugins.length === 0) {
        return (
          <div className="plugins-tab">
            <div className="plugins-tab__empty">
              <div className="plugins-tab__empty-icon">🧩</div>
              <div>No plugins installed yet</div>
            </div>
            <BrowseLink />
          </div>
        );
    }

    return (
      <div className="plugins-tab">
        {needsReload && (
        <div style={{
                    padding: "var(--space-md)",
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "var(--space-md)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexShrink: 0
                }}
        >
          <span style={{ fontSize: "12px", color: "var(--accent-amber)" }}>Changes require a reload.</span>
          <button
            onClick={() => window.location.reload()}
            style={{
                            padding: "4px 10px",
                            backgroundColor: "rgba(245, 158, 11, 0.15)",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                            fontSize: "11px",
                            color: "var(--accent-amber)",
                            fontWeight: 600
                        }}
          >
            Reload App
          </button>
        </div>
            )}
        <div className="plugins-tab__list">
          {plugins.filter((p) => p.enabled !== false).map((record) => (
            <div key={record.pluginId} className="plugin-item">
              <span className="plugin-item__icon">
                <PluginIcon icon={getIcon(record)} size={18} />
              </span>
              <div className="plugin-item__info">
                <div className="plugin-item__header">
                  <span className="plugin-item__name">
                    {getName(record)}
                  </span>
                  {getVersion(record) && (
                  <span className="plugin-item__version">
                    v
                    {getVersion(record)}
                  </span>
                  )}
                </div>
                <div className="plugin-item__meta">
                  <TrustBadge trust={getTrust(record)} />
                </div>
              </div>
              {canInstall && (
                <div className="plugin-item__actions">
                  {updates[record.pluginId] ? (
                    <button
                      className="plugin-item__update"
                      onClick={() => handleUpdate(record.pluginId, updates[record.pluginId])}
                      disabled={updating === record.pluginId || removing === record.pluginId}
                      title={`Update to v${updates[record.pluginId]}`}
                    >
                      <Download size={14} />
                      Update (v
                      {updates[record.pluginId]}
                      )
                    </button>
                                ) : (
                                  <>
                                    <button
                                      className="plugin-item__disable"
                                      onClick={() => handleDisable(record.pluginId)}
                                      disabled={removing === record.pluginId || updating === record.pluginId}
                                      title={`Disable ${record.pluginId}`}
                                    >
                                      <PowerOff size={14} />
                                    </button>
                                    {record.version !== "built-in" && (
                                    <button
                                      className="plugin-item__uninstall"
                                      onClick={() => handleUninstall(record.pluginId)}
                                      disabled={removing === record.pluginId || updating === record.pluginId}
                                      title={`Uninstall ${record.pluginId}`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                        )}
                                  </>
                                )}
                </div>
                        )}
            </div>
                ))}

          {plugins.filter((p) => p.enabled === false).length > 0 && (
            <>
              <div className="plugins-tab__section-title">Disabled</div>
              {plugins.filter((p) => p.enabled === false).map((record) => (
                <div key={record.pluginId} className="plugin-item plugin-item--disabled">
                  <span className="plugin-item__icon">
                    <PluginIcon icon={getIcon(record)} size={18} />
                  </span>
                  <div className="plugin-item__info">
                    <div className="plugin-item__header">
                      <span className="plugin-item__name">
                        {getName(record)}
                      </span>
                      {getVersion(record) && (
                      <span className="plugin-item__version">
                        v
                        {getVersion(record)}
                      </span>
                      )}
                    </div>
                    <div className="plugin-item__meta">
                      <TrustBadge trust={getTrust(record)} />
                    </div>
                  </div>
                  {canInstall && (
                  <div className="plugin-item__actions">
                    <button
                      className="plugin-item__enable"
                      onClick={() => handleEnable(record.pluginId)}
                      disabled={removing === record.pluginId || updating === record.pluginId}
                      title={`Enable ${record.pluginId}`}
                    >
                      <Power size={14} />
                    </button>
                    {record.version !== "built-in" && (
                    <button
                      className="plugin-item__uninstall"
                      onClick={() => handleUninstall(record.pluginId)}
                      disabled={removing === record.pluginId || updating === record.pluginId}
                      title={`Uninstall ${record.pluginId}`}
                    >
                      <Trash2 size={14} />
                    </button>
                                        )}
                  </div>
                                )}
                </div>
                        ))}
            </>
                )}
        </div>

        {canInstall && (
        <div className="plugins-tab__actions-bottom">
          <BrowseLink />

          <button
            className="plugins-tab__check-updates"
            onClick={handleCheckUpdates}
            disabled={checkingUpdates}
          >
            <RefreshCw size={14} className={checkingUpdates ? "spinning" : ""} />
            {checkingUpdates ? "Checking..." : "Check for Updates"}
          </button>

          {Object.keys(updates).length > 1 && (
          <button
            className="plugins-tab__update-all"
            onClick={handleUpdateAll}
            disabled={updating !== null}
          >
            <Download size={14} />
            Update All (
            {Object.keys(updates).length}
            )
          </button>
                    )}
        </div>
            )}
      </div>
    );
}
