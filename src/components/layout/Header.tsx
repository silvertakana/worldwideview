"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { pluginManager } from "@/core/plugins/PluginManager";
import { Globe, Menu, Settings, Filter } from "lucide-react";
import { SearchBar } from "./SearchBar";

const REGIONS = [
    { id: "global", label: "Global", icon: Globe },
    { id: "americas", label: "Americas", icon: Globe },
    { id: "europe", label: "Europe", icon: Globe },
    { id: "mena", label: "MENA", icon: Globe },
    { id: "asiaPacific", label: "Asia", icon: Globe },
    { id: "africa", label: "Africa", icon: Globe },
    { id: "oceania", label: "Oceania", icon: Globe },
    { id: "arctic", label: "Arctic", icon: Globe },
];

const TIME_WINDOWS = ["1h", "6h", "24h", "48h", "7d"] as const;

export function Header() {
    const timeWindow = useStore((s) => s.timeWindow);
    const setTimeWindow = useStore((s) => s.setTimeWindow);
    const toggleLeftSidebar = useStore((s) => s.toggleLeftSidebar);
    const toggleConfigPanel = useStore((s) => s.toggleConfigPanel);
    const toggleFilterPanel = useStore((s) => s.toggleFilterPanel);
    const filterCount = useStore((s) =>
        Object.values(s.filters).reduce((sum, pf) => sum + Object.keys(pf).length, 0)
    );

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            // Check if there is a vertical scroll (e.deltaY)
            if (e.deltaY !== 0) {
                // If so, translate it to horizontal scroll
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };

        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, []);

    return (
        <header className="header glass-panel">
            <div className="header__brand">
                <div>
                    <div className="header__logo">WorldWideView</div>
                    <div className="header__subtitle">Geospatial Intelligence</div>
                </div>
                {/* Search Bar moved here to prevent dropdown clipping */}
                <div style={{ marginLeft: "var(--space-xl)" }}>
                    <SearchBar />
                </div>
            </div>
            <div className="header__controls">
                {/* Scrollable section: region presets + time windows */}
                <div className="header__controls-scroll" ref={scrollContainerRef}>
                    {/* Region presets */}
                    {REGIONS.map((r) => (
                        <button
                            key={r.id}
                            className="btn btn--glow"
                            onClick={() => dataBus.emit("cameraPreset", { presetId: r.id })}
                            title={r.label}
                            style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}
                        >
                            <r.icon size={14} />
                            {r.label}
                        </button>
                    ))}
                    {/* Separator */}
                    <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />
                    {/* Time windows */}
                    {TIME_WINDOWS.map((tw) => (
                        <button
                            key={tw}
                            className={`btn ${timeWindow === tw ? "btn--active" : ""}`}
                            style={{ flexShrink: 0 }}
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
                {/* Always-visible right-side actions */}
                <div className="header__actions">
                    {/* Separator */}
                    <div style={{ width: 1, height: 20, background: "var(--border-subtle)" }} />
                    {/* Live indicator */}
                    <div className="status-badge">
                        <span className="status-badge__dot" />
                        LIVE
                    </div>
                </div>
            </div>
        </header>
    );
}
