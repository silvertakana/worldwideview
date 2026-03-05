import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { FilterValue } from "@/core/plugins/PluginTypes";

// ─── Filter Slice ────────────────────────────────────────────
export interface FilterSlice {
    filters: Record<string, Record<string, FilterValue>>;
    setFilter: (pluginId: string, filterId: string, value: FilterValue) => void;
    clearFilters: (pluginId: string) => void;
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
