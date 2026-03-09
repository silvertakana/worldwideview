"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { pluginManager } from "@/core/plugins/PluginManager";
import { Globe } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { useIsMobile } from "@/core/hooks/useIsMobile";

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
    const isMobile = useIsMobile();
    const timeWindow = useStore((s) => s.timeWindow);
    const setTimeWindow = useStore((s) => s.setTimeWindow);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };

        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, []);

    // Mobile: compact header with persistent centered search
    if (isMobile) {
        return (
            <header className="header header--mobile glass-panel">
                <div className="header__brand">
                    <div className="header__logo header__logo--compact">WWV</div>
                </div>

                <div className="header__search-center">
                    <SearchBar />
                </div>

                <div className="header__actions">
                    <div className="status-badge">
                        <span className="status-badge__dot" />
                        LIVE
                    </div>
                </div>
            </header>
        );
    }

    // Desktop: full header
    return (
        <header className="header glass-panel">
            <div className="header__brand">
                <div>
                    <div className="header__logo">WorldWideView</div>
                    <div className="header__subtitle">Geospatial Intelligence</div>
                </div>
                <div style={{ marginLeft: "var(--space-xl)" }}>
                    <SearchBar />
                </div>
            </div>
            <div className="header__controls">
                <div className="header__controls-scroll" ref={scrollContainerRef}>
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
                    <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />
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
                <div className="header__actions">
                    <div style={{ width: 1, height: 20, background: "var(--border-subtle)" }} />
                    <div className="status-badge">
                        <span className="status-badge__dot" />
                        LIVE
                    </div>
                </div>
            </div>
        </header>
    );
}
