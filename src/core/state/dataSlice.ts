/**
 * @file dataSlice.ts
 * @description State slice managing the core geospatial entities retrieved from all active plugins.
 */

import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { GeoEntity } from "@/core/plugins/PluginTypes";

// ─── Data Slice ──────────────────────────────────────────────
/**
 * Zustand state slice for storing and retrieving geospatial entity data.
 */
export interface DataSlice {
    /** Map of plugin IDs to their currently loaded arrays of GeoEntities. */
    entitiesByPlugin: Record<string, GeoEntity[]>;
    /** Updates the entity list for a specific plugin and refreshes selection if needed. */
    setEntities: (pluginId: string, entities: GeoEntity[]) => void;
    /** Removes all entities associated with a specific plugin from memory. */
    clearEntities: (pluginId: string) => void;
    /** Retrieves a flattened array of all visible entities from all active plugins. */
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
