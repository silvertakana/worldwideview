"use client";

import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";

/**
 * Floating button that toggles waypoint placement mode.
 * When active, the next globe click (empty space) creates a new waypoint.
 * Shown only when the user is authenticated (waypoints API requires auth).
 */
export function WaypointPlacementButton() {
    const isActive = useStore((s) => s.waypointPlacementActive);
    const setActive = useStore((s) => s.setWaypointPlacementActive);
    const addWaypoint = useStore((s) => s.addWaypoint);
    const [promptPos, setPromptPos] = useState<{ lat: number; lon: number } | null>(null);
    const [promptTitle, setPromptTitle] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isActive) return;
        const unsub = dataBus.on("globeClick", ({ lat, lon }) => {
            setPromptPos({ lat, lon });
            setActive(false);
        });
        return unsub;
    }, [isActive, setActive]);

    // Cancel placement on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setActive(false);
                setPromptPos(null);
                setPromptTitle("");
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [setActive]);

    const saveWaypoint = async () => {
        if (!promptPos || !promptTitle.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/waypoints", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: promptTitle.trim(),
                    lat: promptPos.lat,
                    lon: promptPos.lon,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                addWaypoint({
                    ...data.waypoint,
                    createdAt: data.waypoint.createdAt ?? new Date().toISOString(),
                });
                setPromptPos(null);
                setPromptTitle("");
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <button
                onClick={() => {
                    if (isActive) {
                        setActive(false);
                    } else {
                        setActive(true);
                        setPromptPos(null);
                    }
                }}
                title={isActive ? "Cancel waypoint placement (Esc)" : "Place a waypoint"}
                style={{
                    position: "fixed",
                    bottom: 80,
                    right: 16,
                    zIndex: 200,
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: "1px solid",
                    borderColor: isActive ? "#38bdf8" : "rgba(255,255,255,0.2)",
                    background: isActive ? "rgba(56,189,248,0.15)" : "rgba(0,0,0,0.6)",
                    color: isActive ? "#38bdf8" : "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(8px)",
                    transition: "all 0.15s",
                    boxShadow: isActive ? "0 0 16px rgba(56,189,248,0.3)" : "none",
                }}
            >
                {isActive ? <X size={18} /> : <MapPin size={18} />}
            </button>

            {isActive && (
                <div style={{
                    position: "fixed",
                    bottom: 128,
                    right: 16,
                    zIndex: 200,
                    background: "rgba(0,0,0,0.85)",
                    border: "1px solid rgba(56,189,248,0.4)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "#38bdf8",
                    backdropFilter: "blur(8px)",
                    pointerEvents: "none",
                    maxWidth: 180,
                    textAlign: "center",
                }}>
                    Click anywhere on the globe to place a waypoint
                </div>
            )}

            {promptPos && (
                <div style={{
                    position: "fixed",
                    bottom: 128,
                    right: 16,
                    zIndex: 300,
                    background: "rgba(10,10,20,0.95)",
                    border: "1px solid rgba(56,189,248,0.4)",
                    borderRadius: 10,
                    padding: "var(--space-md)",
                    backdropFilter: "blur(12px)",
                    width: 240,
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-sm)",
                }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {promptPos.lat.toFixed(4)}°, {promptPos.lon.toFixed(4)}°
                    </div>
                    <input
                        autoFocus
                        value={promptTitle}
                        onChange={(e) => setPromptTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveWaypoint(); }}
                        placeholder="Waypoint name…"
                        style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: 6,
                            padding: "6px 10px",
                            color: "var(--text-primary)",
                            fontSize: 13,
                            width: "100%",
                            boxSizing: "border-box",
                        }}
                    />
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <button
                            onClick={() => { setPromptPos(null); setPromptTitle(""); }}
                            style={{
                                flex: 1, fontSize: 12, padding: "5px",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 6, background: "transparent",
                                color: "var(--text-muted)", cursor: "pointer",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveWaypoint}
                            disabled={saving || !promptTitle.trim()}
                            style={{
                                flex: 1, fontSize: 12, padding: "5px",
                                border: "none", borderRadius: 6,
                                background: "#38bdf8", color: "#000",
                                cursor: saving || !promptTitle.trim() ? "default" : "pointer",
                                opacity: saving || !promptTitle.trim() ? 0.5 : 1,
                            }}
                        >
                            {saving ? "…" : "Place"}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
