"use client";

import React from "react";
import { useStore } from "@/core/state/store";
import { IMAGERY_LAYERS } from "@/core/globe/ImageryProviderFactory";
import { Globe, Grid2X2, Layout, Layers } from "lucide-react";

export function ImageryPicker() {
    const baseLayerId = useStore((s) => s.mapConfig.baseLayerId);
    const sceneMode = useStore((s) => s.mapConfig.sceneMode);
    const updateMapConfig = useStore((s) => s.updateMapConfig);

    return (
        <div className="imagery-picker glass-panel">
            <div className="imagery-picker__section">
                <div className="imagery-picker__title">View Mode</div>
                <div className="imagery-picker__modes">
                    <button
                        className={`mode-btn ${sceneMode === 3 ? "mode-btn--active" : ""}`}
                        onClick={() => updateMapConfig({ sceneMode: 3 })}
                        title="3D Globe"
                    >
                        <Globe size={18} />
                    </button>
                    <button
                        className={`mode-btn ${sceneMode === 1 ? "mode-btn--active" : ""}`}
                        onClick={() => updateMapConfig({ sceneMode: 1 })}
                        title="Columbus View (2.5D)"
                    >
                        <Grid2X2 size={18} />
                    </button>
                    <button
                        className={`mode-btn ${sceneMode === 2 ? "mode-btn--active" : ""}`}
                        onClick={() => updateMapConfig({ sceneMode: 2 })}
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
                    {IMAGERY_LAYERS.map((layer) => (
                        <div
                            key={layer.id}
                            className={`imagery-item ${baseLayerId === layer.id ? "imagery-item--active" : ""}`}
                            onClick={() => updateMapConfig({ baseLayerId: layer.id })}
                        >
                            <div className="imagery-item__thumbnail">
                                <Layers size={20} className="imagery-item__icon" />
                            </div>
                            <div className="imagery-item__name">{layer.name}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
