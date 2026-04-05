"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, ExternalLink } from "lucide-react";
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
        if (!confirm(`Uninstall "${pluginId}"? This requires a page reload.`))
            return;
        setRemoving(pluginId);
        try {
            await fetch("/api/marketplace/uninstall", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pluginId }),
            });
            trackEvent("plugin-uninstall", { plugin: pluginId });
            window.location.reload();
        } catch {
            setRemoving(null);
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
                            <button
                                className="plugin-item__uninstall"
                                onClick={() => handleUninstall(record.pluginId)}
                                disabled={removing === record.pluginId}
                                title={`Uninstall ${record.pluginId}`}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <BrowseLink />
        </div>
    );
}
