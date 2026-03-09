"use client";

import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { dataBus } from "@/core/data/DataBus";
import { Globe } from "lucide-react";

const REGIONS = [
    { id: "global", label: "Global" },
    { id: "americas", label: "Americas" },
    { id: "europe", label: "Europe" },
    { id: "mena", label: "MENA" },
    { id: "asiaPacific", label: "Asia" },
    { id: "africa", label: "Africa" },
    { id: "oceania", label: "Oceania" },
    { id: "arctic", label: "Arctic" },
];

const TIME_WINDOWS = ["1h", "6h", "24h", "48h", "7d"] as const;

/**
 * Horizontally scrollable bar for region presets + time windows.
 * Shown only on mobile, attached directly below the condensed header.
 */
export function MobileHudBar() {
    const timeWindow = useStore((s) => s.timeWindow);
    const setTimeWindow = useStore((s) => s.setTimeWindow);

    return (
        <div className="mobile-hud-bar glass-panel">
            <div className="mobile-hud-bar__scroll">
                {REGIONS.map((r) => (
                    <button
                        key={r.id}
                        className="btn btn--glow"
                        onClick={() => dataBus.emit("cameraPreset", { presetId: r.id })}
                        title={r.label}
                    >
                        <Globe size={14} />
                        {r.label}
                    </button>
                ))}

                <div className="mobile-hud-bar__divider" />

                {TIME_WINDOWS.map((tw) => (
                    <button
                        key={tw}
                        className={`btn ${timeWindow === tw ? "btn--active" : ""}`}
                        onClick={() => {
                            setTimeWindow(tw);
                            const range = useStore.getState().timeRange;
                            pluginManager.updateTimeRange(range);
                        }}
                    >
                        {tw}
                    </button>
                ))}
            </div>
        </div>
    );
}
