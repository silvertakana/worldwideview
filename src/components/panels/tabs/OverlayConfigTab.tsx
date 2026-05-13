/**
 * @file OverlayConfigTab.tsx
 * @description Configuration panel for managing layer-specific settings, 
 * experimental features, and global polling intervals.
 * @module src/components/panels/tabs
 */

import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";

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

/**
 * @component OverlayConfigTab
 * @description Provides a granular interface for adjusting technical parameters 
 * of active plugins, including polling frequencies and experimental data loading features.
 */
export function OverlayConfigTab() {
    const dataConfig = useStore((s) => s.dataConfig);
    const updateDataConfig = useStore((s) => s.updateDataConfig);
    const setPollingInterval = useStore((s) => s.setPollingInterval);
    const layers = useStore((s) => s.layers);
    const highlightLayerId = useStore((s) => s.highlightLayerId);
    const setHighlightLayerId = useStore((s) => s.setHighlightLayerId);

    const enabledPlugins = Object.entries(dataConfig.pollingIntervals).filter(
        ([pluginId]) => layers[pluginId]?.enabled
    );

    return (
        <>
            {/* Active Layer Configurations */}
            <div style={{ marginBottom: "var(--space-lg)" }}>
                <div style={sectionHeaderStyle}>Active Layer Configs</div>
                {enabledPlugins.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "var(--space-sm) 0" }}>
                        No layers enabled. Turn on a layer to configure it.
                    </div>
                ) : (
                    enabledPlugins.map(([pluginId, interval]) => {
                        const managed = pluginManager.getPlugin(pluginId);
                        const SettingsComp = managed?.plugin.getSettingsComponent?.();
                        const isHighlighted = highlightLayerId === pluginId;

                        return (
                            <div
                                key={pluginId}
                                onClick={() => isHighlighted && setHighlightLayerId(null)}
                                style={{
                                    marginBottom: "var(--space-md)",
                                    background: "var(--bg-tertiary)",
                                    padding: "var(--space-md)",
                                    borderRadius: "var(--radius-md)",
                                    border: isHighlighted ? "2px solid #ef4444" : "1px solid var(--border-subtle)",
                                    boxShadow: isHighlighted ? "0 0 10px rgba(239, 68, 68, 0.4)" : "none",
                                    transition: "all 0.2s ease"
                                }}
                            >
                                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: "var(--space-sm)", textTransform: "capitalize" }}>
                                    {managed?.plugin.name || pluginId} Layer
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
                                {SettingsComp && (
                                    <div style={{
                                        marginTop: "var(--space-md)",
                                        paddingTop: "var(--space-md)",
                                        borderTop: "1px solid var(--border-subtle)"
                                    }}>
                                        <SettingsComp pluginId={pluginId} />
                                    </div>
                                )}
                            </div>
                        );
                    })
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
    );
}
