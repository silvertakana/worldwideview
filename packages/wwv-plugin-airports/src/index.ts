import { PlaneTakeoff } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin, type GeoEntity, type TimeRange, type PluginContext,
    type LayerConfig, type CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";
export class AirportsPlugin implements WorldPlugin {
    id = "airports";
    name = "Airports";
    description = "Airports and aerodromes worldwide from OSM";
    icon = PlaneTakeoff;
    category = "aviation" as const;
    version = "1.0.0";
    private iconUrl?: string;

    async initialize(_ctx: PluginContext): Promise<void> { }
    destroy(): void { }
    async fetch(_tr: TimeRange): Promise<GeoEntity[]> { return []; }
    getPollingInterval(): number { return 0; }

    getLayerConfig(): LayerConfig {
        return {
            color: "#3b82f6",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 5000,
        };
    }

    renderEntity(_e: GeoEntity): CesiumEntityOptions {
        if (!this.iconUrl) {
            this.iconUrl = createSvgIconUrl(PlaneTakeoff, { color: "#3b82f6" });
        }
        return { type: "billboard", iconUrl: this.iconUrl, color: "#3b82f6" };
    }
}
