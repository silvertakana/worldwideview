/**
 * Factory that creates a WorldPlugin instance for each imported GeoJSON layer.
 * Each import becomes its own independent plugin entry in the Data Layers list.
 */

import { FileJson } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";
import type { GeoJsonFeatureCollection } from "@/types/geojson";
import { featuresToEntities } from "./entityConverter";

/** Color palette for imported layers. */
const LAYER_COLORS = [
    "#00e5ff", "#ff6d00", "#76ff03", "#d500f9",
    "#ffea00", "#ff1744", "#00bfa5", "#651fff",
];

export function pickLayerColor(index: number): string {
    return LAYER_COLORS[index % LAYER_COLORS.length];
}

export interface ImportedPluginConfig {
    id: string;
    name: string;
    description: string;
    color: string;
    featureCollection: GeoJsonFeatureCollection;
}

/**
 * Creates a WorldPlugin instance for a single imported GeoJSON dataset.
 * The plugin ID is prefixed with "geojson-" to avoid collisions.
 */
export function createGeoJsonPlugin(config: ImportedPluginConfig): WorldPlugin {
    const entities = featuresToEntities(
        config.featureCollection.features,
        config.id,
    );

    return {
        id: config.id,
        name: config.name,
        description: config.description,
        icon: FileJson,
        category: "custom" as const,
        version: "1.0.0",

        async initialize(_ctx: PluginContext): Promise<void> { },
        destroy(): void { },

        async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
            return entities;
        },

        getPollingInterval(): number {
            return 9999999;
        },

        getLayerConfig(): LayerConfig {
            return {
                color: config.color,
                clusterEnabled: true,
                clusterDistance: 40,
            };
        },

        renderEntity(_entity: GeoEntity): CesiumEntityOptions {
            return {
                type: "point",
                color: config.color,
                size: 8,
                outlineColor: "#ffffff",
                outlineWidth: 1,
            };
        },
    };
}
