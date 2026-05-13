/**
 * @file CacheLimitsTab.tsx
 * @module Panels/Tabs
 * @description Configuration interface for managing frontend data caching and request throttling.
 * @version 1.0.0
 */

import { useStore } from "@/core/state/store";

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
 * @component CacheLimitsTab
 * @description Provides a management interface for the data engine's caching strategy,
 * including TTL settings and concurrent request limits to prevent network congestion.
 */
export function CacheLimitsTab() {
    const dataConfig = useStore((s) => s.dataConfig);
    const updateDataConfig = useStore((s) => s.updateDataConfig);

    return (
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
    );
}
