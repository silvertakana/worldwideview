"use client";

import { useEffect, useState } from "react";
import { ExternalLink, AlertTriangle, Zap, Car, Shield, Fuel, Newspaper, RefreshCw } from "lucide-react";
import type { FeedItem } from "@/app/api/feeds/texas/route";

const CATEGORY_META: Record<string, { label: string; color: string; Icon: React.FC<{ size?: number; style?: React.CSSProperties }> }> = {
    weather: { label: "Weather", color: "#38bdf8", Icon: AlertTriangle },
    crime: { label: "Crime", color: "#f87171", Icon: Shield },
    transportation: { label: "Traffic", color: "#fb923c", Icon: Car },
    energy: { label: "Energy", color: "#facc15", Icon: Zap },
    gas: { label: "Gas", color: "#4ade80", Icon: Fuel },
    news: { label: "News", color: "#a78bfa", Icon: Newspaper },
};

const SEVERITY_BG: Record<string, string> = {
    critical: "rgba(239,68,68,0.12)",
    warning: "rgba(234,179,8,0.10)",
    info: "rgba(255,255,255,0.03)",
};

interface Props {
    categories?: string;
    limit?: number;
    autoRefreshMs?: number;
}

export function NewsReel({ categories, limit = 50, autoRefreshMs = 120_000 }: Props) {
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ limit: String(limit) });
            if (categories) params.set("category", categories);
            const res = await fetch(`/api/feeds/texas?${params}`);
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            setItems(data.items ?? []);
            setLastRefresh(new Date());
        } catch (e: any) {
            setError(e.message ?? "Failed to load feed");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const t = setInterval(load, autoRefreshMs);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories, limit, autoRefreshMs]);

    if (error) {
        return (
            <div style={{ padding: "var(--space-md)", color: "var(--text-muted)", fontSize: 13 }}>
                Feed unavailable: {error}
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : "Loading…"}
                </span>
                <button
                    onClick={load}
                    disabled={loading}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: loading ? "var(--text-muted)" : "var(--accent-cyan)",
                        cursor: loading ? "default" : "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                    }}
                    title="Refresh"
                >
                    <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                </button>
            </div>

            {items.length === 0 && !loading && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", textAlign: "center", padding: "var(--space-lg)" }}>
                    No items at this time.
                </div>
            )}

            {items.map((item) => {
                const meta = CATEGORY_META[item.category] ?? CATEGORY_META.news;
                const { Icon } = meta;
                return (
                    <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: "block",
                            textDecoration: "none",
                            background: SEVERITY_BG[item.severity ?? "info"],
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderLeft: `3px solid ${meta.color}`,
                            borderRadius: "var(--radius-md)",
                            padding: "var(--space-sm) var(--space-md)",
                            transition: "background var(--duration-fast)",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                                "rgba(255,255,255,0.07)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                                SEVERITY_BG[item.severity ?? "info"];
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
                            <Icon size={13} style={{ color: meta.color, flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: "var(--text-primary)",
                                    lineHeight: 1.4,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}>
                                    {item.title}
                                </div>
                                {item.summary && (
                                    <div style={{
                                        fontSize: 11,
                                        color: "var(--text-secondary)",
                                        lineHeight: 1.4,
                                        marginTop: 2,
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                    }}>
                                        {item.summary}
                                    </div>
                                )}
                                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginTop: 4 }}>
                                    <span style={{
                                        fontSize: 10,
                                        fontFamily: "var(--font-mono)",
                                        color: meta.color,
                                        background: `${meta.color}18`,
                                        borderRadius: "var(--radius-sm)",
                                        padding: "1px 5px",
                                    }}>
                                        {meta.label}
                                    </span>
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                        {item.source}
                                    </span>
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                        {new Date(item.publishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    <ExternalLink size={10} style={{ color: "var(--text-muted)", marginLeft: "auto" }} />
                                </div>
                            </div>
                        </div>
                    </a>
                );
            })}
        </div>
    );
}
