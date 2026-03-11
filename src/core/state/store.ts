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

// Re-export slice types for convenience
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

