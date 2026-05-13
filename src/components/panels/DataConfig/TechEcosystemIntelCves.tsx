"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeedItem } from "@/app/api/feeds/texas/route";
import { useStore } from "@/core/state/store";
import { cvesTouchingSites } from "@/lib/cve/siteIntel";
import { ExternalLink } from "lucide-react";

const PLUGIN_ID = "texas-tech-landscape";

function cvssBadge(score: number | undefined): { borderColor: string; label: string } {
    if (score === undefined || score === 0)
        return { borderColor: "#94a3b8", label: "N/A" };
    if (score >= 9.0) return { borderColor: "#ef4444", label: "CRITICAL" };
    if (score >= 7.0) return { borderColor: "#f97316", label: "HIGH" };
    if (score >= 4.0) return { borderColor: "#eab308", label: "MEDIUM" };
    return { borderColor: "#94a3b8", label: "LOW" };
}

function formatCveDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0)
        return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays <= 6) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function TechEcosystemIntelCves() {
    const selectedEntity = useStore((s) => s.selectedEntity);
    const highlightLayerId = useStore((s) => s.highlightLayerId);
    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);

    const showLayerIntel =
        !selectedEntity && highlightLayerId === PLUGIN_ID;
    const showEntityIntel = selectedEntity?.pluginId === PLUGIN_ID;
    const visible = showLayerIntel || showEntityIntel;

    const siteSet = useMemo(() => {
        if (!visible) return new Set<string>();
        if (selectedEntity?.pluginId === PLUGIN_ID)
            return new Set([selectedEntity.id]);
        const list = entitiesByPlugin[PLUGIN_ID] ?? [];
        return new Set(list.map((e) => e.id));
    }, [visible, selectedEntity, entitiesByPlugin]);

    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        async (signal?: AbortSignal) => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/feeds/cve", { signal });
                if (!res.ok) throw new Error(`${res.status}`);
                const data = await res.json();
                const raw: FeedItem[] = data.items ?? [];
                setItems(raw.filter((i) => i.category === "cve"));
            } catch (e: unknown) {
                if ((e as Error)?.name === "AbortError") return;
                setError((e as Error)?.message ?? "Failed to load CVE feed");
            } finally {
                if (!signal?.aborted) setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        if (!visible) return;
        const ac = new AbortController();
        void load(ac.signal);
        const t = setInterval(() => void load(ac.signal), 180_000);
        return () => {
            ac.abort();
            clearInterval(t);
        };
    }, [load, visible]);

    const filtered = useMemo(
        () =>
            visible ? cvesTouchingSites(items, siteSet, 40) : [],
        [visible, items, siteSet],
    );

    if (!visible) return null;

    return (
        <div
            style={{
                marginTop: "var(--space-lg)",
                paddingTop: "var(--space-lg)",
                borderTop: "1px solid var(--border-subtle)",
            }}
        >
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "var(--space-sm)",
                }}
            >
                CVE exposure (tracked stacks)
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: "var(--space-md)", lineHeight: 1.45 }}>
                Last 90 days of matching CVEs drive pin tint: cold blue → hot red. Newest first.
                {showEntityIntel ? " Showing CVEs linked to this stack." : " Showing CVEs hitting any site on this layer."}
            </p>

            {loading && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading CVE feed…</div>
            )}
            {error && !loading && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{error}</div>
            )}
            {!loading && !error && filtered.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    No matching CVEs in the current feed window.
                </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {filtered.map((item) => {
                    const cs = cvssBadge(item.cvssScore);
                    const title = item.cveId ?? item.title;
                    return (
                        <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "block",
                                textDecoration: "none",
                                padding: "10px 12px",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderLeft: `3px solid ${cs.borderColor}`,
                                background: "rgba(255,255,255,0.02)",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span
                                    style={{
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    {title}
                                </span>
                                <span
                                    style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        letterSpacing: "0.06em",
                                        color: cs.borderColor,
                                        border: `1px solid ${cs.borderColor}`,
                                        borderRadius: 4,
                                        padding: "2px 6px",
                                    }}
                                >
                                    {cs.label}
                                </span>
                                <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
                                    {formatCveDate(item.publishedAt)}
                                </span>
                                <ExternalLink size={12} color="var(--text-muted)" />
                            </div>
                            {item.summary && (
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--text-secondary)",
                                        lineHeight: 1.35,
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                    }}
                                >
                                    {item.summary}
                                </div>
                            )}
                        </a>
                    );
                })}
            </div>
        </div>
    );
}
