"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, AlertTriangle, Zap, Car, Shield, Fuel, Newspaper, RefreshCw, Bug } from "lucide-react";
import type { FeedItem } from "@/app/api/feeds/texas/route";

const CATEGORY_META: Record<string, { label: string; color: string; Icon: React.FC<{ size?: number; style?: React.CSSProperties }> }> = {
    weather: { label: "Weather", color: "#38bdf8", Icon: AlertTriangle },
    crime: { label: "Crime", color: "#f87171", Icon: Shield },
    transportation: { label: "Traffic", color: "#fb923c", Icon: Car },
    energy: { label: "Energy", color: "#facc15", Icon: Zap },
    gas: { label: "Gas", color: "#4ade80", Icon: Fuel },
    news: { label: "News", color: "#a78bfa", Icon: Newspaper },
    cve: { label: "CVE", color: "#ef4444", Icon: Bug },
};

const SEVERITY_BG: Record<string, string> = {
    critical: "rgba(239,68,68,0.12)",
    warning: "rgba(234,179,8,0.10)",
    info: "rgba(255,255,255,0.03)",
};

// CVSS 4-tier visual treatment
function cvssStyle(score: number | undefined): { bg: string; color: string; borderColor: string; label: string } {
    if (score === undefined || score === 0) return { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", borderColor: "#94a3b8", label: "N/A" };
    if (score >= 9.0) return { bg: "rgba(239,68,68,0.18)", color: "#ef4444", borderColor: "#ef4444", label: "CRITICAL" };
    if (score >= 7.0) return { bg: "rgba(249,115,22,0.16)", color: "#f97316", borderColor: "#f97316", label: "HIGH" };
    if (score >= 4.0) return { bg: "rgba(234,179,8,0.14)", color: "#eab308", borderColor: "#eab308", label: "MEDIUM" };
    return { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", borderColor: "#94a3b8", label: "LOW" };
}

function formatCveDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays <= 6) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
}

interface Props {
    categories?: string;
    limit?: number;
    autoRefreshMs?: number;
    endpoint?: string;
    /** Client-side tag label filter — only CVE items whose affectedTech overlaps will be shown. */
    filterTags?: string[];
}

export function NewsReel({ categories, limit = 50, autoRefreshMs = 120_000, endpoint = "/api/feeds/texas", filterTags }: Props) {
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const isCveEndpoint = endpoint.includes("/feeds/cve");

    const load = useCallback(
        async (signal?: AbortSignal) => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({ limit: String(limit) });
                if (categories) params.set("category", categories);
                const res = await fetch(`${endpoint}?${params}`, { signal });
                if (!res.ok) throw new Error(`${res.status}`);
                const data = await res.json();
                setItems(data.items ?? []);
                setLastRefresh(new Date());
            } catch (e: any) {
                if (e?.name === "AbortError") return;
                setError(e.message ?? "Failed to load feed");
            } finally {
                if (!signal?.aborted) setLoading(false);
            }
        },
        [categories, endpoint, limit],
    );

    useEffect(() => {
        const ac = new AbortController();
        void load(ac.signal);
        const t = setInterval(() => void load(ac.signal), autoRefreshMs);
        return () => {
            ac.abort();
            clearInterval(t);
        };
    }, [autoRefreshMs, load]);

    let displayItems = isCveEndpoint ? items.filter((item) => item.category === "cve") : items;
    if (filterTags && filterTags.length > 0) {
        displayItems = displayItems.filter((item) =>
            filterTags.some((tag) => item.affectedTech?.includes(tag)),
        );
    }

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
                    {loading ? "Loading…" : lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : "—"}
                    {filterTags && filterTags.length > 0 && !loading && (
                        <span style={{ marginLeft: 6, color: "#f97316" }}>
                            {displayItems.length} of {items.length}
                        </span>
                    )}
                </span>
                <button
                    onClick={() => void load()}
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

            {displayItems.length === 0 && !loading && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", textAlign: "center", padding: "var(--space-lg)" }}>
                    {filterTags && filterTags.length > 0 ? "No CVEs match the selected tags." : "No items at this time."}
                </div>
            )}

            {displayItems.map((item) => {
                if (item.category === "cve") {
                    return <CveCard key={item.id} item={item} />;
                }

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
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = SEVERITY_BG[item.severity ?? "info"];
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
                            <Icon size={13} style={{ color: meta.color, flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 12, fontWeight: 500, color: "var(--text-primary)",
                                    lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                }}>
                                    {item.title}
                                </div>
                                {item.summary && (
                                    <div style={{
                                        fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4, marginTop: 2,
                                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                                    }}>
                                        {item.summary}
                                    </div>
                                )}
                                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginTop: 4 }}>
                                    <span style={{
                                        fontSize: 10, fontFamily: "var(--font-mono)", color: meta.color,
                                        background: `${meta.color}18`, borderRadius: "var(--radius-sm)", padding: "1px 5px",
                                    }}>
                                        {meta.label}
                                    </span>
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.source}</span>
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

// ─── CVE Card ─────────────────────────────────────────────────────────────────

function CveCard({ item }: { item: FeedItem }) {
    const cs = cvssStyle(item.cvssScore);
    const sites = item.impactedSites ?? [];
    const tech = item.affectedTech ?? [];
    const MAX_SITES = 5;

    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                display: "block",
                textDecoration: "none",
                background: item.severity === "critical"
                    ? "rgba(239,68,68,0.06)"
                    : item.severity === "warning"
                    ? "rgba(249,115,22,0.04)"
                    : "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderLeft: `3px solid ${cs.borderColor}`,
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                transition: "background var(--duration-fast)",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                    item.severity === "critical"
                        ? "rgba(239,68,68,0.06)"
                        : item.severity === "warning"
                        ? "rgba(249,115,22,0.04)"
                        : "rgba(255,255,255,0.02)";
            }}
        >
            {/* Row 1: CVE ID + CVSS badge + date */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                    color: "var(--text-primary)", letterSpacing: "0.02em",
                }}>
                    {item.cveId ?? item.title}
                </span>
                <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                    padding: "2px 7px", borderRadius: "var(--radius-sm)",
                    background: cs.bg, color: cs.color,
                    border: `1px solid ${cs.borderColor}40`,
                    letterSpacing: "0.03em",
                }}>
                    {cs.label}{item.cvssScore !== undefined ? ` ${item.cvssScore.toFixed(1)}` : ""}
                </span>
                <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)",
                    marginLeft: "auto", whiteSpace: "nowrap",
                }}>
                    {formatCveDate(item.publishedAt)}
                </span>
                <ExternalLink size={10} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            </div>

            {/* Row 2: Affected companies — PRIMARY, prominent */}
            {sites.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                    {sites.slice(0, MAX_SITES).map((site) => (
                        <span key={site} style={{
                            fontSize: 11, fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: "var(--radius-sm)",
                            background: "rgba(249,115,22,0.14)",
                            border: "1px solid rgba(249,115,22,0.35)",
                            color: "#f97316",
                            lineHeight: 1.4,
                        }}>
                            {site}
                        </span>
                    ))}
                    {sites.length > MAX_SITES && (
                        <span style={{
                            fontSize: 11, fontWeight: 500,
                            padding: "3px 9px",
                            borderRadius: "var(--radius-sm)",
                            background: "rgba(249,115,22,0.06)",
                            border: "1px solid rgba(249,115,22,0.2)",
                            color: "#f9731680",
                        }}>
                            +{sites.length - MAX_SITES} more
                        </span>
                    )}
                </div>
            )}

            {/* Row 3: CVE description */}
            {item.summary && (
                <div style={{
                    fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5,
                    marginBottom: 8,
                    display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                    {item.summary}
                </div>
            )}

            {/* Row 4: Tech tags (secondary, informational) + source */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                {tech.slice(0, 6).map((t) => (
                    <span key={t} style={{
                        fontSize: 9, fontFamily: "var(--font-mono)",
                        padding: "1px 5px",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        color: "var(--text-muted)",
                    }}>
                        {t}
                    </span>
                ))}
                {tech.length > 6 && (
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>+{tech.length - 6}</span>
                )}
                <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
                    {item.source}
                </span>
            </div>
        </a>
    );
}
