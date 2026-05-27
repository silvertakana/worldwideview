"use client";
/**
 * PluginSettingsPanel — Floating modal for plugin API key configuration.
 * Shows a gear icon in the header. All keys stored in localStorage.
 * Covers: ACLED (War Zones), Alpha Vantage (Stocks), AISStream (Ships).
 * Free-tier layers show a green "No key required" badge.
 */

import { useState, useCallback, useEffect } from "react";
import {
    Settings, Eye, EyeOff, CheckCircle, XCircle, Loader2, X,
} from "lucide-react";

interface KeyEntry {
    id: string;
    label: string;
    description: string;
    placeholder: string;
    lsKey: string;
    free?: boolean; // show "no key required" badge instead of input
    testUrl?: (key: string) => string; // optional live test
}

const KEY_ENTRIES: KeyEntry[] = [
    // --- Free APIs ---
    {
        id: "opensky",
        label: "Flights (OpenSky)",
        description: "Anonymous real-time aircraft positions",
        placeholder: "",
        lsKey: "",
        free: true,
    },
    {
        id: "open-meteo",
        label: "Weather (Open-Meteo)",
        description: "Current conditions for 20 major cities",
        placeholder: "",
        lsKey: "",
        free: true,
    },
    {
        id: "usgs",
        label: "Earthquakes (USGS)",
        description: "Real-time seismic events GeoJSON feed",
        placeholder: "",
        lsKey: "",
        free: true,
    },
    {
        id: "gvp",
        label: "Volcanoes (Smithsonian GVP)",
        description: "Active volcano data (hardcoded from GVP 2024)",
        placeholder: "",
        lsKey: "",
        free: true,
    },
    {
        id: "blitzortung",
        label: "Lightning (Blitzortung.org)",
        description: "Public WebSocket lightning strike network",
        placeholder: "",
        lsKey: "",
        free: true,
    },
    {
        id: "gdacs",
        label: "Disasters (GDACS)",
        description: "Global Disaster Alert and Coordination System",
        placeholder: "",
        lsKey: "",
        free: true,
    },
    {
        id: "open-notify-iss",
        label: "ISS Tracker (wheretheiss.at)",
        description: "International Space Station position API",
        placeholder: "",
        lsKey: "",
        free: true,
    },
    {
        id: "rss",
        label: "News (RSS Feeds)",
        description: "BBC, Al Jazeera, NYT, ABC Australia, Times of India",
        placeholder: "",
        lsKey: "",
        free: true,
    },
    // --- Keyed APIs ---
    {
        id: "aisstream",
        label: "Ships (AISStream)",
        description: "Real-time vessel positions WebSocket — free at aisstream.io",
        placeholder: "Your AISStream API key",
        lsKey: "wwv_aisstream_key",
    },
    {
        id: "acled-email",
        label: "War Zones (ACLED) — Email",
        description: "ACLED API email — register free at developer.acleddata.com",
        placeholder: "your@email.com",
        lsKey: "wwv_acled_email",
    },
    {
        id: "acled-key",
        label: "War Zones (ACLED) — API Key",
        description: "ACLED API key — register free at developer.acleddata.com",
        placeholder: "Your ACLED API key",
        lsKey: "wwv_acled_key",
    },
    {
        id: "alphavantage",
        label: "Stocks (Alpha Vantage)",
        description: "Free stock market API — register at alphavantage.co",
        placeholder: "Your Alpha Vantage API key",
        lsKey: "wwv_alphavantage_key",
    },
];

type SaveStatus = "idle" | "saved" | "cleared";

function FreeBadge() {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(16,185,129,0.12)",
                color: "#10b981",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: 4,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
            }}
        >
            <CheckCircle size={10} />
            No key required
        </span>
    );
}

export function PluginSettingsTrigger() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                className="btn btn--glow"
                onClick={() => setOpen(true)}
                title="Plugin Settings"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
                <Settings size={14} />
            </button>
            {open && <PluginSettingsModal onClose={() => setOpen(false)} />}
        </>
    );
}

function PluginSettingsModal({ onClose }: { onClose: () => void }) {
    const [values, setValues] = useState<Record<string, string>>(() => {
        if (typeof window === "undefined") return {};
        const init: Record<string, string> = {};
        KEY_ENTRIES.forEach((e) => {
            if (e.lsKey) init[e.id] = localStorage.getItem(e.lsKey) ?? "";
        });
        return init;
    });

    const [visible, setVisible] = useState<Record<string, boolean>>({});
    const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});

    const handleChange = useCallback((id: string, lsKey: string, value: string) => {
        setValues((prev) => ({ ...prev, [id]: value }));
        if (lsKey) {
            if (value) localStorage.setItem(lsKey, value);
            else localStorage.removeItem(lsKey);
        }
        setSaveStatus((prev) => ({ ...prev, [id]: "saved" }));
        setTimeout(() => setSaveStatus((prev) => ({ ...prev, [id]: "idle" })), 1500);
    }, []);

    const handleClear = useCallback((id: string, lsKey: string) => {
        setValues((prev) => ({ ...prev, [id]: "" }));
        if (lsKey) localStorage.removeItem(lsKey);
        setSaveStatus((prev) => ({ ...prev, [id]: "cleared" }));
        setTimeout(() => setSaveStatus((prev) => ({ ...prev, [id]: "idle" })), 1500);
    }, []);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const inputStyle: React.CSSProperties = {
        background: "var(--bg-tertiary, #1e293b)",
        border: "1px solid var(--border-subtle, #334155)",
        color: "var(--text-primary, #e2e8f0)",
        padding: "6px 10px",
        borderRadius: 6,
        fontSize: 12,
        flex: 1,
        outline: "none",
        fontFamily: "monospace",
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-primary, #e2e8f0)",
        marginBottom: 2,
    };

    const descStyle: React.CSSProperties = {
        fontSize: 11,
        color: "var(--text-muted, #94a3b8)",
        marginBottom: 6,
    };

    return (
        <div
            style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex", alignItems: "flex-start",
                justifyContent: "center",
                paddingTop: "5vh", paddingBottom: "5vh",
                overflowY: "auto",
                zIndex: 9999,
            }}
            onClick={onClose}
        >
            <div
                className="glass-panel"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "min(640px, 90vw)",
                    maxHeight: "85vh",
                    overflowY: "auto",
                    padding: 24,
                    borderRadius: 16,
                    margin: 20,
                }}
            >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <Settings size={18} style={{ color: "var(--text-muted)" }} />
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Plugin Settings</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            marginLeft: "auto", background: "none", border: "none",
                            color: "var(--text-muted)", cursor: "pointer", padding: 4,
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>

                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24 }}>
                    All keys are stored only in your browser (localStorage). They never leave your device.
                </p>

                {/* Free APIs section */}
                <div style={{ marginBottom: 24 }}>
                    <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                        textTransform: "uppercase", color: "var(--text-muted)",
                        marginBottom: 12, paddingBottom: 6,
                        borderBottom: "1px solid var(--border-subtle)",
                    }}>
                        Free APIs — No Key Required
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {KEY_ENTRIES.filter((e) => e.free).map((entry) => (
                            <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ ...labelStyle, marginBottom: 0 }}>{entry.label}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{entry.description}</div>
                                </div>
                                <FreeBadge />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Keyed APIs section */}
                <div>
                    <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                        textTransform: "uppercase", color: "var(--text-muted)",
                        marginBottom: 12, paddingBottom: 6,
                        borderBottom: "1px solid var(--border-subtle)",
                    }}>
                        API Keys Required
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {KEY_ENTRIES.filter((e) => !e.free).map((entry) => {
                            const status = saveStatus[entry.id] ?? "idle";
                            const isVisible = visible[entry.id];
                            const val = values[entry.id] ?? "";

                            return (
                                <div key={entry.id}>
                                    <div style={labelStyle}>{entry.label}</div>
                                    <div style={descStyle}>{entry.description}</div>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                        <input
                                            type={isVisible ? "text" : "password"}
                                            value={val}
                                            placeholder={entry.placeholder}
                                            onChange={(e) => handleChange(entry.id, entry.lsKey, e.target.value)}
                                            style={inputStyle}
                                            autoComplete="off"
                                            spellCheck={false}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setVisible((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                                            title={isVisible ? "Hide" : "Show"}
                                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                                        >
                                            {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                        {val && (
                                            <button
                                                type="button"
                                                onClick={() => handleClear(entry.id, entry.lsKey)}
                                                title="Clear key"
                                                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                        {status === "saved" && <CheckCircle size={14} style={{ color: "#10b981", flexShrink: 0 }} />}
                                        {status === "cleared" && <XCircle size={14} style={{ color: "#ef4444", flexShrink: 0 }} />}
                                    </div>
                                    {status === "saved" && (
                                        <div style={{ fontSize: 10, color: "#10b981", marginTop: 2 }}>Saved to browser storage ✓</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer note */}
                <div style={{
                    marginTop: 24, padding: 12,
                    background: "rgba(59,130,246,0.08)",
                    border: "1px solid rgba(59,130,246,0.2)",
                    borderRadius: 8, fontSize: 11, color: "var(--text-muted)",
                }}>
                    <strong style={{ color: "var(--text-secondary)" }}>Changes take effect immediately.</strong>{" "}
                    Reload the page if a WebSocket plugin (Ships, Lightning) doesn't reconnect automatically.
                </div>
            </div>
        </div>
    );
}
