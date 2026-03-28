import { Lamp, Lightbulb } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin, type GeoEntity, type TimeRange, type PluginContext,
    type LayerConfig, type CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";
export class LighthousesPlugin implements WorldPlugin {
    id = "lighthouses";
    name = "Lighthouses";
    description = "Lighthouses worldwide from OSM";
    icon = Lamp;
    category = "maritime" as const;
    version = "1.0.0";
    private iconUrl?: string;

    async initialize(_ctx: PluginContext): Promise<void> { }
    destroy(): void { }
    async fetch(_tr: TimeRange): Promise<GeoEntity[]> { return []; }
    getPollingInterval(): number { return 0; }

    getLayerConfig(): LayerConfig {
        return {
            color: "#facc15",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 5000,
        };
    }

    renderEntity(_e: GeoEntity): CesiumEntityOptions {
        if (!this.iconUrl) {
            this.iconUrl = createSvgIconUrl(Lightbulb, { color: "#facc15" });
        }
        return { type: "billboard", iconUrl: this.iconUrl, color: "#facc15" };
    }
}
