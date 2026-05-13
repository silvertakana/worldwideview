/**
 * @file geojsonSlice.ts
 * @description State slice managing locally imported GeoJSON layers (files uploaded by the user).
 */

import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { GeoJsonFeatureCollection } from "@/types/geojson";

// ─── Imported GeoJSON Layer ──────────────────────────────────
/**
 * A GeoJSON layer imported manually by the user.
 */
export interface ImportedLayer {
    /** Unique ID for the imported layer. */
    id: string;
    /** Display name chosen by the user. */
    name: string;
    /** Optional description of the layer contents. */
    description: string;
    /** Hex color code used to style features in this layer. */
    color: string;
    /** Whether the layer is currently rendered on the map. */
    visible: boolean;
    /** The raw GeoJSON data. */
    featureCollection: GeoJsonFeatureCollection;
}

/**
 * Zustand state slice for managing user-imported GeoJSON data.
 */
export interface GeoJsonSlice {
    /** List of all currently imported GeoJSON layers. */
    importedLayers: ImportedLayer[];
    /** Adds a new GeoJSON layer to the collection. */
    addImportedLayer: (layer: ImportedLayer) => void;
    /** Permanently removes an imported layer from memory. */
    removeImportedLayer: (id: string) => void;
    /** Toggles the map visibility of a specific imported layer. */
    toggleImportedLayerVisibility: (id: string) => void;
    /** Updates metadata (name, description, color) for an existing imported layer. */
    updateImportedLayer: (
        id: string,
        patch: Partial<Pick<ImportedLayer, "name" | "description" | "color">>,
    ) => void;
}

export const createGeoJsonSlice: StateCreator<
    AppStore,
    [],
    [],
    GeoJsonSlice
> = (set) => ({
    importedLayers: [],

    addImportedLayer: (layer) =>
        set((state) => ({
            importedLayers: [...state.importedLayers, layer],
        })),

    removeImportedLayer: (id) =>
        set((state) => ({
            importedLayers: state.importedLayers.filter((l) => l.id !== id),
        })),

    toggleImportedLayerVisibility: (id) =>
        set((state) => ({
            importedLayers: state.importedLayers.map((l) =>
                l.id === id ? { ...l, visible: !l.visible } : l,
            ),
        })),

    updateImportedLayer: (id, patch) =>
        set((state) => ({
            importedLayers: state.importedLayers.map((l) =>
                l.id === id ? { ...l, ...patch } : l,
            ),
        })),
});
