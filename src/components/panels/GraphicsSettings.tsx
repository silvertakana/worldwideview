/**
 * @file GraphicsSettings.tsx
 * @module Panels/Settings
 * @description UI panel for managing CesiumJS engine performance and visual quality settings,
 * including resolution scaling, anti-aliasing, and lighting toggles.
 * @version 1.0.0
 */

"use client";

import React, { useEffect } from "react";
import { useStore } from "@/core/state/store";
import { trackEvent } from "@/lib/analytics";
import { WEATHER_LAYERS } from "@/lib/weatherLayers";
import "./graphics-settings.css";

/**
 * @constant DEFAULT_GRAPHICS
 * @description Fallback values for the graphics configuration.
 */
const DEFAULT_GRAPHICS = {
    resolutionScale: 1.0,
    antiAliasing: "fxaa" as const,
    maxScreenSpaceError: 16,
    shadowsEnabled: false,
    enableLighting: false,
    showFps: false,
    showOsmBuildings: true,
    weatherOverlay: null as string | null,
};

const WEATHER_LABEL: Record<string, string> = {
    clouds_new: "Clouds",
    precipitation_new: "Precipitation",
    temp_new: "Temperature",
    wind_new: "Wind Speed",
    pressure_new: "Pressure",
};

const RESOLUTION_OPTIONS = [
    { label: "0.5×", value: 0.5 },
    { label: "0.75×", value: 0.75 },
    { label: "1× (Native)", value: 1.0 },
    { label: "1.25×", value: 1.25 },
    { label: "1.5×", value: 1.5 },
    { label: "2× (Super)", value: 2.0 },
];

const AA_OPTIONS = [
    { label: "None (Fastest)", value: "none" },
    { label: "FXAA (Fast)", value: "fxaa" },
    { label: "MSAA 2× (Balanced)", value: "msaa2x" },
    { label: "MSAA 4× (Quality)", value: "msaa4x" },
    { label: "MSAA 8× (Ultra)", value: "msaa8x" },
];

/**
 * @component GraphicsSettings
 * @description Provides a granular interface for adjusting 3D engine performance.
 * Persists settings to browser cookies for session stability.
 */
export function GraphicsSettings() {
    const mapConfig = useStore((s) => s.mapConfig);
    const update = useStore((s) => s.updateMapConfig);

    // Save to cookie on change
     
    useEffect(() => {
        const { resolutionScale, antiAliasing, maxScreenSpaceError, shadowsEnabled, enableLighting, showFps, showOsmBuildings, weatherOverlay } = mapConfig;
        const graphicsToSave = { resolutionScale, antiAliasing, maxScreenSpaceError, shadowsEnabled, enableLighting, showFps, showOsmBuildings, weatherOverlay };
        document.cookie = `wwv_graphics=${encodeURIComponent(JSON.stringify(graphicsToSave))}; path=/; max-age=31536000`; // 1 year
    }, [mapConfig.resolutionScale, mapConfig.antiAliasing, mapConfig.maxScreenSpaceError, mapConfig.shadowsEnabled, mapConfig.enableLighting, mapConfig.showFps, mapConfig.showOsmBuildings, mapConfig.weatherOverlay]);

    const toggle = (key: string, current: boolean) => {
        update({ [key]: !current });
        trackEvent("graphics-setting", { key, value: !current });
    };

    return (
      <div className="gfx-settings">
        {/* Resolution Scale */}
        <div className="gfx-settings__row">
          <span className="gfx-settings__label">Resolution</span>
          <select
            className="gfx-settings__select"
            value={mapConfig.resolutionScale}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              update({ resolutionScale: v });
              trackEvent("graphics-setting", { key: "resolutionScale", value: v });
            }}
          >
            {RESOLUTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Anti-Aliasing Algorithm */}
        <div className="gfx-settings__row">
          <span className="gfx-settings__label">Anti-Aliasing</span>
          <select
            className="gfx-settings__select"
            value={mapConfig.antiAliasing}
            onChange={(e) => {
              const v = e.target.value as "none" | "fxaa" | "msaa2x" | "msaa4x" | "msaa8x";
              update({ antiAliasing: v });
              trackEvent("graphics-setting", { key: "antiAliasing", value: v });
            }}
          >
            {AA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Tile Detail (LOD) */}
        <div className="gfx-settings__row">
          <span className="gfx-settings__label">Tile Detail</span>
          <div className="gfx-settings__slider-wrap">
            <input
              type="range"
              className="gfx-settings__slider"
              min={1}
              max={64}
              step={1}
              value={mapConfig.maxScreenSpaceError}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                update({ maxScreenSpaceError: v });
              }}
              onPointerUp={() => trackEvent("graphics-setting", {
                key: "maxScreenSpaceError",
                value: mapConfig.maxScreenSpaceError,
              })}
            />
            <span className="gfx-settings__slider-value">{mapConfig.maxScreenSpaceError}</span>
          </div>
        </div>

        {/* Shadows */}
        <div className="gfx-settings__row">
          <span className="gfx-settings__label">Shadows</span>
          <button
            className={`gfx-toggle ${mapConfig.shadowsEnabled ? "gfx-toggle--on" : ""}`}
            onClick={() => toggle("shadowsEnabled", mapConfig.shadowsEnabled)}
            aria-label="Toggle Shadows"
          />
        </div>

        {/* Lighting */}
        <div className="gfx-settings__row">
          <span className="gfx-settings__label">Globe Lighting</span>
          <button
            className={`gfx-toggle ${mapConfig.enableLighting ? "gfx-toggle--on" : ""}`}
            onClick={() => toggle("enableLighting", mapConfig.enableLighting)}
            aria-label="Toggle Globe Lighting"
          />
        </div>

        {/* 3D Buildings */}
        <div className="gfx-settings__row">
          <span className="gfx-settings__label">3D Buildings</span>
          <button
            className={`gfx-toggle ${mapConfig.showOsmBuildings ? "gfx-toggle--on" : ""}`}
            onClick={() => toggle("showOsmBuildings", mapConfig.showOsmBuildings)}
            aria-label="Toggle 3D Buildings"
          />
        </div>

        {/* Weather Overlay */}
        <div className="gfx-settings__row">
          <span className="gfx-settings__label">Weather</span>
          <select
            className="gfx-settings__select"
            value={mapConfig.weatherOverlay || ""}
            onChange={(e) => {
              const v = e.target.value || null;
              update({ weatherOverlay: v });
              trackEvent("graphics-setting", { key: "weatherOverlay", value: v || "off" });
            }}
          >
            <option value="">Off</option>
            {WEATHER_LAYERS.map((id) => (
              <option key={id} value={id}>{WEATHER_LABEL[id] ?? id}</option>
            ))}
          </select>
        </div>

        {/* Show FPS */}
        <div className="gfx-settings__row">
          <span className="gfx-settings__label">Show FPS</span>
          <button
            className={`gfx-toggle ${mapConfig.showFps ? "gfx-toggle--on" : ""}`}
            onClick={() => toggle("showFps", mapConfig.showFps)}
            aria-label="Toggle FPS Counter"
          />
        </div>
        {/* Reset Defaults */}
        <div className="gfx-settings__row" style={{ marginTop: "var(--space-md)" }}>
          <button
            className="btn"
            style={{ width: "100%", height: 32 }}
            onClick={() => {
              update({ ...DEFAULT_GRAPHICS });
              trackEvent("graphics-setting-reset");
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    );
}
