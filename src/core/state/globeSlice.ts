/**
 * @file globeSlice.ts
 * @description State slice managing the 3D camera position, orientation, and globe-level rendering metrics.
 */

import type { StateCreator } from "zustand";
import type { AppStore } from "./store";

// ─── Globe Slice ─────────────────────────────────────────────
/**
 * Zustand state slice for the 3D globe camera and viewport state.
 */
export interface GlobeSlice {
    /** Current camera latitude in degrees. */
    cameraLat: number;
    /** Current camera longitude in degrees. */
    cameraLon: number;
    /** Current camera altitude in meters above the ellipsoid. */
    cameraAlt: number;
    /** Current camera heading (yaw) in degrees. */
    cameraHeading: number;
    /** Current camera pitch in degrees. */
    cameraPitch: number;
    /** Current camera roll in degrees. */
    cameraRoll: number;
    /** Whether a programmatic camera transition (flyTo) is currently active. */
    isAnimating: boolean;
    /** Current rendering performance in frames per second. */
    fps: number;
    /** Updates the full camera transform (position and orientation). */
    setCameraPosition: (
        lat: number,
        lon: number,
        alt: number,
        heading?: number,
        pitch?: number,
        roll?: number
    ) => void;
    /** Sets the current animation state of the camera. */
    setAnimating: (val: boolean) => void;
    /** Updates the current FPS metric. */
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
