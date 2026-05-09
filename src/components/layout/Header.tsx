"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { pluginManager } from "@/core/plugins/PluginManager";
import { Globe,Key } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { isDemo, DEMO_ADMIN_ROLE } from "@/core/edition";

import { SearchBar } from "./SearchBar";
import { useIsMobile } from "@/core/hooks/useIsMobile";
import { ApiKeysTab } from "./ApiKeysTab";

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
    const [showApiKeys, setShowApiKeys] = useState(false);

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
        <>
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
                    <button
                        className="btn btn--glow"
                        onClick={() => setShowApiKeys(true)}
                        title="API Keys"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                        }}
                    >
                        <Key size={14} />
                    </button>
                    <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />
                    <select
                        id="time"
                        className="btn"
                        value={timeWindow}
                        onChange={(e) => {
                            const tw = e.target.value as typeof TIME_WINDOWS[number];
                        
                            setTimeWindow(tw);
                        
                            const range = useStore.getState().timeRange;
                            pluginManager.updateTimeRange(range);
                        
                            trackEvent("time-window-change", { window: tw });
                        }}
                        style={{ flexShrink: 0 }}
                    >
                        {TIME_WINDOWS.map((tw) => (
                            <option key={tw} value={tw}>
                                {tw}
                            </option>
                        ))}
                    </select>
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
        {showApiKeys && (
                        <div
                            style={{
                                position: "fixed",
                                inset: 0,
                                background: "rgba(0,0,0,0.45)",
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "center",
                                paddingTop: "5vh",
                                paddingBottom: "5vh",
                                overflowY: "auto",
                                zIndex: 9999,
                            }}
                            onClick={() => setShowApiKeys(false)}
                        >
                            <div
                                className="glass-panel"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: "min(700px, 90vw)",
                                    maxHeight: "80vh",
                                    overflowY: "auto",
                                    padding: "24px",
                                    borderRadius: "16px",
                                    margin: "20px",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "16px",
                                    }}
                                >
                                    <h2 style={{ margin: 0 }}>API Keys</h2>
                                
                                    <button
                                        className="btn"
                                        onClick={() => setShowApiKeys(false)}
                                    >
                                        Close
                                    </button>
                                </div>
                                
                                <ApiKeysTab />
                            </div>
                        </div>
                    )}
        </>
    );
    
}
