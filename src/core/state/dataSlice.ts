import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { GeoEntity } from "@/core/plugins/PluginTypes";

// ─── Data Slice ──────────────────────────────────────────────
export interface DataSlice {
    entitiesByPlugin: Record<string, GeoEntity[]>;
    setEntities: (pluginId: string, entities: GeoEntity[]) => void;
    clearEntities: (pluginId: string) => void;
    getAllEntities: () => GeoEntity[];
}

export const createDataSlice: StateCreator<AppStore, [], [], DataSlice> = (set, get) => ({
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
});
