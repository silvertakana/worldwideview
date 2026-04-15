import { create } from "zustand";
import { Rectangle } from "cesium";

interface OsmPluginState {
    bboxLocked: boolean;
    currentBbox: Rectangle | null;
    lockedBbox: Rectangle | null;
    setBboxLocked: (locked: boolean) => void;
    setCurrentBbox: (rect: Rectangle | null) => void;
    setLockedBbox: (rect: Rectangle | null) => void;
}

export const useOsmStore = create<OsmPluginState>((set) => ({
    bboxLocked: false,
    currentBbox: null,
    lockedBbox: null,
    setBboxLocked: (locked) => set({ bboxLocked: locked }),
    setCurrentBbox: (rect) => set({ currentBbox: rect }),
    setLockedBbox: (rect) => set({ lockedBbox: rect }),
}));
