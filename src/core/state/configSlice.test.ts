import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createConfigSlice, ConfigSlice } from './configSlice';

describe('configSlice', () => {
    let store: StoreApi<ConfigSlice>;

    beforeEach(() => {
        // Mock localStorage
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn(),
        });
        
        store = createStore<ConfigSlice>((set, get, api) => createConfigSlice(set as any, get as any, api as any));
    });

    it('initializes with default config', () => {
        const state = store.getState();
        expect(state.dataConfig.cacheEnabled).toBe(true);
        expect(state.mapConfig.antiAliasing).toBe('fxaa');
    });

    it('updates data config', () => {
        store.getState().updateDataConfig({ cacheEnabled: false, maxConcurrentRequests: 10 });
        const state = store.getState();
        
        expect(state.dataConfig.cacheEnabled).toBe(false);
        expect(state.dataConfig.maxConcurrentRequests).toBe(10);
        // Ensure other properties are untouched
        expect(state.dataConfig.cacheMaxAge).toBe(3600000);
    });

    it('updates map config and syncs baseLayerId to localStorage', () => {
        store.getState().updateMapConfig({ showFps: true, baseLayerId: 'satellite' });
        const state = store.getState();
        
        expect(state.mapConfig.showFps).toBe(true);
        expect(state.mapConfig.baseLayerId).toBe('satellite');
        // Ensure localStorage was called
        expect(localStorage.setItem).toHaveBeenCalledWith('wwv_map_layer', 'satellite');
    });

    it('updates map config without baseLayerId does not touch localStorage', () => {
        store.getState().updateMapConfig({ showFps: true });
        
        expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('sets polling interval for a plugin', () => {
        store.getState().setPollingInterval('plugin-a', 5000);
        const state = store.getState();
        
        expect(state.dataConfig.pollingIntervals['plugin-a']).toBe(5000);
    });

    it('updates plugin settings deeply', () => {
        // Initial set
        store.getState().updatePluginSettings('plugin-a', { param1: 'value1' });
        expect(store.getState().dataConfig.pluginSettings['plugin-a']).toEqual({ param1: 'value1' });
        
        // Update set (should merge)
        store.getState().updatePluginSettings('plugin-a', { param2: 'value2' });
        expect(store.getState().dataConfig.pluginSettings['plugin-a']).toEqual({ 
            param1: 'value1',
            param2: 'value2'
        });
    });
});
