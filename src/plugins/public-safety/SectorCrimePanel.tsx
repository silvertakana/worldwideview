"use client";

import { useEffect, useState } from "react";
import { X, ShieldAlert, AlertTriangle, Clock } from "lucide-react";
import type { EmergencyItem } from "@/app/api/emergency/route";

interface Props {
    sectorName: string;
    sectorCode: string;
    onClose: () => void;
}

const SEVERITY_COLOR: Record<string, string> = {
    critical: "#ef4444",
    warning:  "#f97316",
    info:     "#a78bfa",
};

export function SectorCrimePanel({ sectorName, sectorCode, onClose }: Props) {
    const [crimes, setCrimes] = useState<EmergencyItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setCrimes([]);

        fetch(`/api/emergency?category=crime&limit=200&days=7`)
            .then((r) => r.json())
            .then((data) => {
                const all: EmergencyItem[] = data.items ?? [];
                // Match by full sector name OR 2-letter code
                const filtered = all.filter((item) => {
                    const s = (item.sector ?? "").toUpperCase();
                    return s === sectorCode.toUpperCase() || s === sectorName.toUpperCase().slice(0, 2);
                });
                setCrimes(filtered);
            })
            .catch(() => setCrimes([]))
            .finally(() => setLoading(false));
    }, [sectorCode, sectorName]);

    return (
        <div style={{
            position: "fixed",
            top: 80,
            right: 16,
            width: 320,
            maxHeight: "calc(100vh - 100px)",
            background: "var(--surface-1, rgba(12,12,20,0.96))",
            border: "1px solid rgba(167,139,250,0.25)",
            borderRadius: "var(--radius-lg, 10px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
            overflow: "hidden",
        }}>
            {/* Header */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                flexShrink: 0,
            }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary, #fff)" }}>
                        {sectorName} Sector
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted, #666)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                        {loading ? "loading..." : `${crimes.length} reports · last 7 days`}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted, #666)",
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <X size={14} />
                </button>
            </div>

            {/* Crime list */}
            <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
                {loading && (
                    <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 11, color: "var(--text-muted, #666)" }}>
                        Fetching reports...
                    </div>
                )}

                {!loading && crimes.length === 0 && (
                    <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 11, color: "var(--text-muted, #666)" }}>
                        No reports in this sector for the last 7 days.
                    </div>
                )}

                {crimes.map((crime) => {
                    const color = SEVERITY_COLOR[crime.severity] ?? "#a78bfa";
                    const date = new Date(crime.publishedAt).toLocaleString([], {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                    });
                    return (
                        <div
                            key={crime.id}
                            style={{
                                display: "flex",
                                gap: 10,
                                padding: "8px 14px",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                            }}
                        >
                            <div style={{ flexShrink: 0, paddingTop: 1 }}>
                                {crime.familyViolence
                                    ? <AlertTriangle size={12} color="#ef4444" />
                                    : <ShieldAlert size={12} color={color} />
                                }
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                <span style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: "var(--text-primary, #fff)",
                                    lineHeight: 1.3,
                                }}>
                                    {crime.crimeType ?? crime.title}
                                </span>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <span style={{ fontSize: 10, color: "var(--text-muted, #666)", display: "flex", alignItems: "center", gap: 3 }}>
                                        <Clock size={9} />
                                        {date}
                                    </span>
                                    {crime.familyViolence && (
                                        <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 600, textTransform: "uppercase" }}>
                                            FV
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
