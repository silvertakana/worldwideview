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
}

export interface MapConfig {
    showFps: boolean;
    resolutionScale: number;
    msaaSamples: number;
    enableFxaa: boolean;
    maxScreenSpaceError: number;
    baseLayerId: string;
    sceneMode: 1 | 2 | 3; // 1: Columbus View, 2: 2D, 3: 3D
}

export interface ConfigSlice {
    dataConfig: DataConfig;
    mapConfig: MapConfig;
    updateDataConfig: (config: Partial<DataConfig>) => void;
    updateMapConfig: (config: Partial<MapConfig>) => void;
    setPollingInterval: (pluginId: string, intervalMs: number) => void;
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
    },
    mapConfig: {
        showFps: false,
        resolutionScale: 1.0,
        msaaSamples: 1,
        enableFxaa: false,
        maxScreenSpaceError: 16,
        baseLayerId: "google-3d",
        sceneMode: 3,
    },
    updateDataConfig: (config) =>
        set((state) => ({
            dataConfig: { ...state.dataConfig, ...config },
        })),
    updateMapConfig: (config) =>
        set((state) => ({
            mapConfig: { ...state.mapConfig, ...config },
        })),
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
});
