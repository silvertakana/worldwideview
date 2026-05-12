"use client";

import { useState } from "react";
import { NewsReel } from "./NewsReel";

const CATEGORIES = [
    { id: "", label: "All" },
    { id: "weather", label: "Weather" },
    { id: "crime", label: "Crime" },
    { id: "transportation", label: "Traffic" },
    { id: "energy", label: "Energy" },
    { id: "gas", label: "Gas" },
];

export function FeedsTab() {
    const [activeCategory, setActiveCategory] = useState("");

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div style={{
                display: "flex",
                gap: "var(--space-xs)",
                flexWrap: "wrap",
                paddingBottom: "var(--space-sm)",
                borderBottom: "1px solid var(--border-subtle)",
            }}>
                {CATEGORIES.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => setActiveCategory(c.id)}
                        style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            padding: "3px 8px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid",
                            cursor: "pointer",
                            borderColor: activeCategory === c.id ? "var(--accent-cyan)" : "rgba(255,255,255,0.12)",
                            background: activeCategory === c.id ? "rgba(0,255,255,0.08)" : "transparent",
                            color: activeCategory === c.id ? "var(--accent-cyan)" : "var(--text-muted)",
                            transition: "all var(--duration-fast)",
                        }}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
                <NewsReel categories={activeCategory || undefined} limit={60} />
            </div>
        </div>
    );
}
