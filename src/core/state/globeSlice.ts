import type { StateCreator } from "zustand";
import type { AppStore } from "./store";

// ─── Globe Slice ─────────────────────────────────────────────
export interface GlobeSlice {
    cameraLat: number;
    cameraLon: number;
    cameraAlt: number;
    cameraHeading: number;
    cameraPitch: number;
    cameraRoll: number;
    isAnimating: boolean;
    fps: number;
    setCameraPosition: (
        lat: number,
        lon: number,
        alt: number,
        heading?: number,
        pitch?: number,
        roll?: number
    ) => void;
    setAnimating: (val: boolean) => void;
    setFps: (fps: number) => void;
}

export const createGlobeSlice: StateCreator<AppStore, [], [], GlobeSlice> = (set) => ({
    cameraLat: 20,
    cameraLon: 0,
    cameraAlt: 20000000,
    cameraHeading: 0,
    cameraPitch: -90,
    cameraRoll: 0,
    isAnimating: false,
    fps: 0,
    setCameraPosition: (lat, lon, alt, heading = 0, pitch = -90, roll = 0) =>
        set({ cameraLat: lat, cameraLon: lon, cameraAlt: alt, cameraHeading: heading, cameraPitch: pitch, cameraRoll: roll }),
    setAnimating: (val) => set({ isAnimating: val }),
    setFps: (fps) => set({ fps }),
});
