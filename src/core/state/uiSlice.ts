import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { GeoEntity } from "@/core/plugins/PluginTypes";

// ─── UI Slice ────────────────────────────────────────────────
export interface FloatingStream {
    id: string;
    streamUrl: string;
    isIframe: boolean;
    label: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    isMinimized?: boolean;
}

export interface UISlice {
    leftSidebarOpen: boolean;
    rightSidebarOpen: boolean;
    configPanelOpen: boolean;
    filterPanelOpen: boolean;
    selectedEntity: GeoEntity | null;
    hoveredEntity: GeoEntity | null;
    hoveredScreenPosition: { x: number; y: number } | null;
    lockedEntityId: string | null;
    floatingStreams: FloatingStream[];
    activeConfigTab: "intel" | "filters" | "cache" | "overlay" | "apikeys";
    highlightLayerId: string | null;
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;
    toggleConfigPanel: () => void;
    toggleFilterPanel: () => void;
    setSelectedEntity: (entity: GeoEntity | null) => void;
    setHoveredEntity: (entity: GeoEntity | null, screenPos?: { x: number; y: number } | null) => void;
    setLockedEntityId: (id: string | null) => void;
    addFloatingStream: (stream: Omit<FloatingStream, "position" | "size">) => void;
    removeFloatingStream: (id: string) => void;
    updateFloatingStream: (id: string, updates: Partial<FloatingStream>) => void;
    setActiveConfigTab: (tab: "intel" | "filters" | "cache" | "overlay" | "apikeys") => void;
    setHighlightLayerId: (id: string | null) => void;
    setConfigPanelOpen: (open: boolean) => void;
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
    leftSidebarOpen: true,
    rightSidebarOpen: false,
    configPanelOpen: false,
    filterPanelOpen: false,
    selectedEntity: null,
    hoveredEntity: null,
    hoveredScreenPosition: null,
    lockedEntityId: null,
    floatingStreams: [],
    activeConfigTab: "filters",
    highlightLayerId: null,
    toggleLeftSidebar: () =>
        set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
    toggleRightSidebar: () =>
        set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
    toggleConfigPanel: () =>
        set((state) => ({ configPanelOpen: !state.configPanelOpen })),
    toggleFilterPanel: () =>
        set((state) => ({ filterPanelOpen: !state.filterPanelOpen })),
    setSelectedEntity: (entity) =>
        set({
            selectedEntity: entity,
            rightSidebarOpen: entity !== null,
            configPanelOpen: entity !== null,
            activeConfigTab: entity !== null ? "intel" : "filters"
        }),
    setHoveredEntity: (entity, screenPos) =>
        set({ hoveredEntity: entity, hoveredScreenPosition: screenPos ?? null }),
    setLockedEntityId: (id) =>
        set({ lockedEntityId: id }),
    addFloatingStream: (stream) =>
        set((state) => {
            if (state.floatingStreams.find(s => s.id === stream.id)) return state;
            return {
                floatingStreams: [
                    ...state.floatingStreams,
                    {
                        ...stream,
                        position: { x: 100 + state.floatingStreams.length * 20, y: 100 + state.floatingStreams.length * 20 },
                        size: { width: 400, height: 260 }
                    }
                ]
            };
        }),
    removeFloatingStream: (id) =>
        set((state) => ({
            floatingStreams: state.floatingStreams.filter(s => s.id !== id)
        })),
    updateFloatingStream: (id, updates) =>
        set((state) => ({
            floatingStreams: state.floatingStreams.map(s => s.id === id ? { ...s, ...updates } : s)
        })),
    setActiveConfigTab: (tab) => set({ activeConfigTab: tab }),
    setHighlightLayerId: (id) => set({ highlightLayerId: id }),
    setConfigPanelOpen: (open) => set({ configPanelOpen: open }),
});

