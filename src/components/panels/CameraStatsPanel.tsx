"use client";

import React, { useState } from "react";
import { useStore } from "@/core/state/store";

export default function CameraStatsPanel() {
    const [collapsed, setCollapsed] = useState(false);

    const cameraLat = useStore((s) => s.cameraLat);
    const cameraLon = useStore((s) => s.cameraLon);
    const cameraAlt = useStore((s) => s.cameraAlt);
    const cameraHeading = useStore((s) => s.cameraHeading);
    const cameraPitch = useStore((s) => s.cameraPitch);
    const cameraRoll = useStore((s) => s.cameraRoll);
    const fps = useStore((s) => s.fps);

    const formatCoord = (val: number) => val.toFixed(6);
    const formatAlt = (val: number) => {
        if (val > 10000) return `${(val / 1000).toFixed(2)} km`;
        return `${val.toFixed(0)} m`;
    };
    const formatDeg = (val: number) => `${val.toFixed(1)}°`;

    return (
        <div
            className={`camera-stats ${collapsed ? "camera-stats--collapsed" : ""}`}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Show HUD" : "Click to hide HUD"}
        >
            {!collapsed ? (
                <>
                    <div className="camera-stats__group">
                        <span className="camera-stats__label">LAT</span>
                        <span className="camera-stats__value">{formatCoord(cameraLat)}</span>
                    </div>
                    <div className="camera-stats__group">
                        <span className="camera-stats__label">LON</span>
                        <span className="camera-stats__value">{formatCoord(cameraLon)}</span>
                    </div>
                    <div className="camera-stats__group">
                        <span className="camera-stats__label">ALT</span>
                        <span className="camera-stats__value">{formatAlt(cameraAlt)}</span>
                    </div>
                    <div className="camera-stats__divider" />
                    <div className="camera-stats__group">
                        <span className="camera-stats__label">HDG</span>
                        <span className="camera-stats__value">{formatDeg(cameraHeading)}</span>
                    </div>
                    <div className="camera-stats__group">
                        <span className="camera-stats__label">PTC</span>
                        <span className="camera-stats__value">{formatDeg(cameraPitch)}</span>
                    </div>
                    <div className="camera-stats__group">
                        <span className="camera-stats__label">ROL</span>
                        <span className="camera-stats__value">{formatDeg(cameraRoll)}</span>
                    </div>
                    <div className="camera-stats__divider" />
                    <div className="camera-stats__group">
                        <span className="camera-stats__label">FPS</span>
                        <span className="camera-stats__value">{fps}</span>
                    </div>
                </>
            ) : (
                <div className="camera-stats__collapsed-label">
                    <span>HUD</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            )}
        </div>
    );
}
