import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createGlobeSlice, GlobeSlice } from './globeSlice';

describe('globeSlice', () => {
    let store: StoreApi<GlobeSlice>;

    beforeEach(() => {
        // Create an isolated vanilla store specifically for this slice
        store = createStore<GlobeSlice>((set, get, api) => createGlobeSlice(set as any, get as any, api as any));
    });

    it('sets initial camera state correctly', () => {
        const state = store.getState();
        expect(state.cameraLat).toBe(20);
        expect(state.cameraLon).toBe(0);
        expect(state.cameraAlt).toBe(20000000);
        expect(state.cameraHeading).toBe(0);
        expect(state.cameraPitch).toBe(-90);
        expect(state.cameraRoll).toBe(0);
        expect(state.isAnimating).toBe(false);
        expect(state.fps).toBe(0);
    });

    it('updates camera position atomically', () => {
        store.getState().setCameraPosition(45, -90, 1000);
        const state = store.getState();
        
        expect(state.cameraLat).toBe(45);
        expect(state.cameraLon).toBe(-90);
        expect(state.cameraAlt).toBe(1000);
    });

    it('resets orientation to defaults when not provided in position update', () => {
        // First set custom orientation
        store.getState().setCameraPosition(45, -90, 1000, 45, -45, 15);
        // Then set without orientation
        store.getState().setCameraPosition(50, -80, 2000);
        const state = store.getState();
        
        expect(state.cameraHeading).toBe(0);
        expect(state.cameraPitch).toBe(-90);
        expect(state.cameraRoll).toBe(0);
    });

    it('updates custom orientation when provided', () => {
        store.getState().setCameraPosition(45, -90, 1000, 180, -30, 45);
        const state = store.getState();
        
        expect(state.cameraHeading).toBe(180);
        expect(state.cameraPitch).toBe(-30);
        expect(state.cameraRoll).toBe(45);
    });

    it('toggles animation state', () => {
        store.getState().setAnimating(true);
        expect(store.getState().isAnimating).toBe(true);
        
        store.getState().setAnimating(false);
        expect(store.getState().isAnimating).toBe(false);
    });

    it('records frames per second', () => {
        store.getState().setFps(60);
        expect(store.getState().fps).toBe(60);
    });
});
