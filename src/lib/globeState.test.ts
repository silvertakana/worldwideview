import { describe, it, expect } from "vitest";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import type { LayerState } from "@/core/state/layersSlice";
import { buildGlobeSnapshot } from "./globeState";

// Flat store shape — mirrors the live Zustand store (no nested state.globe.* namespace).
// Only the fields buildGlobeSnapshot reads are included; the rest are omitted intentionally.
const makeFakeState = (overrides: Partial<{
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
}> = {}) => ({
    cameraLat: 37.7749,
    cameraLon: -122.4194,
    cameraAlt: 500000,
    cameraHeading: 45,
    cameraPitch: -60,
    cameraRoll: 0,
    layers: {
        aviation: { enabled: true, entityCount: 42, loading: false },
        maritime: { enabled: false, entityCount: 0, loading: true },
    },
    currentTime: new Date("2026-01-15T12:00:00.000Z"),
    timeWindow: "24h",
    isPlaybackMode: false,
    playbackTime: 1737000000000,
    playbackSpeed: 1,
    selectedEntity: null as GeoEntity | null,
    ...overrides,
});

// RSRC-01 — buildGlobeSnapshot maps the flat store into a stable serializable shape.

describe("buildGlobeSnapshot — viewport mapping (RSRC-01)", () => {
    it("maps cameraLat/Lon/Alt/Heading/Pitch/Roll into viewport object", () => {
        const state = makeFakeState();
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.viewport).toEqual({
            lat: 37.7749,
            lon: -122.4194,
            altitude: 500000,
            heading: 45,
            pitch: -60,
            roll: 0,
        });
    });

    it("preserves negative lat/lon values correctly", () => {
        const state = makeFakeState({ cameraLat: -33.8688, cameraLon: 151.2093, cameraAlt: 1000 });
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.viewport.lat).toBe(-33.8688);
        expect(snapshot.viewport.lon).toBe(151.2093);
        expect(snapshot.viewport.altitude).toBe(1000);
    });
});

describe("buildGlobeSnapshot — layers passthrough (RSRC-01)", () => {
    it("passes layers Record through unchanged", () => {
        const layers = {
            aviation: { enabled: true, entityCount: 42, loading: false },
            maritime: { enabled: false, entityCount: 0, loading: true },
        };
        const state = makeFakeState({ layers });
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.layers).toEqual(layers);
    });

    it("handles empty layers Record", () => {
        const state = makeFakeState({ layers: {} });
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.layers).toEqual({});
    });
});

describe("buildGlobeSnapshot — timeline serialization (RSRC-01)", () => {
    it("serializes currentTime as an ISO string", () => {
        const date = new Date("2026-01-15T12:00:00.000Z");
        const state = makeFakeState({ currentTime: date });
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.timeline.currentTime).toBe("2026-01-15T12:00:00.000Z");
    });

    it("includes timeWindow in timeline", () => {
        const state = makeFakeState({ timeWindow: "6h" });
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.timeline.timeWindow).toBe("6h");
    });

    it("includes isPlaybackMode in timeline", () => {
        const state = makeFakeState({ isPlaybackMode: true });
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.timeline.isPlaybackMode).toBe(true);
    });

    it("includes playbackTime in timeline", () => {
        const state = makeFakeState({ playbackTime: 1737000000000 });
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.timeline.playbackTime).toBe(1737000000000);
    });

    it("includes playbackSpeed in timeline", () => {
        const state = makeFakeState({ playbackSpeed: 10 });
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.timeline.playbackSpeed).toBe(10);
    });
});

describe("buildGlobeSnapshot — selectedEntity (RSRC-01)", () => {
    it("returns null for selectedEntity when state.selectedEntity is null", () => {
        const state = makeFakeState({ selectedEntity: null });
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.selectedEntity).toBeNull();
    });

    it("returns 'pluginId:id' string when a GeoEntity is selected", () => {
        const entity: GeoEntity = {
            id: "icao-abc123",
            pluginId: "aviation",
            latitude: 40.7128,
            longitude: -74.006,
            timestamp: new Date(),
            properties: {},
        };
        const state = makeFakeState({ selectedEntity: entity });
        const snapshot = buildGlobeSnapshot(state);

        expect(snapshot.selectedEntity).toBe("aviation:icao-abc123");
    });
});

describe("buildGlobeSnapshot — lastUpdate (RSRC-01)", () => {
    it("lastUpdate is a number (Unix timestamp ms)", () => {
        const state = makeFakeState();
        const snapshot = buildGlobeSnapshot(state);

        expect(typeof snapshot.lastUpdate).toBe("number");
    });

    it("lastUpdate is approximately now (within 1 second)", () => {
        const before = Date.now();
        const state = makeFakeState();
        const snapshot = buildGlobeSnapshot(state);
        const after = Date.now();

        expect(snapshot.lastUpdate).toBeGreaterThanOrEqual(before);
        expect(snapshot.lastUpdate).toBeLessThanOrEqual(after);
    });
});
