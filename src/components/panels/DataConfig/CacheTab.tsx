/**
 * @file CacheTab.tsx
 * @module Panels/DataConfig
 * @description Specialized view for managing data engine caching parameters.
 * @version 1.0.0
 */

import { useStore } from "@/core/state/store";
import { sectionHeaderStyle, inputGroupStyle, labelStyle, inputStyle, checkboxStyle } from "./sharedStyles";

/**
 * @component CacheTab
 * @description Provides a management interface for the data engine's caching strategy.
 */
export function CacheTab() {
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
