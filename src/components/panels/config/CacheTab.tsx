import { useStore } from "@/core/state/store";
import {
 sectionHeaderStyle, inputGroupStyle, labelStyle, checkboxStyle, inputStyle
} from "./shared";

export function CacheTab() {
    const dataConfig = useStore((s) => s.dataConfig);
    const updateDataConfig = useStore((s) => s.updateDataConfig);

    return (
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <div style={sectionHeaderStyle}>Cache & Limits</div>

        <div style={inputGroupStyle}>
          <label style={labelStyle} htmlFor="enable-cache">Enable Cache</label>
          <input
            id="enable-cache"
            type="checkbox"
            checked={dataConfig.cacheEnabled}
            onChange={(e) => updateDataConfig({ cacheEnabled: e.target.checked })}
            style={checkboxStyle}
          />
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle} htmlFor="cache-max-age">Cache Max Age (ms)</label>
          <input
            id="cache-max-age"
            type="number"
            value={dataConfig.cacheMaxAge}
            onChange={(e) => updateDataConfig({ cacheMaxAge: parseInt(e.target.value) || 0 })}
            style={inputStyle}
          />
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle} htmlFor="max-concurrent-req">Max Concurrent Req</label>
          <input
            id="max-concurrent-req"
            type="number"
            value={dataConfig.maxConcurrentRequests}
            onChange={(e) => updateDataConfig({ maxConcurrentRequests: parseInt(e.target.value) || 0 })}
            style={inputStyle}
          />
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle} htmlFor="retry-attempts">Retry Attempts</label>
          <input
            id="retry-attempts"
            type="number"
            value={dataConfig.retryAttempts}
            onChange={(e) => updateDataConfig({ retryAttempts: parseInt(e.target.value) || 0 })}
            style={inputStyle}
          />
        </div>
      </div>
    );
}
