import type { GeoEntity } from "@/core/plugins/PluginTypes";
import type { LayerState } from "@/core/state/layersSlice";

export interface GlobeViewport {
    lat: number;
    lon: number;
    altitude: number;
    heading: number;
    pitch: number;
    roll: number;
}

export interface GlobeStateSnapshot {
    viewport: GlobeViewport;
    layers: Record<string, LayerState>;
    timeline: {
        currentTime: string;
        timeWindow: string;
        isPlaybackMode: boolean;
        playbackTime: number;
        playbackSpeed: number;
    };
    selectedEntity: string | null;
    lastUpdate: number;
}

export interface AppStoreSnapshotInput {
    cameraLat: number;
    cameraLon: number;
    cameraAlt: number;
    cameraHeading: number;
    cameraPitch: number;
    cameraRoll: number;
    layers: Record<string, LayerState>;
    currentTime: Date;
    timeWindow: string;
    isPlaybackMode: boolean;
    playbackTime: number;
    playbackSpeed: number;
    selectedEntity: GeoEntity | null;
}

export function buildGlobeSnapshot(state: AppStoreSnapshotInput): GlobeStateSnapshot {
    return {
        viewport: {
            lat: state.cameraLat,
            lon: state.cameraLon,
            altitude: state.cameraAlt,
            heading: state.cameraHeading,
            pitch: state.cameraPitch,
            roll: state.cameraRoll,
        },
        layers: state.layers,
        timeline: {
            currentTime: state.currentTime.toISOString(),
            timeWindow: state.timeWindow,
            isPlaybackMode: state.isPlaybackMode,
            playbackTime: state.playbackTime,
            playbackSpeed: state.playbackSpeed,
        },
        selectedEntity: state.selectedEntity
            ? `${state.selectedEntity.pluginId}:${state.selectedEntity.id}`
            : null,
        lastUpdate: Date.now(),
    };
}
