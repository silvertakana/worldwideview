/**
 * @file filterSlice.ts
 * @description State slice managing active data filters applied to different plugin layers.
 */

import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { FilterValue } from "@/core/plugins/PluginTypes";

// ─── Filter Slice ────────────────────────────────────────────
/**
 * Zustand state slice for managing layer-specific and global filters.
 */
export interface FilterSlice {
    /** Nested map of [pluginId][filterId] to the active FilterValue. */
    filters: Record<string, Record<string, FilterValue>>;
    /** Sets or updates a specific filter for a plugin. */
    setFilter: (pluginId: string, filterId: string, value: FilterValue) => void;
    /** Resets all filters associated with a specific plugin. */
    clearFilters: (pluginId: string) => void;
    /** Resets all filters for all plugins in the application. */
    clearAllFilters: () => void;
}

export const createFilterSlice: StateCreator<AppStore, [], [], FilterSlice> = (set) => ({
    filters: {},
    setFilter: (pluginId, filterId, value) =>
        set((state) => ({
            filters: {
                ...state.filters,
                [pluginId]: {
                    ...state.filters[pluginId],
                    [filterId]: value,
                },
            },
        })),
    clearFilters: (pluginId) =>
        set((state) => {
            const copy = { ...state.filters };
            delete copy[pluginId];
            return { filters: copy };
        }),
    clearAllFilters: () => set({ filters: {} }),
});
