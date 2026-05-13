"use client";

import type { GeoEntity } from "@/core/plugins/PluginTypes";
import { ShieldAlert, Car, ExternalLink, MapPin, AlertTriangle, Clock } from "lucide-react";
import type { EmergencyItem } from "@/app/api/emergency/route";
import { getSectorCentroid } from "./sectorCentroids";

const SEVERITY_COLORS: Record<string, string> = {
    critical: "#ef4444",
    warning:  "#f97316",
    info:     "#a78bfa",
};

const TRAFFIC_COLOR = "#22d3ee";

export function PublicSafetyDetail({ entity }: { entity: GeoEntity }) {
    const props = entity.properties as unknown as EmergencyItem & { _color: string };
    const isTraffic = props.category === "traffic";
    const accentColor = isTraffic ? TRAFFIC_COLOR : (SEVERITY_COLORS[props.severity] ?? "#a78bfa");

    const Icon = isTraffic ? Car : ShieldAlert;

    const sectorLabel = props.sector
        ? getSectorCentroid(props.sector).label
        : null;

    const publishedAt = props.publishedAt
        ? new Date(props.publishedAt).toLocaleString([], {
            month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          })
        : null;

    const pulsePointUrl = `https://web.pulsepoint.org/`;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
                <Icon size={14} style={{ color: accentColor, flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
                    {props.title}
                </span>
            </div>

            {/* Family violence flag */}
            {props.familyViolence && (
                <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 8px",
                    fontSize: 11,
                    color: "#ef4444",
                    fontWeight: 600,
                }}>
                    <AlertTriangle size={11} />
                    Family Violence
                </div>
            )}

            {/* Meta row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", fontSize: 11 }}>
                {/* Category badge */}
                <span style={{
                    color: accentColor,
                    background: `${accentColor}1a`,
                    border: `1px solid ${accentColor}33`,
                    borderRadius: "var(--radius-sm)",
                    padding: "2px 7px",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                }}>
                    {isTraffic ? "Traffic" : "Crime"}
                </span>

                {/* Severity badge (crime only) */}
                {!isTraffic && (
                    <span style={{
                        color: accentColor,
                        background: `${accentColor}1a`,
                        border: `1px solid ${accentColor}33`,
                        borderRadius: "var(--radius-sm)",
                        padding: "2px 7px",
                        fontFamily: "var(--font-mono)",
                    }}>
                        {props.severity}
                    </span>
                )}

                {/* Timestamp */}
                {publishedAt && (
                    <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--text-muted)" }}>
                        <Clock size={10} />
                        {publishedAt}
                    </span>
                )}
            </div>

            {/* Location */}
            {(sectorLabel || props.address) && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                    <MapPin size={11} style={{ flexShrink: 0 }} />
                    {props.address ?? sectorLabel}
                    {props.district && !isTraffic && (
                        <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            · District {props.district}
                        </span>
                    )}
                </div>
            )}

            {/* Crime-specific fields */}
            {!isTraffic && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                    {props.ucr && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            UCR {props.ucr}{props.ucrCategory ? ` · ${props.ucrCategory}` : ""}
                        </div>
                    )}
                    {props.clearanceStatus && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Status: <span style={{ color: "var(--text-secondary)" }}>{props.clearanceStatus}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Traffic status */}
            {isTraffic && props.status && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Status: <span style={{ fontWeight: 500 }}>{props.status}</span>
                </div>
            )}

            {/* Source link */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <a
                    href="https://data.austintexas.gov/Public-Safety/Crime-Reports/fdj4-gpfu"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                >
                    <ExternalLink size={11} />
                    {isTraffic ? "Austin Traffic Data" : "APD Crime Reports"}
                </a>

                {!isTraffic && (
                    <a
                        href={pulsePointUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={linkStyle}
                    >
                        <ExternalLink size={11} />
                        Live dispatch on PulsePoint
                    </a>
                )}
            </div>
        </div>
    );
}

const linkStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    color: "var(--accent-cyan)",
    textDecoration: "none",
    padding: "5px 9px",
    background: "rgba(0,255,255,0.06)",
    border: "1px solid rgba(0,255,255,0.15)",
    borderRadius: "var(--radius-sm)",
    width: "fit-content",
};
