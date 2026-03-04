import { create } from "zustand";
import type {
    GeoEntity,
    TimeRange,
    TimeWindow,
} from "@/core/plugins/PluginTypes";

// ─── Data Configuration ──────────────────────────────────────
export interface DataConfig {
    pollingIntervals: Record<string, number>; // pluginId -> ms
    cacheEnabled: boolean;
    cacheMaxAge: number; // ms
    maxConcurrentRequests: number;
    retryAttempts: number;
    // Placeholder for future development
    experimentalFeatures: {
        predictiveLoading: boolean;
        realtimeStreaming: boolean;
        clusteringEnabled: boolean;
        showTimelineHighlight: boolean;
    };
}

// ─── Globe Slice ─────────────────────────────────────────────
interface GlobeSlice {
    cameraLat: number;
    cameraLon: number;
    cameraAlt: number;
    cameraHeading: number;
    cameraPitch: number;
    isAnimating: boolean;
    setCameraPosition: (
        lat: number,
        lon: number,
        alt: number,
        heading?: number,
        pitch?: number
    ) => void;
    setAnimating: (val: boolean) => void;
}

// ─── Layers Slice ────────────────────────────────────────────
interface LayerState {
    enabled: boolean;
    entityCount: number;
}

interface LayersSlice {
    layers: Record<string, LayerState>;
    toggleLayer: (pluginId: string) => void;
    setLayerEnabled: (pluginId: string, enabled: boolean) => void;
    setEntityCount: (pluginId: string, count: number) => void;
    initLayer: (pluginId: string) => void;
}

// ─── Timeline Slice ──────────────────────────────────────────
interface TimelineSlice {
    currentTime: Date;
    timeWindow: TimeWindow;
    timeRange: TimeRange;
    isPlaying: boolean;
    playbackSpeed: number;
    isPlaybackMode: boolean;
    playbackTime: number; // ms timestamp
    timelineAvailability: { start: number; end: number }[];
    setCurrentTime: (time: Date) => void;
    setTimeWindow: (window: TimeWindow) => void;
    setTimeRange: (range: TimeRange) => void;
    setPlaying: (playing: boolean) => void;
    setPlaybackSpeed: (speed: number) => void;
    setPlaybackMode: (mode: boolean) => void;
    setPlaybackTime: (time: number) => void;
    setTimelineAvailability: (availability: { start: number; end: number }[]) => void;
}

// ─── UI Slice ────────────────────────────────────────────────
interface UISlice {
    leftSidebarOpen: boolean;
    rightSidebarOpen: boolean;
    configPanelOpen: boolean;
    selectedEntity: GeoEntity | null;
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;
    toggleConfigPanel: () => void;
    setSelectedEntity: (entity: GeoEntity | null) => void;
}

// ─── Data Slice ──────────────────────────────────────────────
interface DataSlice {
    entitiesByPlugin: Record<string, GeoEntity[]>;
    setEntities: (pluginId: string, entities: GeoEntity[]) => void;
    clearEntities: (pluginId: string) => void;
    getAllEntities: () => GeoEntity[];
}

// ─── Config Slice ────────────────────────────────────────────
interface MapConfig {
    showLabels: boolean;
}

interface ConfigSlice {
    dataConfig: DataConfig;
    mapConfig: MapConfig;
    updateDataConfig: (config: Partial<DataConfig>) => void;
    updateMapConfig: (config: Partial<MapConfig>) => void;
    setPollingInterval: (pluginId: string, intervalMs: number) => void;
}

// ─── Combined Store ──────────────────────────────────────────
type AppStore = GlobeSlice & LayersSlice & TimelineSlice & UISlice & DataSlice & ConfigSlice;

function getTimeRange(window: TimeWindow): TimeRange {
    const now = new Date();
    const msMap: Record<TimeWindow, number> = {
        "1h": 3600000,
        "6h": 21600000,
        "24h": 86400000,
        "48h": 172800000,
        "7d": 604800000,
    };
    return {
        start: new Date(now.getTime() - msMap[window]),
        end: now,
    };
}

export const useStore = create<AppStore>((set, get) => ({
    // ── Globe ────────────────────────────────────────────────
    cameraLat: 20,
    cameraLon: 0,
    cameraAlt: 20000000,
    cameraHeading: 0,
    cameraPitch: -90,
    isAnimating: false,
    setCameraPosition: (lat, lon, alt, heading = 0, pitch = -90) =>
        set({ cameraLat: lat, cameraLon: lon, cameraAlt: alt, cameraHeading: heading, cameraPitch: pitch }),
    setAnimating: (val) => set({ isAnimating: val }),

    // ── Layers ───────────────────────────────────────────────
    layers: {},
    toggleLayer: (pluginId) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: {
                    ...state.layers[pluginId],
                    enabled: !state.layers[pluginId]?.enabled,
                },
            },
        })),
    setLayerEnabled: (pluginId, enabled) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: { ...state.layers[pluginId], enabled },
            },
        })),
    setEntityCount: (pluginId, count) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: { ...state.layers[pluginId], entityCount: count },
            },
        })),
    initLayer: (pluginId) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: state.layers[pluginId] || { enabled: false, entityCount: 0 },
            },
        })),

    // ── Timeline ─────────────────────────────────────────────
    currentTime: new Date(),
    timeWindow: "24h" as TimeWindow,
    timeRange: getTimeRange("24h"),
    isPlaying: false,
    playbackSpeed: 1,
    isPlaybackMode: false,
    playbackTime: Date.now(),
    timelineAvailability: [],
    setCurrentTime: (time) => set({ currentTime: time }),
    setTimeWindow: (window) =>
        set({ timeWindow: window, timeRange: getTimeRange(window) }),
    setTimeRange: (range) => set({ timeRange: range }),
    setPlaying: (playing) => set({ isPlaying: playing }),
    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
    setPlaybackMode: (mode) => set({ isPlaybackMode: mode }),
    setPlaybackTime: (time) => set({ playbackTime: time }),
    setTimelineAvailability: (availability) => set({ timelineAvailability: availability }),

    // ── UI ───────────────────────────────────────────────────
    leftSidebarOpen: true,
    rightSidebarOpen: false,
    configPanelOpen: false,
    selectedEntity: null,
    toggleLeftSidebar: () =>
        set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
    toggleRightSidebar: () =>
        set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
    toggleConfigPanel: () =>
        set((state) => ({ configPanelOpen: !state.configPanelOpen })),
    setSelectedEntity: (entity) =>
        set({ selectedEntity: entity, rightSidebarOpen: entity !== null }),

    // ── Data ─────────────────────────────────────────────────
    entitiesByPlugin: {},
    setEntities: (pluginId, entities) =>
        set((state) => ({
            entitiesByPlugin: { ...state.entitiesByPlugin, [pluginId]: entities },
        })),
    clearEntities: (pluginId) =>
        set((state) => {
            const copy = { ...state.entitiesByPlugin };
            delete copy[pluginId];
            return { entitiesByPlugin: copy };
        }),
    getAllEntities: () => {
        const state = get();
        return Object.values(state.entitiesByPlugin).flat();
    },

    // ── Config ───────────────────────────────────────────────
    dataConfig: {
        pollingIntervals: {
            aviation: 5000,
            maritime: 60000,
            wildfire: 300000,
        },
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
        showLabels: false,
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
}));
