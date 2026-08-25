import {
    Cartesian3,
    EasingFunction,
    Math as CesiumMath,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { dataBus } from "@/core/data/DataBus";

// Camera presets
const CAMERA_PRESETS: Record<string, { lat: number; lon: number; alt: number; heading: number; pitch: number }> = {
    // global is the boot default view. pitch -90 (exact straight-down) makes Cesium's
    // zoom3D compute a zero-length rotation axis when the cursor is at the view center
    // (picked point == camera nadir) and the render loop dies with
    // "normalized result is not a number". A slight tilt keeps the axis well-defined.
    global: {
    lat: 20, lon: 0, alt: 20000000, heading: 0, pitch: -85
},
    americas: {
 lat: 15, lon: -80, alt: 12000000, heading: 0, pitch: -80
},
    europe: {
 lat: 50, lon: 15, alt: 6000000, heading: 0, pitch: -75
},
    mena: {
 lat: 28, lon: 42, alt: 6000000, heading: 0, pitch: -75
},
    asiaPacific: {
 lat: 30, lon: 105, alt: 10000000, heading: 0, pitch: -80
},
    africa: {
 lat: 2, lon: 22, alt: 8000000, heading: 0, pitch: -80
},
    oceania: {
 lat: -25, lon: 140, alt: 7000000, heading: 0, pitch: -75
},
    arctic: {
 lat: 80, lon: 0, alt: 6000000, heading: 0, pitch: -85
},
};

/**
 * Fly the camera to a named preset region.
 */
export function flyToPreset(viewer: CesiumViewer, presetId: string): void {
    if (!viewer || viewer.isDestroyed()) return;
    const preset = CAMERA_PRESETS[presetId];
    if (!preset) return;
    viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(preset.lon, preset.lat, preset.alt),
        orientation: {
            heading: CesiumMath.toRadians(preset.heading),
            pitch: CesiumMath.toRadians(preset.pitch),
            roll: 0,
        },
        duration: 3.0,
        easingFunction: EasingFunction.QUINTIC_IN_OUT,
    });
}

/**
 * Fly to a specific lat/lon/alt with smooth animation.
 */
export function flyToPosition(
    viewer: CesiumViewer,
    lat: number,
    lon: number,
    alt: number,
    heading = 0,
    pitch = -90,
    duration = 2.0
): void {
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(lon, lat, alt),
        orientation: {
            heading: CesiumMath.toRadians(heading),
            pitch: CesiumMath.toRadians(pitch),
            roll: 0,
        },
        duration,
        easingFunction: EasingFunction.QUINTIC_IN_OUT,
    });
}

/**
 * Subscribe to dataBus camera preset events and fly to them.
 * Returns an unsubscribe function.
 */
export function subscribeToCameraPresets(viewer: CesiumViewer): () => void {
    return dataBus.on("cameraPreset", ({ presetId }) => {
        if (!viewer || viewer.isDestroyed()) return;
        flyToPreset(viewer, presetId);
    });
}
