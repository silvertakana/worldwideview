import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createLayersSlice, LayersSlice } from './layersSlice';

describe('layersSlice', () => {
    let store: StoreApi<LayersSlice>;

    beforeEach(() => {
        store = createStore<LayersSlice>((set, get, api) => createLayersSlice(set as any, get as any, api as any));
    });

    it('initializes with empty layers', () => {
        const state = store.getState();
        expect(state.layers).toEqual({});
    });

    it('initializes a new layer with default values', () => {
        store.getState().initLayer('test-plugin');
        const state = store.getState();
        expect(state.layers['test-plugin']).toEqual({
            enabled: false,
            entityCount: 0,
            loading: false
        });
    });

    it('initializes a new layer with explicitly requested enabled status', () => {
        store.getState().initLayer('test-plugin', true);
        const state = store.getState();
        expect(state.layers['test-plugin'].enabled).toBe(true);
    });

    it('does not overwrite an existing layer upon re-initialization', () => {
        store.getState().initLayer('test-plugin', true);
        store.getState().setEntityCount('test-plugin', 42);
        
        // Re-initialize
        store.getState().initLayer('test-plugin', false);
        const state = store.getState();
        
        // Should preserve previous state
        expect(state.layers['test-plugin'].enabled).toBe(true);
        expect(state.layers['test-plugin'].entityCount).toBe(42);
    });

    it('toggles layer enabled status', () => {
        store.getState().initLayer('test-plugin', false);
        
        store.getState().toggleLayer('test-plugin');
        expect(store.getState().layers['test-plugin'].enabled).toBe(true);
        
        store.getState().toggleLayer('test-plugin');
        expect(store.getState().layers['test-plugin'].enabled).toBe(false);
    });

    it('explicitly sets layer enabled status', () => {
        store.getState().initLayer('test-plugin', false);
        
        store.getState().setLayerEnabled('test-plugin', true);
        expect(store.getState().layers['test-plugin'].enabled).toBe(true);
        
        store.getState().setLayerEnabled('test-plugin', true); // Should remain true
        expect(store.getState().layers['test-plugin'].enabled).toBe(true);
    });

    it('updates entity count', () => {
        store.getState().initLayer('test-plugin');
        
        store.getState().setEntityCount('test-plugin', 150);
        expect(store.getState().layers['test-plugin'].entityCount).toBe(150);
    });

    it('updates loading status', () => {
        store.getState().initLayer('test-plugin');
        
        store.getState().setLayerLoading('test-plugin', true);
        expect(store.getState().layers['test-plugin'].loading).toBe(true);
        
        store.getState().setLayerLoading('test-plugin', false);
        expect(store.getState().layers['test-plugin'].loading).toBe(false);
    });
});
