/**
 * @file configSlice.ts
 * @description State slice managing application-wide settings, data engine configuration,
 * and map rendering parameters.
 */

import type { StateCreator } from "zustand";
import type { AppStore } from "./store";

// ─── Data Configuration ──────────────────────────────────────
/**
 * Configuration settings related to data fetching, caching, and tiers.
 */
export interface DataConfig {
    /** Map of plugin IDs to their custom polling intervals (ms). */
    pollingIntervals: Record<string, number>;
    /** Whether local caching of plugin data is enabled. */
    cacheEnabled: boolean;
    /** Maximum age of cached data in milliseconds. */
    cacheMaxAge: number;
    /** Number of simultaneous fetch requests allowed. */
    maxConcurrentRequests: number;
    /** Number of times to retry failed requests. */
    retryAttempts: number;
    /** Feature flags for experimental system behaviors. */
    experimentalFeatures: {
        predictiveLoading: boolean;
        realtimeStreaming: boolean;
        clusteringEnabled: boolean;
        showTimelineHighlight: boolean;
    };
    /** Generic storage for plugin-specific settings. */
    pluginSettings: Record<string, Record<string, unknown>>;
    /** Cryptographic license key for paid tiers. */
    licenseKey: string | null;
    /** The active subscription tier of the user. */
    activeTier: "free" | "pro" | "team" | "enterprise";
}

export type AntiAliasingMode = "none" | "fxaa" | "msaa2x" | "msaa4x" | "msaa8x";

/**
 * Settings related to the 3D globe rendering and visual fidelity.
 */
export interface MapConfig {
    /** Show the FPS counter in the HUD. */
    showFps: boolean;
    /** Scaling factor for screen resolution (0.1 to 2.0). */
    resolutionScale: number;
    /** Selected anti-aliasing algorithm. */
    antiAliasing: AntiAliasingMode;
    /** Threshold for detail level in 3D tiles (higher = faster, lower = prettier). */
    maxScreenSpaceError: number;
    /** Whether dynamic shadows are enabled. */
    shadowsEnabled: boolean;
    /** Whether lighting from the sun/moon is enabled. */
    enableLighting: boolean;
    /** ID of the active base map layer. */
    baseLayerId: string;
    /** Optional fallback layer if base layer fails to load. */
    fallbackLayerId: string | null;
    /** The active scene mode (2D, 2.5D, or 3D). */
    sceneMode: 1 | 2 | 3;
    /** Whether OSM 3D Buildings are shown on non-Google imagery layers. */
    showOsmBuildings: boolean;
    /** Active weather overlay layer ID, or null if disabled. */
    weatherOverlay: string | null;
}

/**
 * Zustand state slice for application configuration.
 */
export interface ConfigSlice {
    /** Active data and engine settings. */
    dataConfig: DataConfig;
    /** Active map rendering settings. */
    mapConfig: MapConfig;
    /** Updates one or more data configuration fields. */
    updateDataConfig: (config: Partial<DataConfig>) => void;
    /** Updates one or more map rendering fields and persists layer choice to localStorage. */
    updateMapConfig: (config: Partial<MapConfig>) => void;
    /** Overrides the default polling interval for a specific plugin. */
    setPollingInterval: (pluginId: string, intervalMs: number) => void;
    /** Updates internal settings stored for a specific plugin. */
    updatePluginSettings: (pluginId: string, settings: Record<string, unknown>) => void;
}

export const createConfigSlice: StateCreator<AppStore, [], [], ConfigSlice> = (set) => ({
    dataConfig: {
        pollingIntervals: {},
        cacheEnabled: true,
        cacheMaxAge: 3600000,
        maxConcurrentRequests: 5,
        retryAttempts: 3,
        experimentalFeatures: {
            predictiveLoading: false,
            realtimeStreaming: false,
            clusteringEnabled: true,
            showTimelineHighlight: true,
        },
        pluginSettings: {},
        licenseKey: null,
        activeTier: "free",
    },
    mapConfig: {
        showFps: false,
        resolutionScale: 1.0,
        antiAliasing: "fxaa", // Default to fast FXAA
        maxScreenSpaceError: 32, // Increase from 16 to 32 to significantly reduce 3D tile network requests and costs
        shadowsEnabled: false,
        enableLighting: false,
        baseLayerId: (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") ? (localStorage.getItem("wwv_map_layer") || "google-3d") : "google-3d",
        fallbackLayerId: null,
        sceneMode: 3,
        showOsmBuildings: true,
        weatherOverlay: null,
    },
    updateDataConfig: (config) => set((state) => ({
            dataConfig: { ...state.dataConfig, ...config },
        })),
    updateMapConfig: (config) => set((state) => {
            if (config.baseLayerId && typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
                localStorage.setItem("wwv_map_layer", config.baseLayerId);
            }
            return { mapConfig: { ...state.mapConfig, ...config } };
        }),
    setPollingInterval: (pluginId, intervalMs) => set((state) => ({
            dataConfig: {
                ...state.dataConfig,
                pollingIntervals: {
                    ...state.dataConfig.pollingIntervals,
                    [pluginId]: intervalMs,
                },
            },
        })),
    updatePluginSettings: (pluginId, settings) => set((state) => ({
            dataConfig: {
                ...state.dataConfig,
                pluginSettings: {
                    ...state.dataConfig.pluginSettings,
                    [pluginId]: {
                        ...state.dataConfig.pluginSettings[pluginId],
                        ...settings,
                    },
                },
            },
        })),
});
