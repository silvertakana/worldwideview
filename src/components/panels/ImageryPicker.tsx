"use client";

import React from "react";
import { useStore } from "@/core/state/store";
import { IMAGERY_LAYERS } from "@/core/globe/ImageryProviderFactory";
import { Globe, Grid2X2, Layout, Layers } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { GraphicsSettings } from "./GraphicsSettings";

export function ImageryPicker() {
    const baseLayerId = useStore((s) => s.mapConfig.baseLayerId);
    const fallbackLayerId = useStore((s) => s.mapConfig.fallbackLayerId);
    const sceneMode = useStore((s) => s.mapConfig.sceneMode);
    const updateMapConfig = useStore((s) => s.updateMapConfig);

    return (
        <div className="imagery-picker glass-panel">
            <div className="imagery-picker__section">
                <div className="imagery-picker__title">View Mode</div>
                <div className="imagery-picker__modes">
                    <button
                        className={`mode-btn ${sceneMode === 3 ? "mode-btn--active" : ""}`}
                        onClick={() => { updateMapConfig({ sceneMode: 3 }); trackEvent("view-mode-change", { mode: "3D" }); }}
                        title="3D Globe"
                    >
                        <Globe size={18} />
                    </button>
                    <button
                        className={`mode-btn ${sceneMode === 1 ? "mode-btn--active" : ""}`}
                        onClick={() => { updateMapConfig({ sceneMode: 1 }); trackEvent("view-mode-change", { mode: "columbus" }); }}
                        title="Columbus View (2.5D)"
                    >
                        <Grid2X2 size={18} />
                    </button>
                    <button
                        className={`mode-btn ${sceneMode === 2 ? "mode-btn--active" : ""}`}
                        onClick={() => { updateMapConfig({ sceneMode: 2 }); trackEvent("view-mode-change", { mode: "2D" }); }}
                        title="2D Map"
                    >
                        <Layout size={18} />
                    </button>
                </div>
            </div>

            <div className="imagery-picker__divider" />

            <div className="imagery-picker__section">
                <div className="imagery-picker__title">Imagery Layer</div>
                <div className="imagery-picker__grid">
                    {IMAGERY_LAYERS.map((layer) => {
                        const isSelected = baseLayerId === layer.id;
                        const isFallbackMode = fallbackLayerId !== null;
                        const isThisFallback = fallbackLayerId === layer.id;
                        const isFailedTarget = isFallbackMode && isSelected;
                        const isActive = isFallbackMode ? isThisFallback : isSelected;

                        let className = "imagery-item";
                        if (isFailedTarget) className += " imagery-item--failed";
                        else if (isThisFallback) className += " imagery-item--fallback";
                        else if (isActive) className += " imagery-item--active";

                        return (
                            <div
                                key={layer.id}
                                className={className}
                                onClick={() => { 
                                    updateMapConfig({ baseLayerId: layer.id, fallbackLayerId: null }); 
                                    trackEvent("imagery-layer-change", { layer: layer.id }); 
                                }}
                                title={isFailedTarget ? "Error: Missing API Key" : (isThisFallback ? "Active Fallback" : "")}
                            >
                                <div className="imagery-item__thumbnail">
                                    <Layers size={20} className="imagery-item__icon" />
                                </div>
                                <div className="imagery-item__name">{layer.name}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="imagery-picker__divider" />

            <div className="imagery-picker__section">
                <div className="imagery-picker__title">Graphics</div>
                <GraphicsSettings />
            </div>
        </div>
    );
}
