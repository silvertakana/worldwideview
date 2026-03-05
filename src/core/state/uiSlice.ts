import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { GeoEntity } from "@/core/plugins/PluginTypes";

// ─── UI Slice ────────────────────────────────────────────────
export interface UISlice {
    leftSidebarOpen: boolean;
    rightSidebarOpen: boolean;
    configPanelOpen: boolean;
    filterPanelOpen: boolean;
    selectedEntity: GeoEntity | null;
    hoveredEntity: GeoEntity | null;
    hoveredScreenPosition: { x: number; y: number } | null;
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;
    toggleConfigPanel: () => void;
    toggleFilterPanel: () => void;
    setSelectedEntity: (entity: GeoEntity | null) => void;
    setHoveredEntity: (entity: GeoEntity | null, screenPos?: { x: number; y: number } | null) => void;
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
    leftSidebarOpen: true,
    rightSidebarOpen: false,
    configPanelOpen: false,
    filterPanelOpen: false,
    selectedEntity: null,
    hoveredEntity: null,
    hoveredScreenPosition: null,
    toggleLeftSidebar: () =>
        set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
    toggleRightSidebar: () =>
        set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
    toggleConfigPanel: () =>
        set((state) => ({ configPanelOpen: !state.configPanelOpen })),
    toggleFilterPanel: () =>
        set((state) => ({ filterPanelOpen: !state.filterPanelOpen })),
    setSelectedEntity: (entity) =>
        set({ selectedEntity: entity, rightSidebarOpen: entity !== null }),
    setHoveredEntity: (entity, screenPos) =>
        set({ hoveredEntity: entity, hoveredScreenPosition: screenPos ?? null }),
});
