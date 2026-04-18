"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, ExternalLink, RefreshCw, Download } from "lucide-react";
import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { PluginIcon } from "@/components/common/PluginIcon";
import { pluginManager } from "@/core/plugins/PluginManager";
import { trackEvent } from "@/lib/analytics";
import { isPluginInstallEnabled } from "@/core/edition";
import "./PluginsTab.css";

// ─── Types ──────────────────────────────────────────────────

interface PluginRecord {
    pluginId: string;
    version: string;
    config: string;
    installedAt: string;
}

// ─── Trust Badge ────────────────────────────────────────────

function TrustBadge({ trust }: { trust: string }) {
    if (trust === "built-in") {
        return (
            <span className="trust-badge trust-badge--builtin">
                <Shield size={9} /> Built-in
            </span>
        );
    }
    if (trust === "verified") {
        return (
            <span className="trust-badge trust-badge--verified">
                <ShieldCheck size={9} /> Verified
            </span>
        );
    }
    return (
        <span className="trust-badge trust-badge--unverified">
            <ShieldAlert size={9} /> Unverified
        </span>
    );
}

// ─── Browse Link ────────────────────────────────────────────

function BrowseLink() {
    return (
        <a
            href="https://marketplace.worldwideview.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="plugins-tab__browse"
            onClick={() => trackEvent("marketplace-browse-click")}
        >
            <ExternalLink size={14} />
            Browse Marketplace
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

function getIcon(record: PluginRecord): string {
    const managed = pluginManager.getPlugin(record.pluginId);
    if (managed) {
        return typeof managed.plugin.icon === "string"
            ? managed.plugin.icon
            : "📦";
    }
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

// ─── PluginsTab ─────────────────────────────────────────────

export function PluginsTab() {
    const [plugins, setPlugins] = useState<PluginRecord[]>([]);
    const [removing, setRemoving] = useState<string | null>(null);
    const [updates, setUpdates] = useState<Record<string, string>>({});
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null);
    const [needsReload, setNeedsReload] = useState(false);

    const loadPlugins = useCallback(async () => {
        try {
            const res = await fetch("/api/marketplace/status");
            if (!res.ok) return;
            const data = await res.json();
            setPlugins(data.plugins ?? []);
        } catch {
            /* non-critical */
        }
    }, []);

    useEffect(() => {
        loadPlugins();
    }, [loadPlugins]);

    const handleUninstall = async (pluginId: string) => {
        if (!confirm(`Uninstall "${pluginId}"?`))
            return;
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
                }}>
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
                {plugins.map((record) => (
                    <div key={record.pluginId} className="plugin-item">
                        <span className="plugin-item__icon">
                            <PluginIcon icon={getIcon(record)} size={18} />
                        </span>
                        <div className="plugin-item__info">
                            <div className="plugin-item__header">
                                <span className="plugin-item__name">
                                    {getName(record)}
                                </span>
                                <span className="plugin-item__version">
                                    v{record.version}
                                </span>
                            </div>
                            <div className="plugin-item__meta">
                                <TrustBadge trust={getTrust(record)} />
                            </div>
                        </div>
                        {isPluginInstallEnabled && (
                            <div className="plugin-item__actions">
                                {updates[record.pluginId] ? (
                                    <button
                                        className="plugin-item__update"
                                        onClick={() => handleUpdate(record.pluginId, updates[record.pluginId])}
                                        disabled={updating === record.pluginId || removing === record.pluginId}
                                        title={`Update to v${updates[record.pluginId]}`}
                                    >
                                        <Download size={14} />
                                        Update (v{updates[record.pluginId]})
                                    </button>
                                ) : (
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
            </div>
            
            <div className="plugins-tab__actions-bottom">
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
                        Update All ({Object.keys(updates).length})
                    </button>
                )}
            </div>

            <BrowseLink />
        </div>
    );
}
