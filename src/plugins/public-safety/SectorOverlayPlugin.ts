import type {
    WorldPlugin,
    GeoEntity,
    LayerConfig,
    CesiumEntityOptions,
    TimeRange,
    PluginContext,
} from "@/core/plugins/PluginTypes";

export const sectorOverlayPlugin: WorldPlugin = {
    id: "apd-sectors",
    name: "APD Patrol Sectors",
    description: "Austin Police Department patrol sector boundaries overlaid on the map.",
    icon: "Map",
    category: "intelligence",
    version: "1.0.0",

    async initialize(_ctx: PluginContext): Promise<void> {},
    destroy(): void {},
    getPollingInterval(): number { return 0; },

    getLayerConfig(): LayerConfig {
        return { color: "#a78bfa", clusterEnabled: false, clusterDistance: 0 };
    },

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        return [];
    },

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return { type: "point", color: "#a78bfa", size: 0 };
    },

    getLegend() {
        return [{ label: "APD Patrol Sector", color: "#a78bfa" }];
    },

    getGlobeComponent() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { SectorOverlayGlobe } = require("./SectorOverlayGlobe");
        return SectorOverlayGlobe;
    },
};
