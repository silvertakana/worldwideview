"use client";

import { useState } from "react";
import { NewsReel } from "./NewsReel";

const TEXAS_CATEGORIES = [
    { id: "", label: "All" },
    { id: "weather", label: "Weather" },
    { id: "crime", label: "Crime" },
    { id: "transportation", label: "Traffic" },
    { id: "energy", label: "Energy" },
    { id: "gas", label: "Gas" },
    { id: "news", label: "News" },
];

// Most commonly matched tech tags across the 33 tracked sites, sorted by site coverage.
// These labels must match exactly what tagLabels() returns from taxonomy.ts.
const CVE_TAG_FILTERS = [
    "Linux Kernel", "OpenSSL", "OpenSSH", "Python", "VMware / vSphere",
    "Kubernetes", "AWS", "Docker", "Cisco", "CUDA",
    "C/C++", "Java", "NVIDIA", "PyTorch", "TensorFlow",
    "Go", "Rust", "Nginx", "MySQL", "Redis",
];

type FeedSource = "texas" | "cve";

const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid",
    cursor: "pointer",
    borderColor: active ? "var(--accent-cyan)" : "rgba(255,255,255,0.12)",
    background: active ? "rgba(0,255,255,0.08)" : "transparent",
    color: active ? "var(--accent-cyan)" : "var(--text-muted)",
    transition: "all var(--duration-fast)",
});

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    padding: "3px 8px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid",
    cursor: "pointer",
    borderColor: active ? "var(--accent-cyan)" : "rgba(255,255,255,0.12)",
    background: active ? "rgba(0,255,255,0.08)" : "transparent",
    color: active ? "var(--accent-cyan)" : "var(--text-muted)",
    transition: "all var(--duration-fast)",
});

const tagChipStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    padding: "2px 7px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid",
    cursor: "pointer",
    borderColor: active ? "rgba(249,115,22,0.6)" : "rgba(255,255,255,0.1)",
    background: active ? "rgba(249,115,22,0.14)" : "transparent",
    color: active ? "#f97316" : "var(--text-muted)",
    transition: "all var(--duration-fast)",
    whiteSpace: "nowrap" as const,
});

export function FeedsTab() {
    const [source, setSource] = useState<FeedSource>("texas");
    const [activeCategory, setActiveCategory] = useState("");
    const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

    const toggleTag = (tag: string) => {
        setActiveTags((prev) => {
            const next = new Set(prev);
            if (next.has(tag)) next.delete(tag);
            else next.add(tag);
            return next;
        });
    };

    const clearTags = () => setActiveTags(new Set());

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {/* Source tabs */}
            <div style={{
                display: "flex",
                gap: "var(--space-xs)",
                paddingBottom: "var(--space-sm)",
                borderBottom: "1px solid var(--border-subtle)",
            }}>
                <button style={tabStyle(source === "texas")} onClick={() => setSource("texas")}>
                    Texas Feeds
                </button>
                <button style={tabStyle(source === "cve")} onClick={() => setSource("cve")}>
                    CVE Intel
                </button>
            </div>

            {/* Texas category filters */}
            {source === "texas" && (
                <div style={{
                    display: "flex",
                    gap: "var(--space-xs)",
                    flexWrap: "wrap",
                    paddingBottom: "var(--space-sm)",
                    borderBottom: "1px solid var(--border-subtle)",
                }}>
                    {TEXAS_CATEGORIES.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => setActiveCategory(c.id)}
                            style={filterBtnStyle(activeCategory === c.id)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            )}

            {/* CVE tag filters */}
            {source === "cve" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Filter by tech
                        </span>
                        {activeTags.size > 0 && (
                            <button
                                onClick={clearTags}
                                style={{
                                    fontSize: 10, fontFamily: "var(--font-mono)",
                                    background: "transparent", border: "none",
                                    color: "#f97316", cursor: "pointer", padding: 0,
                                }}
                            >
                                clear ({activeTags.size})
                            </button>
                        )}
                    </div>
                    <div style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        paddingBottom: "var(--space-sm)",
                        borderBottom: "1px solid var(--border-subtle)",
                    }}>
                        {CVE_TAG_FILTERS.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                style={tagChipStyle(activeTags.has(tag))}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ overflowY: "auto", flex: 1 }}>
                {source === "texas" ? (
                    <NewsReel
                        key="feeds-texas"
                        categories={activeCategory || undefined}
                        limit={60}
                        endpoint="/api/feeds/texas"
                    />
                ) : (
                    <NewsReel
                        key="feeds-cve"
                        limit={200}
                        autoRefreshMs={3_600_000}
                        endpoint="/api/feeds/cve"
                        filterTags={activeTags.size > 0 ? [...activeTags] : undefined}
                    />
                )}
            </div>
        </div>
    );
}
