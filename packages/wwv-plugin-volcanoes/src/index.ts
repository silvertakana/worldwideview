import { Mountain } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin, type GeoEntity, type TimeRange, type PluginContext,
    type LayerConfig, type CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";
export class VolcanoesPlugin implements WorldPlugin {
    id = "volcanoes";
    name = "Volcanoes";
    description = "Active and dormant volcanoes worldwide from OSM";
    icon = Mountain;
    category = "natural-disaster" as const;
    version = "1.0.0";
    private iconUrl?: string;

    async initialize(_ctx: PluginContext): Promise<void> { }
    destroy(): void { }
    async fetch(_tr: TimeRange): Promise<GeoEntity[]> { return []; }
    getPollingInterval(): number { return 0; }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ef4444",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 1000,
        };
    }

    renderEntity(_e: GeoEntity): CesiumEntityOptions {
        if (!this.iconUrl) {
            this.iconUrl = createSvgIconUrl(Mountain, { color: "#ef4444" });
        }
        return { type: "billboard", iconUrl: this.iconUrl, color: "#ef4444" };
    }
}
