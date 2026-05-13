/**
 * @file store.ts
 * @description The central state management hub for WorldWideView.
 * Combines multiple Zustand slices into a single unified store for the entire application.
 */

import { create } from "zustand";
import { createGlobeSlice, type GlobeSlice } from "./globeSlice";
import { createLayersSlice, type LayersSlice } from "./layersSlice";
import { createTimelineSlice, type TimelineSlice } from "./timelineSlice";
import { createUISlice, type UISlice } from "./uiSlice";
import { createFilterSlice, type FilterSlice } from "./filterSlice";
import { createDataSlice, type DataSlice } from "./dataSlice";
import { createConfigSlice, type ConfigSlice } from "./configSlice";
import { createFavoritesSlice, type FavoritesSlice } from "./favoritesSlice";
import { createGeoJsonSlice, type GeoJsonSlice } from "./geojsonSlice";

/**
 * Re-exporting slice types for easier access from components and utilities.
 */
export type { MapConfig, DataConfig } from "./configSlice";
export type { LayerState } from "./layersSlice";
export type { ImportedLayer } from "./geojsonSlice";



// ─── Combined Store ──────────────────────────────────────────
export type AppStore = GlobeSlice &
    LayersSlice &
    TimelineSlice &
    UISlice &
    FilterSlice &
    DataSlice &
    ConfigSlice &
    FavoritesSlice &
    GeoJsonSlice;

/**
 * The primary hook for accessing and modifying the application state.
 * 
 * This combined store provides access to all nine state slices:
 * globe, layers, timeline, ui, filter, data, config, favorites, and geojson.
 */
export const useStore = create<AppStore>((...args) => ({
    ...createGlobeSlice(...args),
    ...createLayersSlice(...args),
    ...createTimelineSlice(...args),
    ...createUISlice(...args),
    ...createFilterSlice(...args),
    ...createDataSlice(...args),
    ...createConfigSlice(...args),
    ...createFavoritesSlice(...args),
    ...createGeoJsonSlice(...args),
}));

