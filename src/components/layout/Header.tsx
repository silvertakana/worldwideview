"use client";

/**
 * @file Header.tsx
 * @description Primary application header providing branding, search, region presets,
 * theme selection, and system-wide controls.
 * @module src/components/layout
 */

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { pluginManager } from "@/core/plugins/PluginManager";
import {
 Globe, Key, Sun, Moon, Monitor
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { isDemo, DEMO_ADMIN_ROLE } from "@/core/edition";

import Image from "next/image";
import { useIsMobile } from "@/core/hooks/useIsMobile";
import { SearchBar } from "./SearchBar";
import { ApiKeysTab } from "./ApiKeysTab";
import { PersonalApiKeysSection } from "./PersonalApiKeysSection";
import "./timeSelect.css";

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

const THEMES = [
    { id: "dark", label: "Dark", icon: Moon },
    { id: "black", label: "Black", icon: Moon },
    { id: "light", label: "Light", icon: Sun },
    { id: "legacy", label: "Legacy", icon: Monitor },
] as const;

const TIME_WINDOWS = ["1h", "6h", "24h", "48h", "7d"] as const;

/**
 * @component Header
 * @description The main navigation and control bar of the application.
 * Handles responsive layout between mobile and desktop, including time windows,
 * theme selection, and region-based camera presets.
 *
 * @example
 * ```tsx
 * <Header />
 * ```
 */
export function Header() {
    const isMobile = useIsMobile();
    const timeWindow = useStore((s) => s.timeWindow);
    const setTimeWindow = useStore((s) => s.setTimeWindow);
    const theme = useStore((s) => s.theme);
    const setTheme = useStore((s) => s.setTheme);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDemoAdmin, setIsDemoAdmin] = useState(false);
    const [showApiKeys, setShowApiKeys] = useState(false);

    const [timeOpen, setTimeOpen] = useState(false);
    const timeRef = useRef<HTMLDivElement>(null);
    const timeButtonRef = useRef<HTMLButtonElement>(null);
    const [timePos, setTimePos] = useState({ top: 0, right: 0 });

    const [themeOpen, setThemeOpen] = useState(false);
    const themeButtonRef = useRef<HTMLButtonElement>(null);
    const [themePos, setThemePos] = useState({ top: 0, right: 0 });

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
          <>
            <header className="header header--mobile glass-panel">
              <div className="header__brand">
                <a
                  href="https://worldwideview.dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
 display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit"
}}
                >
                  <Image src="/logo/logo-icon.svg" alt="Logo" width={20} height={20} style={{ objectFit: "contain" }} />
                  <div className="header__logo header__logo--compact">WWV</div>
                </a>
                <span className="alpha-badge">ALPHA</span>
                {isDemoAdmin && <span className="alpha-badge" style={{ background: "var(--accent-orange, #f59e0b)" }}>ADMIN</span>}
              </div>

              <div className="header__search-center">
                <SearchBar />
              </div>

              <div className="header__actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <button
                    ref={themeButtonRef}
                    className="btn btn--glow"
                    type="button"
                    onClick={() => {
                                if (!themeOpen && themeButtonRef.current) {
                                    const rect = themeButtonRef.current.getBoundingClientRect();
                                    setThemePos({
                                        top: rect.bottom + 8,
                                        right: window.innerWidth - (rect.right + 2),
                                    });
                                }
                                setThemeOpen((v) => !v);
                            }}
                    title="Theme Selection"
                    style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "6px",
                                background: "transparent",
                                border: "none",
                                color: "var(--text-secondary)",
                                gap: "4px"
                            }}
                  >
                    {theme === "dark" && <Moon size={16} />}
                    {theme === "black" && <Moon size={16} />}
                    {theme === "light" && <Sun size={16} />}
                    {theme === "legacy" && <Monitor size={16} />}
                    <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: themeOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", opacity: 0.6 }}>
                      <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div className="status-badge">
                  <span className="status-badge__dot" />
                  LIVE
                </div>
              </div>
            </header>
            {themeOpen && (
              <div className="dropdown-menu" style={{ top: themePos.top, right: themePos.right - 2 }}>
                {THEMES.map((th) => {
                        const Icon = th.icon;
                        return (
                          <button
                            type="button"
                            key={th.id}
                            className={`dropdown-option ${th.id === theme ? "active" : ""}`}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                justifyContent: "flex-start",
                                width: "100%",
                                border: "none",
                                background: "transparent",
                                color: "inherit",
                                cursor: "pointer"
                            }}
                            onClick={() => {
                                setTheme(th.id);
                                setThemeOpen(false);
                            }}
                          >
                            <Icon size={14} />
                            {th.label}
                          </button>
                        );
                    })}
              </div>
            )}
          </>
        );
    }

    // Desktop: full header
    return (
      <>
        <header className="header glass-panel">
          <div className="header__brand">
            <a href="https://worldwideview.dev/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Image src="/logo/logo-icon.svg" alt="Logo" width={22} height={22} style={{ objectFit: "contain" }} />
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
              {REGIONS.map((r) => {
                        const Icon = r.icon;
                        return (
                          <button
                            type="button"
                            key={r.id}
                            className="btn btn--glow"
                            onClick={() => {
                                    dataBus.emit("cameraPreset", { presetId: r.id });
                                    trackEvent("region-select", { region: r.id });
                                }}
                            title={r.label}
                            style={{
 display: "flex", alignItems: "center", gap: "6px", flexShrink: 0
}}
                          >
                            <Icon size={14} />
                            {r.label}
                          </button>
                        );
                    })}
              <div style={{
 width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0
}}
              />
              <button
                type="button"
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
              <div style={{ position: "relative", flexShrink: 0 }}>
                <button
                  type="button"
                  ref={themeButtonRef}
                  className="btn btn--glow"
                  onClick={() => {
                                if (!themeOpen && themeButtonRef.current) {
                                    const rect = themeButtonRef.current.getBoundingClientRect();
                                    setThemePos({
                                        top: rect.bottom + 8,
                                        right: window.innerWidth - (rect.right + 2),
                                    });
                                }
                                setThemeOpen((v) => !v);
                            }}
                  title="Theme Selection"
                  style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                >
                  {theme === "dark" && <Moon size={14} />}
                  {theme === "black" && <Moon size={14} />}
                  {theme === "light" && <Sun size={14} />}
                  {theme === "legacy" && <Monitor size={14} />}
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: themeOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", opacity: 0.6 }}>
                    <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div style={{
 width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0
}}
              />
              <div style={{ position: "relative", flexShrink: 0 }} ref={timeRef}>
                <button
                  ref={timeButtonRef}
                  className="btn btn--glow"
                  type="button"
                  onClick={() => {
                            if (!timeOpen && timeButtonRef.current) {
                              const rect = timeButtonRef.current.getBoundingClientRect();
                              setTimePos({
                                top: rect.bottom + 8,
                                right: window.innerWidth - (rect.right + 2),
                              });
                            }
                            setTimeOpen((v) => !v);
                          }}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {timeWindow}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    style={{
                            transform: timeOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                            opacity: 0.6,
                          }}
                  >
                    <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div style={{
 width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0
}}
            />
            <div className="header__actions">
              <div className="status-badge">
                <span className="status-badge__dot" />
                LIVE
              </div>
            </div>
          </div>
        </header>
        {timeOpen && (
          <div className="dropdown-menu" style={{ top: timePos.top, right: timePos.right - 2 }}>
            {TIME_WINDOWS.map((tw) => (
              <button
                type="button"
                key={tw}
                className={`dropdown-option ${tw === timeWindow ? "active" : ""}`}
                style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer"
                }}
                onClick={() => {
                  setTimeWindow(tw);
                  const range = useStore.getState().timeRange;
                  pluginManager.updateTimeRange(range);
                  trackEvent("time-window-change", { window: tw });
                  setTimeOpen(false);
                }}
              >
                {tw}
              </button>
            ))}
          </div>
        )}
        {themeOpen && (
          <div className="dropdown-menu" style={{ top: themePos.top, right: themePos.right - 2 }}>
            {THEMES.map((th) => {
                    const Icon = th.icon;
                    return (
                      <button
                        type="button"
                        key={th.id}
                        className={`dropdown-option ${th.id === theme ? "active" : ""}`}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            justifyContent: "flex-start",
                            width: "100%",
                            border: "none",
                            background: "transparent",
                            color: "inherit",
                            cursor: "pointer"
                        }}
                        onClick={() => {
                                setTheme(th.id);
                                setThemeOpen(false);
                            }}
                      >
                        <Icon size={14} />
                        {th.label}
                      </button>
                    );
                })}
          </div>
        )}
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
                <h2 style={{ margin: 0 }}>Keys &amp; Access</h2>

                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowApiKeys(false)}
                >
                  Close
                </button>
              </div>

              <ApiKeysTab />
              {!isDemo && (
                <>
                  <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "var(--space-lg) 0" }} />
                  <PersonalApiKeysSection />
                </>
              )}
            </div>
          </div>
                    )}
      </>
    );
}
