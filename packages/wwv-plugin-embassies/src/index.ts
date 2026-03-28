import { Landmark } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin, type GeoEntity, type TimeRange, type PluginContext,
    type LayerConfig, type CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";
export class EmbassiesConsulatesPlugin implements WorldPlugin {
    id = "embassies";
    name = "Embassies & Consulates";
    description = "Global embassies, consulates, and diplomatic missions from OpenStreetMap";
    icon = Landmark;
    category = "custom" as const;
    version = "1.0.0";
    private iconUrl?: string;

    async initialize(_ctx: PluginContext): Promise<void> { }
    destroy(): void { }
    async fetch(_tr: TimeRange): Promise<GeoEntity[]> { return []; }
    getPollingInterval(): number { return 0; }

    getLayerConfig(): LayerConfig {
        return {
            color: "#a855f7",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 1000,
        };
    }

    renderEntity(_e: GeoEntity): CesiumEntityOptions {
        if (!this.iconUrl) {
            this.iconUrl = createSvgIconUrl(Landmark, { color: "#a855f7" });
        }
        return { type: "billboard", iconUrl: this.iconUrl, color: "#a855f7" };
    }
}
