"use client";

import React from "react";
import { useStore } from "@/core/state/store";
import { Clock } from "lucide-react";
import { pluginManager } from "@/core/plugins/PluginManager";

export const MaritimeSettings: React.FC<{ pluginId: string }> = ({ pluginId }) => {
    const settingsRaw = useStore((s) => s.dataConfig.pluginSettings[pluginId]);
    // Default to 1 hour trail if not set
    const settings = { trailDuration: "1h", ...(settingsRaw || {}) };
    const updatePluginSettings = useStore((s) => s.updatePluginSettings);

    const handleDurationChange = async (duration: string) => {
        updatePluginSettings(pluginId, { trailDuration: duration });
        
        // Trigger immediate fetch to get new data
        const managed = pluginManager.getPlugin(pluginId);
        if (managed && managed.enabled) {
            await pluginManager.fetchForPlugin(pluginId, managed.context.timeRange);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: "var(--space-xs)", display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={12} /> Trail History Duration
            </div>
            
            <select 
                value={settings.trailDuration as string}
                onChange={(e) => handleDurationChange(e.target.value)}
                style={{
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    padding: "6px var(--space-sm)",
                    fontSize: 12,
                    outline: "none",
                    cursor: "pointer"
                }}
            >
                <option value="0h">Off (0 hours)</option>
                <option value="1h">1 Hour</option>
                <option value="6h">6 Hours</option>
                <option value="12h">12 Hours</option>
                <option value="24h">24 Hours</option>
            </select>
            
            <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                Longer trails require more memory and take longer to load. Setting affects visible trails behind vessels.
            </div>
        </div>
    );
};
