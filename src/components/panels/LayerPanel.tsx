"use client";

import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { ImageryPicker } from "./ImageryPicker";
import { PluginIcon } from "@/components/common/PluginIcon";

export function LayerPanel() {
    const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
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
        } else {
            pluginManager.enablePlugin(pluginId);
            useStore.getState().setLayerEnabled(pluginId, true);
        }
    };

    return (
        <aside
            className={`sidebar sidebar--left glass-panel ${leftSidebarOpen ? "" : "sidebar--closed"
                }`}
        >
            <div className="sidebar__title">Data Layers</div>
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
                                {isEnabled && count > 0 && (
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

            <ImageryPicker />
        </aside>
    );
}
