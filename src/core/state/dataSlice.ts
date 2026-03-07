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
        set((state) => {
            const updates: Partial<AppStore> = {
                entitiesByPlugin: { ...state.entitiesByPlugin, [pluginId]: entities },
            };
            // Keep selectedEntity fresh when new polling data arrives
            if (state.selectedEntity?.pluginId === pluginId) {
                const fresh = entities.find(e => e.id === state.selectedEntity!.id);
                if (fresh) updates.selectedEntity = fresh;
            }
            return updates;
        }),
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
