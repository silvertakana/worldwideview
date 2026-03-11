import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { GeoJsonFeatureCollection } from "@/types/geojson";

// ─── Imported GeoJSON Layer ──────────────────────────────────
export interface ImportedLayer {
    id: string;
    name: string;
    description: string;
    color: string;
    visible: boolean;
    featureCollection: GeoJsonFeatureCollection;
}

export interface GeoJsonSlice {
    importedLayers: ImportedLayer[];
    addImportedLayer: (layer: ImportedLayer) => void;
    removeImportedLayer: (id: string) => void;
    toggleImportedLayerVisibility: (id: string) => void;
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
