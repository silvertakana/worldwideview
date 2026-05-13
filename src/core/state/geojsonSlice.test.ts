import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createGeoJsonSlice, GeoJsonSlice, ImportedLayer } from './geojsonSlice';

describe('geojsonSlice', () => {
    let store: StoreApi<GeoJsonSlice>;

    const mockLayer: ImportedLayer = {
        id: 'layer-1',
        name: 'Test Layer',
        description: 'A test geojson layer',
        color: '#ff0000',
        visible: true,
        featureCollection: { type: 'FeatureCollection', features: [] }
    };

    beforeEach(() => {
        store = createStore<GeoJsonSlice>((set, get, api) => createGeoJsonSlice(set as any, get as any, api as any));
    });

    it('initializes with empty importedLayers', () => {
        expect(store.getState().importedLayers).toEqual([]);
    });

    it('adds an imported layer', () => {
        store.getState().addImportedLayer(mockLayer);
        const layers = store.getState().importedLayers;
        
        expect(layers).toHaveLength(1);
        expect(layers[0]).toEqual(mockLayer);
    });

    it('removes an imported layer by id', () => {
        store.getState().addImportedLayer(mockLayer);
        store.getState().addImportedLayer({ ...mockLayer, id: 'layer-2' });
        
        store.getState().removeImportedLayer('layer-1');
        const layers = store.getState().importedLayers;
        
        expect(layers).toHaveLength(1);
        expect(layers[0].id).toBe('layer-2');
    });

    it('toggles visibility of an imported layer', () => {
        store.getState().addImportedLayer(mockLayer); // initially visible: true
        
        store.getState().toggleImportedLayerVisibility('layer-1');
        expect(store.getState().importedLayers[0].visible).toBe(false);
        
        store.getState().toggleImportedLayerVisibility('layer-1');
        expect(store.getState().importedLayers[0].visible).toBe(true);
    });

    it('updates specific fields of an imported layer', () => {
        store.getState().addImportedLayer(mockLayer);
        
        store.getState().updateImportedLayer('layer-1', { 
            name: 'Updated Name', 
            color: '#00ff00' 
        });
        
        const layer = store.getState().importedLayers[0];
        expect(layer.name).toBe('Updated Name');
        expect(layer.color).toBe('#00ff00');
        // Unchanged fields remain the same
        expect(layer.description).toBe('A test geojson layer');
        expect(layer.visible).toBe(true);
    });
});
