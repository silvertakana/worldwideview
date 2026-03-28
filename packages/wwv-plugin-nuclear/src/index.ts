import { Atom, Radiation } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin,
    type GeoEntity,
    type TimeRange,
    type PluginContext,
    type LayerConfig,
    type CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";

export class NuclearPlugin implements WorldPlugin {
    id = "nuclear";
    name = "Nuclear Facilities";
    description = "Global nuclear power plants and reactors from OSM.";
    icon = Atom;
    category = "infrastructure" as const;
    version = "1.0.0";
    private iconUrl?: string;

    async initialize(_ctx: PluginContext): Promise<void> { }
    destroy(): void { }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        // Rendering managed by StaticDataPlugin loader
        return [];
    }

    getPollingInterval(): number { return 0; }

    getLayerConfig(): LayerConfig {
        return {
            color: "#22d3ee",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 1000,
        };
    }

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        if (!this.iconUrl) {
            this.iconUrl = createSvgIconUrl(Radiation, { color: "#22d3ee" });
        }
        return { type: "billboard", iconUrl: this.iconUrl, color: "#22d3ee" };
    }
}
