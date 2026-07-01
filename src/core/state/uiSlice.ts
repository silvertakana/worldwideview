/**
 * @file uiSlice.ts
 * @description State slice managing the application's user interface, including themes,
 * sidebars, panels, entity selection, and floating data streams.
 */

import type { StateCreator } from "zustand";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import type { AppStore } from "./store";

// ─── UI Slice ────────────────────────────────────────────────
/**
 * Represents a floating window container for external data streams (e.g., video feeds, telemetry iframes).
 */
export interface FloatingStream {
    /** Unique identifier for the stream window. */
    id: string;
    /** The source URL for the stream content. */
    streamUrl: string;
    /** Whether to render the content inside an iframe. */
    isIframe: boolean;
    /** Human-readable label for the window header. */
    label: string;
    /** Screen coordinates of the window's top-left corner. */
    position: { x: number; y: number };
    /** Dimensions of the floating window. */
    size: { width: number; height: number };
    /** Whether the window is currently collapsed to its header. */
    isMinimized?: boolean;
    /** Hint for content rendering optimization. */
    type?: "video" | "image";
}

/**
 * Zustand state slice for managing HUD visibility and UI interactions.
 */
export interface UISlice {
    /** The active visual theme. */
    theme: "dark" | "light" | "legacy" | "black" | "tactical";
    /** Visibility of the left navigation/plugin sidebar. */
    leftSidebarOpen: boolean;
    /** Visibility of the right details/intel sidebar. */
    rightSidebarOpen: boolean;
    /** Visibility of the main configuration/settings panel. */
    configPanelOpen: boolean;
    /** Visibility of the global filtering panel. */
    filterPanelOpen: boolean;
    /** The currently clicked/selected entity for details view. */
    selectedEntity: GeoEntity | null;
    /** The entity currently under the mouse cursor. */
    hoveredEntity: GeoEntity | null;
    /** Screen coordinates of the current hover target for tooltips. */
    hoveredScreenPosition: { x: number; y: number } | null;
    /** The ID of an entity the camera is currently following or focused on. */
    lockedEntityId: string | null;
    /** List of active floating stream windows. */
    floatingStreams: FloatingStream[];
    /** The active sub-tab within the configuration panel. */
    activeConfigTab: "intel" | "filters" | "cache" | "overlay" | "apikeys";
    /** The ID of a layer currently being highlighted/flashed in the UI. */
    highlightLayerId: string | null;
    /** Active panel in mobile view layout. */
    openMobilePanel: "left" | "right" | null;
    /** Whether to show a notification glow on the mobile right panel button. */
    mobileRightPanelGlow: boolean;
    /** Cycles through available UI themes. */
    toggleTheme: () => void;
    /** Directly sets a specific UI theme. */
    setTheme: (theme: "dark" | "light" | "legacy" | "black" | "tactical") => void;
    /** Toggles the left sidebar state. */
    toggleLeftSidebar: () => void;
    /** Toggles the right sidebar state. */
    toggleRightSidebar: () => void;
    /** Toggles the central config panel state. */
    toggleConfigPanel: () => void;
    /** Toggles the filter panel state. */
    toggleFilterPanel: () => void;
    /** Visibility of the user feedback submission dialog. */
    feedbackDialogOpen: boolean;
    /** Sets the feedback dialog visibility. */
    setFeedbackDialogOpen: (open: boolean) => void;
    /** Selects an entity and opens relevant panels for details display. */
    setSelectedEntity: (entity: GeoEntity | null) => void;
    /** Updates the currently hovered entity and its screen position. */
    setHoveredEntity: (entity: GeoEntity | null, screenPos?: { x: number; y: number } | null) => void;
    /** Sets the ID of the entity to lock the camera onto. */
    setLockedEntityId: (id: string | null) => void;
    /** Spawns a new floating stream window. */
    addFloatingStream: (stream: Omit<FloatingStream, "position" | "size">) => void;
    /** Closes a floating stream window by ID. */
    removeFloatingStream: (id: string) => void;
    /** Updates properties (position, size, state) of an existing stream window. */
    updateFloatingStream: (id: string, updates: Partial<FloatingStream>) => void;
    /** Switches between configuration tabs. */
    setActiveConfigTab: (tab: "intel" | "filters" | "cache" | "overlay" | "apikeys") => void;
    /** Triggers a visual highlight on a specific layer in the layer list. */
    setHighlightLayerId: (id: string | null) => void;
    /** Explicitly sets the configuration panel visibility. */
    setConfigPanelOpen: (open: boolean) => void;
    /** Controls which panel is visible in responsive/mobile layouts. */
    setOpenMobilePanel: (panel: "left" | "right" | null) => void;
    /** The current message displayed in the global error toast, if any. */
    errorToastMessage: string | null;
    /** Triggers a global error notification toast. */
    showErrorToast: (message: string) => void;
    /** Dismisses the active error toast. */
    clearErrorToast: () => void;
    /**
     * The ID of the currently active bottom panel, or null when the dock is shown without
     * an active panel. The built-in timeline uses the reserved ID "timeline".
     */
    activeBottomPanel: string | null;
    /** Opens a specific bottom panel by ID, or closes all panels if null is passed. */
    setActiveBottomPanel: (id: string | null) => void;
    /** Height of the bottom panel in pixels. Clamped between 200 and window height. */
    bottomPanelHeight: number;
    /** Sets the bottom panel height (used by the resize drag handle). */
    setBottomPanelHeight: (height: number) => void;
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
    theme: typeof window !== "undefined" ? ((localStorage.getItem("wwv-theme") as "dark" | "light" | "legacy" | "black" | "tactical") || "black") : "black",
    leftSidebarOpen: true,
    rightSidebarOpen: false,
    configPanelOpen: true,
    filterPanelOpen: false,
    selectedEntity: null,
    hoveredEntity: null,
    hoveredScreenPosition: null,
    lockedEntityId: null,
    floatingStreams: [],
    activeConfigTab: "filters",
    highlightLayerId: null,
    openMobilePanel: null,
    mobileRightPanelGlow: false,
    feedbackDialogOpen: false,
    activeBottomPanel: null,
    bottomPanelHeight: 220,
    toggleTheme: () => set((state) => {
        const nextTheme = {
            dark: "tactical",
            tactical: "black",
            black: "light",
            light: "legacy",
            legacy: "dark"
        }[state.theme] as "dark" | "light" | "legacy" | "black" | "tactical";

        try { localStorage.setItem("wwv-theme", nextTheme); } catch { /* ignored */ }
        document.documentElement.setAttribute('data-theme', nextTheme);
        return { theme: nextTheme };
    }),
    setTheme: (theme) => set(() => {
        try { localStorage.setItem("wwv-theme", theme); } catch { /* ignored */ }
        document.documentElement.setAttribute('data-theme', theme);
        return { theme };
    }),
    toggleLeftSidebar: () => set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
    toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
    toggleConfigPanel: () => set((state) => ({ configPanelOpen: !state.configPanelOpen })),
    toggleFilterPanel: () => set((state) => ({ filterPanelOpen: !state.filterPanelOpen })),
    setFeedbackDialogOpen: (open) => set({ feedbackDialogOpen: open }),
    setSelectedEntity: (entity) => {
        if (entity) {
            // Dynamic import to avoid circular dep (store → analytics → store)
            import("@/lib/analytics").then(({ trackEvent }) => {
                trackEvent("entity-select", { plugin: entity.pluginId, entityId: entity.id });
            });
        }
        set((state) => ({
            selectedEntity: entity,
            rightSidebarOpen: entity !== null ? true : state.rightSidebarOpen,
            configPanelOpen: entity !== null ? true : state.configPanelOpen,
            openMobilePanel: entity !== null ? state.openMobilePanel : null,
            mobileRightPanelGlow: entity !== null,
            activeConfigTab: entity !== null ? "intel" : state.activeConfigTab
        }));
    },
    setHoveredEntity: (entity, screenPos) => set({ hoveredEntity: entity, hoveredScreenPosition: screenPos ?? null }),
    setLockedEntityId: (id) => set({ lockedEntityId: id }),
    addFloatingStream: (stream) => set((state) => {
            if (state.floatingStreams.find((s) => s.id === stream.id)) return state;
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
    removeFloatingStream: (id) => set((state) => ({
            floatingStreams: state.floatingStreams.filter((s) => s.id !== id)
        })),
    updateFloatingStream: (id, updates) => set((state) => ({
            floatingStreams: state.floatingStreams.map((s) => (s.id === id ? { ...s, ...updates } : s))
        })),
    setActiveConfigTab: (tab) => set({ activeConfigTab: tab }),
    setHighlightLayerId: (id) => set({ highlightLayerId: id }),
    setConfigPanelOpen: (open) => set({ configPanelOpen: open }),
    setOpenMobilePanel: (panel) => set((state) => ({
            openMobilePanel: state.openMobilePanel === panel ? null : panel,
            mobileRightPanelGlow: panel === "right" ? false : state.mobileRightPanelGlow,
        })),
    errorToastMessage: null,
    showErrorToast: (message) => set({ errorToastMessage: message }),
    clearErrorToast: () => set({ errorToastMessage: null }),
    setActiveBottomPanel: (id) => set({ activeBottomPanel: id }),
    setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),
});
