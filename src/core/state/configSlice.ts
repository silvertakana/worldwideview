import type { StateCreator } from "zustand";
import type { AppStore } from "./store";

// ─── Data Configuration ──────────────────────────────────────
export interface DataConfig {
    pollingIntervals: Record<string, number>;
    cacheEnabled: boolean;
    cacheMaxAge: number;
    maxConcurrentRequests: number;
    retryAttempts: number;
    experimentalFeatures: {
        predictiveLoading: boolean;
        realtimeStreaming: boolean;
        clusteringEnabled: boolean;
        showTimelineHighlight: boolean;
    };
    pluginSettings: Record<string, any>;
}

export type AntiAliasingMode = "none" | "fxaa" | "msaa2x" | "msaa4x" | "msaa8x";

export interface MapConfig {
    showFps: boolean;
    resolutionScale: number;
    antiAliasing: AntiAliasingMode;
    maxScreenSpaceError: number;
    shadowsEnabled: boolean;
    enableLighting: boolean;
    baseLayerId: string;
    fallbackLayerId: string | null;
    sceneMode: 1 | 2 | 3; // 1: Columbus View, 2: 2D, 3: 3D
}

export interface ConfigSlice {
    dataConfig: DataConfig;
    mapConfig: MapConfig;
    updateDataConfig: (config: Partial<DataConfig>) => void;
    updateMapConfig: (config: Partial<MapConfig>) => void;
    setPollingInterval: (pluginId: string, intervalMs: number) => void;
    updatePluginSettings: (pluginId: string, settings: any) => void;
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
    },
    mapConfig: {
        showFps: false,
        resolutionScale: 1.0,
        antiAliasing: "fxaa", // Default to fast FXAA
        maxScreenSpaceError: 32, // Increase from 16 to 32 to significantly reduce 3D tile network requests and costs
        shadowsEnabled: false,
        enableLighting: false,
        baseLayerId: typeof window !== "undefined" ? (localStorage.getItem("wwv_map_layer") || "google-3d") : "google-3d",
        fallbackLayerId: null,
        sceneMode: 3,
    },
    updateDataConfig: (config) =>
        set((state) => ({
            dataConfig: { ...state.dataConfig, ...config },
        })),
    updateMapConfig: (config) =>
        set((state) => {
            if (config.baseLayerId && typeof window !== "undefined") {
                localStorage.setItem("wwv_map_layer", config.baseLayerId);
            }
            return { mapConfig: { ...state.mapConfig, ...config } };
        }),
    setPollingInterval: (pluginId, intervalMs) =>
        set((state) => ({
            dataConfig: {
                ...state.dataConfig,
                pollingIntervals: {
                    ...state.dataConfig.pollingIntervals,
                    [pluginId]: intervalMs,
                },
            },
        })),
    updatePluginSettings: (pluginId, settings) =>
        set((state) => ({
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
