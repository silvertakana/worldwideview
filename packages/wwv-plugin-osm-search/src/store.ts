import { create } from "zustand";
import { Rectangle } from "cesium";

interface OsmPluginState {
    bboxLocked: boolean;
    showBbox: boolean;
    currentBbox: Rectangle | null;
    lockedBbox: Rectangle | null;
    setBboxLocked: (locked: boolean) => void;
    setShowBbox: (show: boolean) => void;
    setCurrentBbox: (rect: Rectangle | null) => void;
    setLockedBbox: (rect: Rectangle | null) => void;
}

export const useOsmStore = create<OsmPluginState>((set) => ({
    bboxLocked: false,
    showBbox: true,
    currentBbox: null,
    lockedBbox: null,
    setBboxLocked: (locked) => set({ bboxLocked: locked }),
    setShowBbox: (show) => set({ showBbox: show }),
    setCurrentBbox: (rect) => set({ currentBbox: rect }),
    setLockedBbox: (rect) => set({ lockedBbox: rect }),
}));
