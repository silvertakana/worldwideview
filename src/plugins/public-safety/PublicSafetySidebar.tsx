"use client";

import { Radio, ExternalLink, Lock } from "lucide-react";

const SCANNER_FEEDS = [
    {
        name: "Travis County Audio Feeds",
        description: "TCSO dispatch — unencrypted",
        url: "https://www.broadcastify.com/listen/ctid/2749",
        encrypted: false,
    },
];

export function PublicSafetySidebar() {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>

            {/* Info */}
            <div style={{
                fontSize: 11,
                color: "var(--text-muted)",
                lineHeight: 1.5,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-sm) var(--space-md)",
            }}>
                Austin APD crime reports from the last 72 hours.
                Markers are placed at the approximate center of each patrol sector —
                the APD dataset does not include GPS coordinates.
            </div>

            {/* Scanner feeds */}
            <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "var(--space-sm)" }}>
                    <Radio size={11} style={{ color: "var(--text-muted)" }} />
                    <span style={sectionLabelStyle}>Scanner Feeds</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                    {SCANNER_FEEDS.map((feed) => (
                        <div
                            key={feed.name}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "var(--space-sm)",
                                padding: "6px 10px",
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: "var(--radius-sm)",
                                opacity: feed.encrypted ? 0.45 : 1,
                            }}
                        >
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: feed.encrypted ? "var(--text-muted)" : "var(--text-primary)",
                                }}>
                                    {feed.name}
                                </span>
                                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                    {feed.description}
                                </span>
                            </div>

                            {feed.encrypted ? (
                                <Lock size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                            ) : (
                                <a
                                    href={feed.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 10,
                                        color: "var(--accent-cyan)",
                                        textDecoration: "none",
                                        padding: "3px 7px",
                                        background: "rgba(0,255,255,0.06)",
                                        border: "1px solid rgba(0,255,255,0.15)",
                                        borderRadius: "var(--radius-sm)",
                                        flexShrink: 0,
                                    }}
                                >
                                    <ExternalLink size={9} />
                                    Listen
                                </a>
                            )}
                        </div>
                    ))}
                </div>

                <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: "var(--space-sm)", lineHeight: 1.4 }}>
                    APD went encrypted in 2019 — live APD audio is no longer on public scanners.
                </p>
            </div>
        </div>
    );
}

const sectionLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
};
