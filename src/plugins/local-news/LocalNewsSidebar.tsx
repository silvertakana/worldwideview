"use client";

import { NewsReel } from "@/components/panels/NewsReel";
import { CITY_COORDS } from "./outlets";
import { dataBus } from "@/core/data/DataBus";
import { MapPin } from "lucide-react";

const CITIES = Object.keys(CITY_COORDS).sort();

export function LocalNewsSidebar() {
    function flyTo(city: string) {
        const coords = CITY_COORDS[city];
        if (!coords) return;
        dataBus.emit("cameraGoTo", { lat: coords.lat, lon: coords.lon, alt: coords.alt });
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Fly to bureau
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
                    {CITIES.map((city) => (
                        <button
                            key={city}
                            onClick={() => flyTo(city)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                fontFamily: "var(--font-mono)",
                                color: "var(--accent-cyan)",
                                background: "rgba(0,255,255,0.07)",
                                border: "1px solid rgba(0,255,255,0.15)",
                                borderRadius: "var(--radius-sm)",
                                padding: "3px 8px",
                                cursor: "pointer",
                                transition: "all var(--duration-fast)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(0,255,255,0.18)";
                                e.currentTarget.style.borderColor = "rgba(0,255,255,0.4)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(0,255,255,0.07)";
                                e.currentTarget.style.borderColor = "rgba(0,255,255,0.15)";
                            }}
                        >
                            <MapPin size={9} />
                            {city}
                        </button>
                    ))}
                </div>
            </div>
            <NewsReel categories="news" limit={80} autoRefreshMs={180_000} />
        </div>
    );
}
