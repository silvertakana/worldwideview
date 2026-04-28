"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { pluginManager } from "@/core/plugins/PluginManager";
import { Globe } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { isDemo, DEMO_ADMIN_ROLE } from "@/core/edition";

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
    const [isDemoAdmin, setIsDemoAdmin] = useState(false);

    useEffect(() => {
        if (!isDemo) return;
        fetch("/api/auth/session")
            .then((r) => r.json())
            .then((s) => setIsDemoAdmin(s?.user?.role === DEMO_ADMIN_ROLE))
            .catch(() => {});
    }, []);

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
                    <a href="https://worldwideview.dev/" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}>
                        <img src="/logo/logo-icon.svg" alt="Logo" style={{ width: 20, height: 20, objectFit: "contain" }} />
                        <div className="header__logo header__logo--compact">WWV</div>
                    </a>
                    <span className="alpha-badge">ALPHA</span>
                    {isDemoAdmin && <span className="alpha-badge" style={{ background: "var(--accent-orange, #f59e0b)" }}>ADMIN</span>}
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
                <a href="https://worldwideview.dev/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img src="/logo/logo-icon.svg" alt="Logo" style={{ width: 22, height: 22, objectFit: "contain" }} />
                        <div className="header__logo">WORLD WIDE VIEW</div>
                        <span className="alpha-badge">ALPHA</span>
                        {isDemoAdmin && <span className="alpha-badge" style={{ background: "var(--accent-orange, #f59e0b)" }}>ADMIN</span>}
                    </div>
                    <div className="header__subtitle">Geospatial Intelligence</div>
                </a>
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
                            onClick={() => {
                                dataBus.emit("cameraPreset", { presetId: r.id });
                                trackEvent("region-select", { region: r.id });
                            }}
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
                                trackEvent("time-window-change", { window: tw });
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
