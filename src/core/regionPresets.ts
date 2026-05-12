import type { Region } from "./region";

export interface RegionPreset {
    label: string;
    camera: {
        lat: number;
        lon: number;
        alt: number;
        heading: number;
        pitch: number;
    };
    /** WGS-84 bounding box for filtering feeds to this region. */
    bbox: {
        west: number;
        south: number;
        east: number;
        north: number;
    };
    /** NWS state code for weather alerts. */
    nwsArea?: string;
    /** Cesium camera preset id registered in CameraController. */
    cameraPresetId: string;
}

export const REGION_PRESETS: Record<Region, RegionPreset> = {
    global: {
        label: "Global",
        camera: { lat: 20, lon: 0, alt: 20_000_000, heading: 0, pitch: -90 },
        bbox: { west: -180, south: -90, east: 180, north: 90 },
        cameraPresetId: "global",
    },
    texas: {
        label: "Texas",
        camera: { lat: 20.834976, lon: -99.255400, alt: 2_092_730, heading: 0, pitch: -60 },
        bbox: { west: -106.65, south: 25.84, east: -93.51, north: 36.50 },
        nwsArea: "TX",
        cameraPresetId: "texas",
    },
    austin: {
        label: "Austin, TX",
        camera: { lat: 30.27, lon: -97.74, alt: 80_000, heading: 0, pitch: -60 },
        bbox: { west: -97.98, south: 30.10, east: -97.50, north: 30.52 },
        nwsArea: "TX",
        cameraPresetId: "austin",
    },
};

export function getRegionPreset(r: Region): RegionPreset {
    return REGION_PRESETS[r];
}
