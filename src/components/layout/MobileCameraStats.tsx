"use client";

import { useState } from "react";
import { useStore } from "@/core/state/store";

/**
 * Floating collapsible camera-stats notch for mobile.
 * Hangs below the header + HUD bar as a separate element.
 * Mirrors desktop CameraStatsPanel data in a compact layout.
 */
export function MobileCameraStats() {
    const [collapsed, setCollapsed] = useState(true);

    const cameraLat = useStore((s) => s.cameraLat);
    const cameraLon = useStore((s) => s.cameraLon);
    const cameraAlt = useStore((s) => s.cameraAlt);
    const cameraHeading = useStore((s) => s.cameraHeading);
    const fps = useStore((s) => s.fps);

    const fmtCoord = (v: number) => v.toFixed(4);
    const fmtAlt = (v: number) =>
        v > 10000 ? `${(v / 1000).toFixed(1)}km` : `${v.toFixed(0)}m`;
    const fmtDeg = (v: number) => `${v.toFixed(1)}°`;

    return (
        <div
            className={`mobile-camera-stats glass-panel ${collapsed ? "mobile-camera-stats--collapsed" : ""}`}
            onClick={() => setCollapsed(!collapsed)}
        >
            {collapsed ? (
                <div className="mobile-camera-stats__tab">
                    <span>HUD</span>
                    <svg
                        width="10" height="10" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </div>
            ) : (
                <div className="mobile-camera-stats__row">
                    <div className="mobile-camera-stats__item">
                        <span className="mobile-camera-stats__label">LAT</span>
                        <span className="mobile-camera-stats__value">{fmtCoord(cameraLat)}</span>
                    </div>
                    <div className="mobile-camera-stats__item">
                        <span className="mobile-camera-stats__label">LON</span>
                        <span className="mobile-camera-stats__value">{fmtCoord(cameraLon)}</span>
                    </div>
                    <div className="mobile-camera-stats__item">
                        <span className="mobile-camera-stats__label">ALT</span>
                        <span className="mobile-camera-stats__value">{fmtAlt(cameraAlt)}</span>
                    </div>
                    <div className="mobile-camera-stats__sep" />
                    <div className="mobile-camera-stats__item">
                        <span className="mobile-camera-stats__label">HDG</span>
                        <span className="mobile-camera-stats__value">{fmtDeg(cameraHeading)}</span>
                    </div>
                    <div className="mobile-camera-stats__item">
                        <span className="mobile-camera-stats__label">FPS</span>
                        <span className="mobile-camera-stats__value">{fps}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
