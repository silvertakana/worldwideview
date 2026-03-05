"use client";

import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { X } from "lucide-react";
import { PluginIcon } from "@/components/common/PluginIcon";

export function IntelPanel() {
    const rightSidebarOpen = useStore((s) => s.rightSidebarOpen);
    const selectedEntity = useStore((s) => s.selectedEntity);
    const setSelectedEntity = useStore((s) => s.setSelectedEntity);

    if (!selectedEntity) return null;

    // Find the plugin for this entity
    const managed = pluginManager.getPlugin(selectedEntity.pluginId);
    const pluginIcon = managed?.plugin.icon;
    const pluginName = managed?.plugin.name || selectedEntity.pluginId;

    // Filter out internal/redundant properties
    const displayProps = Object.entries(selectedEntity.properties).filter(
        ([key]) =>
            !["id", "pluginId"].includes(key) &&
            selectedEntity.properties[key] !== null &&
            selectedEntity.properties[key] !== undefined
    );

    return (
        <aside
            className={`sidebar sidebar--right glass-panel ${rightSidebarOpen ? "" : "sidebar--closed"
                }`}
            style={{ position: "relative" }}
        >
            <button
                className="intel-panel__close"
                onClick={() => setSelectedEntity(null)}
                style={{ padding: "4px" }}
            >
                <X size={16} />
            </button>
            <div className="sidebar__title">Intelligence</div>
            <div className="intel-panel__entity">
                <div className="intel-panel__entity-header">
                    <span className="intel-panel__entity-icon">
                        {pluginIcon && <PluginIcon icon={pluginIcon} size={20} />}
                    </span>
                    <div>
                        <div className="intel-panel__entity-title">
                            {selectedEntity.label || selectedEntity.id}
                        </div>
                        <div className="intel-panel__entity-subtitle">{pluginName}</div>
                    </div>
                </div>
                {/* Coordinates */}
                <div className="intel-panel__props">
                    <div className="intel-panel__prop">
                        <span className="intel-panel__prop-key">Latitude</span>
                        <span className="intel-panel__prop-value">
                            {selectedEntity.latitude.toFixed(4)}°
                        </span>
                    </div>
                    <div className="intel-panel__prop">
                        <span className="intel-panel__prop-key">Longitude</span>
                        <span className="intel-panel__prop-value">
                            {selectedEntity.longitude.toFixed(4)}°
                        </span>
                    </div>
                    {selectedEntity.altitude !== undefined && (
                        <div className="intel-panel__prop">
                            <span className="intel-panel__prop-key">Altitude</span>
                            <span className="intel-panel__prop-value">
                                {selectedEntity.altitude.toFixed(0)} m
                            </span>
                        </div>
                    )}
                    {selectedEntity.speed !== undefined && (
                        <div className="intel-panel__prop">
                            <span className="intel-panel__prop-key">Speed</span>
                            <span className="intel-panel__prop-value">
                                {selectedEntity.speed.toFixed(1)} m/s
                            </span>
                        </div>
                    )}
                    <div className="intel-panel__prop">
                        <span className="intel-panel__prop-key">Timestamp</span>
                        <span className="intel-panel__prop-value">
                            {selectedEntity.timestamp.toLocaleTimeString()}
                        </span>
                    </div>
                    {/* Plugin-specific properties */}
                    {displayProps.map(([key, value]) => (
                        <div key={key} className="intel-panel__prop">
                            <span className="intel-panel__prop-key">
                                {key.replace(/_/g, " ")}
                            </span>
                            <span className="intel-panel__prop-value">
                                {typeof value === "boolean"
                                    ? value
                                        ? "Yes"
                                        : "No"
                                    : String(value)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
