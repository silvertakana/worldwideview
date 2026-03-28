import { Anchor } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin, type GeoEntity, type TimeRange, type PluginContext,
    type LayerConfig, type CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";
export class SeaportsPlugin implements WorldPlugin {
    id = "seaports";
    name = "Seaports";
    description = "Harbours and seaports worldwide from OSM";
    icon = Anchor;
    category = "maritime" as const;
    version = "1.0.0";
    private iconUrl?: string;

    async initialize(_ctx: PluginContext): Promise<void> { }
    destroy(): void { }
    async fetch(_tr: TimeRange): Promise<GeoEntity[]> { return []; }
    getPollingInterval(): number { return 0; }

    getLayerConfig(): LayerConfig {
        return {
            color: "#0ea5e9",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 5000,
        };
    }

    renderEntity(_e: GeoEntity): CesiumEntityOptions {
        if (!this.iconUrl) {
            this.iconUrl = createSvgIconUrl(Anchor, { color: "#0ea5e9" });
        }
        return { type: "billboard", iconUrl: this.iconUrl, color: "#0ea5e9" };
    }
}
