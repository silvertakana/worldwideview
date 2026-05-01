"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { useStore } from "@/core/state/store";
import { useIsMobile } from "@/core/hooks/useIsMobile";
import { useResizablePanel } from "@/core/hooks/useResizablePanel";
import { pluginManager } from "@/core/plugins/PluginManager";
import { ImageryPicker } from "./ImageryPicker";
import { LayerItem } from "./LayerItem";
import { FavoritesTab } from "./FavoritesTab";
import { ImportPanel } from "@/plugins/geojson/ImportPanel";
import { PluginsTab } from "./PluginsTab";
import "@/plugins/geojson/geojson-importer.css";
import { DiscordIcon } from "@/components/common/DiscordIcon";
import { trackEvent } from "@/lib/analytics";


export function LayerPanel() {
    const isMobile = useIsMobile();
    const { width, startResizing } = useResizablePanel(320, 260, 800, 'left');
    const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
    const openMobilePanel = useStore((s) => s.openMobilePanel);
    const layers = useStore((s) => s.layers);
    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);
    const highlightLayerId = useStore((s) => s.highlightLayerId);
    const setHighlightLayerId = useStore((s) => s.setHighlightLayerId);
    const setConfigPanelOpen = useStore((s) => s.setConfigPanelOpen);
    const setActiveConfigTab = useStore((s) => s.setActiveConfigTab);
    const setSelectedEntity = useStore((s) => s.setSelectedEntity);

    const allPlugins = pluginManager.getAllPlugins();
    const [searchQuery, setSearchQuery] = useState("");

    // Group by category
    const grouped: Record<string, typeof allPlugins> = {};
    const query = searchQuery.toLowerCase();
    
    allPlugins.forEach((managed) => {
        if (
            !query ||
            managed.plugin.name.toLowerCase().includes(query) ||
            managed.plugin.description?.toLowerCase().includes(query) ||
            managed.plugin.id.toLowerCase().includes(query)
        ) {
            const cat = managed.plugin.category;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(managed);
        }
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
            useStore.getState().setHighlightLayerId(pluginId);
            useStore.getState().setSelectedEntity(null);
            useStore.getState().setConfigPanelOpen(true);

            // Check if plugin requires configuration
            const managed = pluginManager.getPlugin(pluginId);
            const settings = useStore.getState().dataConfig.pluginSettings[pluginId];
            if (managed?.plugin.requiresConfiguration?.(settings)) {
                useStore.getState().setActiveConfigTab("overlay");
            } else {
                useStore.getState().setActiveConfigTab("intel");
            }
        }
        trackEvent("layer-toggle", { layer: pluginId, enabled: !isEnabled });
    };

    const [activeTab, setActiveTab] = useState<"layers" | "imagery" | "favorites" | "import" | "plugins">("layers");

    return (
        <aside
            className={`sidebar sidebar--left glass-panel ${isMobile ? "sidebar--mobile" : ""} ${(isMobile ? openMobilePanel === "left" : leftSidebarOpen) ? "" : "sidebar--closed"}`}
            style={{ width: isMobile ? undefined : width }}
        >
            {/* Drag Handle */}
            {!isMobile && (
                <div
                    onMouseDown={startResizing}
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: -4,
                        width: 8,
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 10,
                        backgroundColor: 'transparent'
                    }}
                />
            )}
            <div className="sidebar__title">Data Sources</div>

            <div
                className="panel-tabs"
                onWheel={(e) => {
                    e.currentTarget.scrollLeft += e.deltaY;
                }}
            >
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
                <button
                    className={`panel-tab ${activeTab === "plugins" ? "panel-tab--active" : ""}`}
                    onClick={() => { setActiveTab("plugins"); trackEvent("panel-tab-switch", { tab: "plugins" }); }}
                >
                    Plugins
                </button>
            </div>

            {activeTab === "layers" && (
                <div className="layers-tab-content">
                    <div style={{ padding: "0 var(--space-md) var(--space-md) var(--space-md)" }}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            background: "var(--bg-layer-2)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-sm)",
                            padding: "0 var(--space-sm)",
                        }}>
                            <Search size={14} style={{ color: "var(--text-muted)", marginRight: 8 }} />
                            <input
                                type="text"
                                placeholder="Search layers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    flex: 1,
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--text-primary)",
                                    fontSize: "13px",
                                    padding: "var(--space-sm) 0",
                                    outline: "none"
                                }}
                            />
                        </div>
                    </div>
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
                                        <LayerItem
                                            key={managed.plugin.id}
                                            plugin={managed.plugin}
                                            isEnabled={isEnabled}
                                            isLoading={isLoading}
                                            entityCount={count}
                                            isSelected={highlightLayerId === managed.plugin.id}
                                            onToggle={() => handleToggle(managed.plugin.id)}
                                            onSelect={() => {
                                                const newId = highlightLayerId === managed.plugin.id ? null : managed.plugin.id;
                                                setHighlightLayerId(newId);
                                                if (newId) {
                                                    setSelectedEntity(null);
                                                    setConfigPanelOpen(true);
                                                    setActiveConfigTab("intel");
                                                }
                                            }}
                                        />
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

            {activeTab === "plugins" && (
                <PluginsTab />
            )}

        </aside>
    );
}
