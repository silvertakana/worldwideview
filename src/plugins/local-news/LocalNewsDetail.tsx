"use client";

import type { GeoEntity } from "@/core/plugins/PluginTypes";
import { ExternalLink, Newspaper, MapPin } from "lucide-react";

export function LocalNewsDetail({ entity }: { entity: GeoEntity }) {
    const { headline, url, source, summary, publishedAt, city } = entity.properties as Record<string, string>;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
                <Newspaper size={14} style={{ color: "#a78bfa", flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
                    {headline}
                </span>
            </div>

            {summary && (
                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                    {summary}
                </p>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", fontSize: 11 }}>
                <span style={{
                    color: "#a78bfa",
                    background: "rgba(167,139,250,0.12)",
                    borderRadius: "var(--radius-sm)",
                    padding: "2px 7px",
                    fontFamily: "var(--font-mono)",
                }}>
                    {source}
                </span>
                {city && (
                    <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--text-muted)" }}>
                        <MapPin size={10} />
                        {city}
                    </span>
                )}
                {publishedAt && (
                    <span style={{ color: "var(--text-muted)" }}>
                        {new Date(publishedAt).toLocaleString([], {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                        })}
                    </span>
                )}
            </div>

            {url && (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--space-xs)",
                        fontSize: 12,
                        color: "var(--accent-cyan)",
                        textDecoration: "none",
                        padding: "6px 10px",
                        background: "rgba(0,255,255,0.06)",
                        border: "1px solid rgba(0,255,255,0.15)",
                        borderRadius: "var(--radius-md)",
                        width: "fit-content",
                    }}
                >
                    <ExternalLink size={12} />
                    Read full article
                </a>
            )}
        </div>
    );
}
