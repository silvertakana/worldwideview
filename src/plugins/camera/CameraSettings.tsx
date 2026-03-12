"use client";

import React, { ChangeEvent } from "react";
import { useStore } from "@/core/state/store";
import { Upload, Link as LinkIcon, Database, RotateCcw, TrafficCone } from "lucide-react";
import { pluginManager } from "@/core/plugins/PluginManager";
import { inputGroupStyle, labelStyle, inputStyle, loadButtonStyle, sourceTabStyle } from "./cameraSettingsStyles";

export const CameraSettings: React.FC<{ pluginId: string }> = ({ pluginId }) => {
    const settingsRaw = useStore((s) => s.dataConfig.pluginSettings[pluginId]);
    const settings = { sourceType: "default", ...(settingsRaw || {}) };
    const updatePluginSettings = useStore((s) => s.updatePluginSettings);
    const setHighlightLayerId = useStore((s) => s.setHighlightLayerId);
    const [isLoading, setIsLoading] = React.useState(false);

    const handleSourceTypeChange = (type: "default" | "traffic" | "url" | "file") => {
        updatePluginSettings(pluginId, { sourceType: type });
        setHighlightLayerId(null);
    };

    const triggerFetch = async () => {
        const managed = pluginManager.getPlugin(pluginId);
        if (managed && managed.enabled) {
            await pluginManager.fetchForPlugin(pluginId, managed.context.timeRange);
        }
    };

    const handleLoadData = async () => {
        setIsLoading(true);
        updatePluginSettings(pluginId, { action: "load", actionId: Date.now(), loaded: true });
        setHighlightLayerId(null);
        await triggerFetch();
        setIsLoading(false);
    };

    const handleResetAll = async () => {
        updatePluginSettings(pluginId, {
            action: "reset", actionId: Date.now(), loaded: false,
            customUrl: "", customData: null,
        });
        setHighlightLayerId(null);
        await triggerFetch();
    };

    const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                updatePluginSettings(pluginId, { customData: json, action: "load", actionId: Date.now(), loaded: true });
                setHighlightLayerId(null);
                await triggerFetch();
            } catch { alert("Invalid JSON file format."); }
        };
        reader.readAsText(file);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: "var(--space-xs)" }}>
                Data Source Configuration
            </div>

            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                {([["default", Database, "Default"], ["traffic", TrafficCone, "Traffic Cams"], ["url", LinkIcon, "URL"], ["file", Upload, "File"]] as const).map(
                    ([type, Icon, label]) => (
                        <button key={type} onClick={() => handleSourceTypeChange(type as any)} style={sourceTabStyle(settings.sourceType === type)}>
                            <Icon size={14} />
                            <span style={{ fontSize: 10 }}>{label}</span>
                        </button>
                    )
                )}
            </div>

            {settings.sourceType === "default" && (
                <div style={inputGroupStyle}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Built-in camera dataset</div>
                    <button onClick={handleLoadData} disabled={isLoading} style={loadButtonStyle(isLoading)}>
                        {isLoading ? "Loading..." : settings.loaded ? "Reload" : "Load"}
                    </button>
                </div>
            )}

            {settings.sourceType === "traffic" && (
                <div style={inputGroupStyle}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>DOT traffic cameras (GDOT + more)</div>
                    <button onClick={handleLoadData} disabled={isLoading} style={loadButtonStyle(isLoading)}>
                        {isLoading ? "Loading..." : settings.loaded ? "Reload" : "Load"}
                    </button>
                </div>
            )}

            {settings.sourceType === "url" && (
                <div style={inputGroupStyle}>
                    <label style={labelStyle}>URL</label>
                    <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "4px" }}>
                        <input type="text" placeholder="http://..." value={settings.customUrl || ""} onChange={(e) => updatePluginSettings(pluginId, { customUrl: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                        <button onClick={handleLoadData} disabled={!settings.customUrl || isLoading} style={loadButtonStyle(!settings.customUrl || isLoading)}>
                            {isLoading ? "Loading..." : "Load"}
                        </button>
                    </div>
                </div>
            )}

            {settings.sourceType === "file" && (
                <div style={inputGroupStyle}>
                    <label style={labelStyle}>JSON File</label>
                    <input type="file" accept=".json" onChange={handleFileUpload} style={{ ...inputStyle, width: "100%", marginTop: "4px", padding: "4px", fontSize: "10px" }} />
                    {settings.customData && Array.isArray(settings.customData) && (
                        <div style={{ fontSize: 10, color: "var(--accent-green)", marginTop: "4px" }}>✓ Data loaded ({settings.customData.length} cameras)</div>
                    )}
                </div>
            )}


            <button onClick={handleResetAll} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                background: "transparent", border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)", padding: "6px var(--space-md)",
                fontSize: 11, color: "var(--text-muted)", cursor: "pointer", transition: "all 0.2s ease",
            }}>
                <RotateCcw size={12} /> Reset All Sources
            </button>
        </div>
    );
};
