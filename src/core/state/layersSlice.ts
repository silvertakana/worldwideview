import type { StateCreator } from "zustand";
import type { AppStore } from "./store";

// ─── Layers Slice ────────────────────────────────────────────
export interface LayerState {
    enabled: boolean;
    entityCount: number;
    loading: boolean;
}

export interface LayersSlice {
    layers: Record<string, LayerState>;
    toggleLayer: (pluginId: string) => void;
    setLayerEnabled: (pluginId: string, enabled: boolean) => void;
    setEntityCount: (pluginId: string, count: number) => void;
    setLayerLoading: (pluginId: string, loading: boolean) => void;
    initLayer: (pluginId: string, defaultEnabled?: boolean) => void;
}

export const createLayersSlice: StateCreator<AppStore, [], [], LayersSlice> = (set) => ({
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
    setLayerLoading: (pluginId, loading) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: { ...state.layers[pluginId], loading },
            },
        })),
    initLayer: (pluginId, defaultEnabled = false) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: state.layers[pluginId] || { enabled: defaultEnabled, entityCount: 0, loading: false },
            },
        })),
});
