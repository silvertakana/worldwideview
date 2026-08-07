/**
 * @file CacheTab.tsx
 * @module Panels/DataConfig
 * @description Specialized view for managing data engine caching parameters.
 * @version 1.0.0
 */

import { useStore } from "@/core/state/store";
import {
 sectionHeaderStyle, inputGroupStyle, labelStyle, inputStyle, checkboxStyle
} from "./sharedStyles";

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
          <label style={labelStyle} htmlFor="dc-enable-cache">Enable Cache</label>
          <input
            id="dc-enable-cache"
            type="checkbox"
            checked={dataConfig.cacheEnabled}
            onChange={(e) => updateDataConfig({ cacheEnabled: e.target.checked })}
            style={checkboxStyle}
          />
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle} htmlFor="dc-cache-max-age">Cache Max Age (ms)</label>
          <input
            id="dc-cache-max-age"
            type="number"
            value={dataConfig.cacheMaxAge}
            onChange={(e) => updateDataConfig({ cacheMaxAge: parseInt(e.target.value) || 0 })}
            style={inputStyle}
          />
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle} htmlFor="dc-max-concurrent-req">Max Concurrent Req</label>
          <input
            id="dc-max-concurrent-req"
            type="number"
            value={dataConfig.maxConcurrentRequests}
            onChange={(e) => updateDataConfig({ maxConcurrentRequests: parseInt(e.target.value) || 0 })}
            style={inputStyle}
          />
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle} htmlFor="dc-retry-attempts">Retry Attempts</label>
          <input
            id="dc-retry-attempts"
            type="number"
            value={dataConfig.retryAttempts}
            onChange={(e) => updateDataConfig({ retryAttempts: parseInt(e.target.value) || 0 })}
            style={inputStyle}
          />
        </div>
      </div>
    );
}
