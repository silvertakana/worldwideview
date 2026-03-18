"use client";

import { useState } from "react";

import { useStore } from "@/core/state/store";
import { useIsMobile } from "@/core/hooks/useIsMobile";
import { pluginManager } from "@/core/plugins/PluginManager";
import { ImageryPicker } from "./ImageryPicker";
import { PluginIcon } from "@/components/common/PluginIcon";
import { FavoritesTab } from "./FavoritesTab";
import { ImportPanel } from "@/plugins/geojson/ImportPanel";
import "@/plugins/geojson/geojson-importer.css";
import { DiscordIcon } from "@/components/common/DiscordIcon";
import { trackEvent } from "@/lib/analytics";


export function LayerPanel() {
    const isMobile = useIsMobile();
    const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
    const openMobilePanel = useStore((s) => s.openMobilePanel);
    const layers = useStore((s) => s.layers);
    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);

    const allPlugins = pluginManager.getAllPlugins();

    // Group by category
    const grouped: Record<string, typeof allPlugins> = {};
    allPlugins.forEach((managed) => {
        const cat = managed.plugin.category;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(managed);
    });

    const categoryLabels: Record<string, string> = {
        aviation: "Aviation",
        maritime: "Maritime",
        "natural-disaster": "Natural Disasters",
        conflict: "Conflict",
        infrastructure: "Infrastructure",
        cyber: "Cyber",
        economic: "Economic",
        custom: "Custom",
    };

    const handleToggle = (pluginId: string) => {
        const isEnabled = layers[pluginId]?.enabled;
        if (isEnabled) {
            pluginManager.disablePlugin(pluginId);
            useStore.getState().setLayerEnabled(pluginId, false);
            useStore.getState().clearEntities(pluginId);
            useStore.getState().setEntityCount(pluginId, 0);
            // Clear hovered/selected if they belong to this layer
            const state = useStore.getState();
            if (state.hoveredEntity?.pluginId === pluginId) {
                state.setHoveredEntity(null, null);
            }
            if (state.selectedEntity?.pluginId === pluginId) {
                state.setSelectedEntity(null);
            }
        } else {
            pluginManager.enablePlugin(pluginId);
            useStore.getState().setLayerEnabled(pluginId, true);

            // Check if plugin requires configuration
            const managed = pluginManager.getPlugin(pluginId);
            const settings = useStore.getState().dataConfig.pluginSettings[pluginId];
            if (managed?.plugin.requiresConfiguration?.(settings)) {
                useStore.getState().setConfigPanelOpen(true);
                useStore.getState().setActiveConfigTab("overlay");
                useStore.getState().setHighlightLayerId(pluginId);
            }
        }
        trackEvent("layer-toggle", { layer: pluginId, enabled: !isEnabled });
    };

    const [activeTab, setActiveTab] = useState<"layers" | "imagery" | "favorites" | "import">("layers");

    return (
        <aside
            className={`sidebar sidebar--left glass-panel ${isMobile ? "sidebar--mobile" : ""} ${(isMobile ? openMobilePanel === "left" : leftSidebarOpen) ? "" : "sidebar--closed"}`}
        >
            <div className="sidebar__title">Data Sources</div>

            <div className="panel-tabs">
                <button
                    className={`panel-tab ${activeTab === "layers" ? "panel-tab--active" : ""}`}
                    onClick={() => { setActiveTab("layers"); trackEvent("panel-tab-switch", { tab: "layers" }); }}
                >
                    Data Layers
                </button>
                <button
                    className={`panel-tab ${activeTab === "imagery" ? "panel-tab--active" : ""}`}
                    onClick={() => { setActiveTab("imagery"); trackEvent("panel-tab-switch", { tab: "imagery" }); }}
                >
                    Imagery
                </button>
                <button
                    className={`panel-tab ${activeTab === "favorites" ? "panel-tab--active" : ""}`}
                    onClick={() => { setActiveTab("favorites"); trackEvent("panel-tab-switch", { tab: "favorites" }); }}
                >
                    Favorites
                </button>
                <button
                    className={`panel-tab ${activeTab === "import" ? "panel-tab--active" : ""}`}
                    onClick={() => { setActiveTab("import"); trackEvent("panel-tab-switch", { tab: "import" }); }}
                >
                    Import
                </button>
            </div>

            {activeTab === "layers" && (
                <div className="layers-tab-content">
                    <div className="layers-tab-content__list">
                        {Object.entries(grouped).map(([category, plugins]) => (
                            <div key={category} style={{ marginBottom: "var(--space-lg)" }}>
                                <div
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                        color: "var(--text-muted)",
                                        marginBottom: "var(--space-sm)",
                                        paddingLeft: "var(--space-md)",
                                    }}
                                >
                                    {categoryLabels[category] || category}
                                </div>
                                {plugins.map((managed) => {
                                    const isEnabled = layers[managed.plugin.id]?.enabled || false;
                                    const isLoading = layers[managed.plugin.id]?.loading || false;
                                    const count = (entitiesByPlugin[managed.plugin.id] || []).length;

                                    return (
                                        <div
                                            key={managed.plugin.id}
                                            className="layer-item"
                                            onClick={() => handleToggle(managed.plugin.id)}
                                        >
                                            <span className="layer-item__icon">
                                                {typeof managed.plugin.icon === "string" ? (
                                                    managed.plugin.icon
                                                ) : (
                                                    <managed.plugin.icon size={18} />
                                                )}
                                            </span>
                                            <div className="layer-item__info">
                                                <div className="layer-item__name">{managed.plugin.name}</div>
                                                <div className="layer-item__desc">
                                                    {managed.plugin.description}
                                                </div>
                                            </div>
                                            {isEnabled && isLoading && (
                                                <span className="layer-item__spinner" aria-label="Loading" />
                                            )}
                                            {isEnabled && !isLoading && count > 0 && (
                                                <span className="layer-item__count">
                                                    {count.toLocaleString()}
                                                </span>
                                            )}
                                            <div
                                                className={`layer-item__toggle ${isEnabled ? "layer-item__toggle--on" : ""
                                                    }`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    <a
                        href="https://discord.gg/k3F2N4eKnr"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="discord-sidebar-link"
                        onClick={() => trackEvent("discord-link-click")}
                    >
                        <DiscordIcon size={18} />
                        <span>Join our Discord</span>
                    </a>
                </div>
            )}

            {activeTab === "imagery" && (
                <ImageryPicker />
            )}

            {activeTab === "favorites" && (
                <FavoritesTab />
            )}

            {activeTab === "import" && (
                <ImportPanel />
            )}

        </aside>
    );
}
