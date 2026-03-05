import { useState, useEffect } from "react";

import { useStore } from "@/core/state/store";
import { FilterSection } from "./FilterPanel";
import { pluginManager } from "@/core/plugins/PluginManager";
import { PluginIcon } from "@/components/common/PluginIcon";
import { Info, Eye, MapPin, Lock, Unlock } from "lucide-react";
import { dataBus } from "@/core/data/DataBus";

export function DataConfigPanel() {
    const configPanelOpen = useStore((s) => s.configPanelOpen);
    const dataConfig = useStore((s) => s.dataConfig);
    const updateDataConfig = useStore((s) => s.updateDataConfig);
    const setPollingInterval = useStore((s) => s.setPollingInterval);
    const layers = useStore((s) => s.layers);
    const mapConfig = useStore((s) => s.mapConfig);
    const updateMapConfig = useStore((s) => s.updateMapConfig);

    const selectedEntity = useStore((s) => s.selectedEntity);
    const lockedEntityId = useStore((s) => s.lockedEntityId);
    const setLockedEntityId = useStore((s) => s.setLockedEntityId);

    const enabledPlugins = Object.entries(dataConfig.pollingIntervals).filter(
        ([pluginId]) => layers[pluginId]?.enabled
    );

    const [activeTab, setActiveTab] = useState<"intel" | "filters" | "cache" | "overlay">("filters");

    // Auto-switch to Intel tab when an entity is selected
    useEffect(() => {
        if (selectedEntity) {
            setActiveTab("intel");
        }
    }, [selectedEntity]);

    return (
        <aside
            className={`sidebar sidebar--right glass-panel ${configPanelOpen ? "" : "sidebar--closed"
                }`}
            style={{ width: 320, padding: "var(--space-xl)", zIndex: 101, borderLeft: "var(--glass-border)" }}
        >
            <div className="sidebar__title" style={{ marginBottom: "var(--space-md)", color: "var(--text-primary)", fontSize: "14px", fontWeight: 600 }}>Data Configuration</div>

            <div className="panel-tabs">
                <button
                    className={`panel-tab ${activeTab === "intel" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("intel")}
                >
                    <Info size={12} style={{ marginRight: 4 }} />
                    Intel
                </button>
                <button
                    className={`panel-tab ${activeTab === "filters" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("filters")}
                >
                    Filters
                </button>
                <button
                    className={`panel-tab ${activeTab === "cache" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("cache")}
                >
                    Cache & Limits
                </button>
                <button
                    className={`panel-tab ${activeTab === "overlay" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("overlay")}
                >
                    Config & Overlay
                </button>
            </div>

            {activeTab === "intel" && (
                <div style={{ marginBottom: "var(--space-lg)" }}>
                    <div style={sectionHeaderStyle}>Intelligence</div>
                    {!selectedEntity ? (
                        <div style={{ padding: "var(--space-md)", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", textAlign: "center" }}>
                            Select an entity on the map to view its intelligence report.
                        </div>
                    ) : (() => {
                        const managed = pluginManager.getPlugin(selectedEntity.pluginId);
                        const pluginIcon = managed?.plugin.icon;
                        const pluginName = managed?.plugin.name || selectedEntity.pluginId;

                        const displayProps = Object.entries(selectedEntity.properties).filter(
                            ([key]) =>
                                !["id", "pluginId"].includes(key) &&
                                selectedEntity.properties[key] !== null &&
                                selectedEntity.properties[key] !== undefined
                        );

                        return (
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
                                    {displayProps.map(([key, value]) => (
                                        <div key={key} className="intel-panel__prop">
                                            <span className="intel-panel__prop-key">
                                                {key.replace(/_/g, " ")}
                                            </span>
                                            <span className="intel-panel__prop-value">
                                                {typeof value === "boolean"
                                                    ? value ? "Yes" : "No"
                                                    : String(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {/* Action Buttons */}
                                <div className="intel-panel__actions">
                                    <button
                                        className="intel-panel__action-btn"
                                        title="Face towards"
                                        onClick={() => {
                                            console.log("[Intel] Face button clicked", selectedEntity.latitude, selectedEntity.longitude);
                                            dataBus.emit("cameraFaceTowards", {
                                                lat: selectedEntity.latitude,
                                                lon: selectedEntity.longitude,
                                                alt: selectedEntity.altitude || 0,
                                            });
                                        }}
                                    >
                                        <Eye size={14} />
                                        <span>Face</span>
                                    </button>
                                    <button
                                        className="intel-panel__action-btn"
                                        title="Go to entity"
                                        onClick={() => {
                                            console.log("[Intel] Go To button clicked", selectedEntity.latitude, selectedEntity.longitude);
                                            dataBus.emit("cameraGoTo", {
                                                lat: selectedEntity.latitude,
                                                lon: selectedEntity.longitude,
                                                alt: selectedEntity.altitude || 0,
                                            });
                                        }}
                                    >
                                        <MapPin size={14} />
                                        <span>Go To</span>
                                    </button>
                                    <button
                                        className={`intel-panel__action-btn ${lockedEntityId === selectedEntity.id ? "intel-panel__action-btn--active" : ""}`}
                                        title={lockedEntityId === selectedEntity.id ? "Unlock camera" : "Lock camera to entity"}
                                        onClick={() => setLockedEntityId(
                                            lockedEntityId === selectedEntity.id ? null : selectedEntity.id
                                        )}
                                    >
                                        {lockedEntityId === selectedEntity.id
                                            ? <><Unlock size={14} /><span>Unlock</span></>
                                            : <><Lock size={14} /><span>Lock</span></>
                                        }
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {activeTab === "filters" && (
                <div style={{ marginBottom: "var(--space-lg)" }}>
                    <div style={sectionHeaderStyle}>Entity Filters</div>
                    <FilterSection />
                </div>
            )}

            {activeTab === "cache" && (
                <div style={{ marginBottom: "var(--space-lg)" }}>
                    <div style={sectionHeaderStyle}>Cache & Limits</div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Enable Cache</label>
                        <input
                            type="checkbox"
                            checked={dataConfig.cacheEnabled}
                            onChange={(e) => updateDataConfig({ cacheEnabled: e.target.checked })}
                            style={checkboxStyle}
                        />
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Cache Max Age (ms)</label>
                        <input
                            type="number"
                            value={dataConfig.cacheMaxAge}
                            onChange={(e) => updateDataConfig({ cacheMaxAge: parseInt(e.target.value) || 0 })}
                            style={inputStyle}
                        />
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Max Concurrent Req</label>
                        <input
                            type="number"
                            value={dataConfig.maxConcurrentRequests}
                            onChange={(e) => updateDataConfig({ maxConcurrentRequests: parseInt(e.target.value) || 0 })}
                            style={inputStyle}
                        />
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Retry Attempts</label>
                        <input
                            type="number"
                            value={dataConfig.retryAttempts}
                            onChange={(e) => updateDataConfig({ retryAttempts: parseInt(e.target.value) || 0 })}
                            style={inputStyle}
                        />
                    </div>
                </div>
            )}

            {activeTab === "overlay" && (
                <>
                    {/* Active Layer Configurations */}
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                        <div style={sectionHeaderStyle}>Active Layer Configs</div>
                        {enabledPlugins.length === 0 ? (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "var(--space-sm) 0" }}>
                                No layers enabled. Turn on a layer to configure it.
                            </div>
                        ) : (
                            enabledPlugins.map(([pluginId, interval]) => (
                                <div key={pluginId} style={{
                                    marginBottom: "var(--space-md)",
                                    background: "var(--bg-tertiary)",
                                    padding: "var(--space-md)",
                                    borderRadius: "var(--radius-md)",
                                    border: "1px solid var(--border-subtle)"
                                }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: "var(--space-sm)", textTransform: "capitalize" }}>
                                        {pluginId} Layer
                                    </div>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Polling Interval (ms)</label>
                                        <input
                                            type="number"
                                            value={interval}
                                            onChange={(e) => setPollingInterval(pluginId, parseInt(e.target.value) || 0)}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Experimental Features */}
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                        <div style={sectionHeaderStyle}>Experimental Features</div>

                        {Object.entries(dataConfig.experimentalFeatures).map(([feature, enabled]) => {
                            const labels: Record<string, string> = {
                                predictiveLoading: "Predictive Loading",
                                realtimeStreaming: "Realtime Streaming",
                                clusteringEnabled: "Clustering",
                                showTimelineHighlight: "Timeline Data Highlights",
                            };
                            return (
                                <div key={feature} style={inputGroupStyle}>
                                    <label style={labelStyle}>{labels[feature] || feature}</label>
                                    <input
                                        type="checkbox"
                                        checked={enabled}
                                        onChange={(e) => updateDataConfig({
                                            experimentalFeatures: { ...dataConfig.experimentalFeatures, [feature]: e.target.checked }
                                        })}
                                        style={checkboxStyle}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* Map Overlays */}
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                        <div style={sectionHeaderStyle}>Map Overlays</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            Map overlays such as Borders & Labels can now be found in the Layers Panel.
                        </div>
                    </div>
                </>
            )}
        </aside>
    );
}

// Inline styles for simplicity matching the current design tokens where possible
const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: "var(--space-sm)",
    borderBottom: "1px solid var(--border-subtle)",
    paddingBottom: "var(--space-xs)"
};

const inputGroupStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "var(--space-sm)",
};

const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--text-secondary)",
    textTransform: "capitalize",
};

const inputStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-primary)",
    padding: "var(--space-xs) var(--space-sm)",
    borderRadius: "var(--radius-sm)",
    fontSize: 12,
    width: "80px",
    outline: "none",
};

const checkboxStyle: React.CSSProperties = {
    cursor: "pointer",
    accentColor: "var(--accent-cyan)",
};
