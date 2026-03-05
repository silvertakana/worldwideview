import type { StateCreator } from "zustand";
import type { AppStore } from "./store";

// ─── Globe Slice ─────────────────────────────────────────────
export interface GlobeSlice {
    cameraLat: number;
    cameraLon: number;
    cameraAlt: number;
    cameraHeading: number;
    cameraPitch: number;
    isAnimating: boolean;
    setCameraPosition: (
        lat: number,
        lon: number,
        alt: number,
        heading?: number,
        pitch?: number
    ) => void;
    setAnimating: (val: boolean) => void;
}

export const createGlobeSlice: StateCreator<AppStore, [], [], GlobeSlice> = (set) => ({
    cameraLat: 20,
    cameraLon: 0,
    cameraAlt: 20000000,
    cameraHeading: 0,
    cameraPitch: -90,
    isAnimating: false,
    setCameraPosition: (lat, lon, alt, heading = 0, pitch = -90) =>
        set({ cameraLat: lat, cameraLon: lon, cameraAlt: alt, cameraHeading: heading, cameraPitch: pitch }),
    setAnimating: (val) => set({ isAnimating: val }),
});
