import type { PluginManifest, WorldPlugin, PluginContext, TimeRange, GeoEntity, LayerConfig, CesiumEntityOptions } from "@worldwideview/wwv-plugin-sdk";
import { OSMBboxOverlay } from "./components/OSMBboxOverlay";
import { OSMSidebar } from "./components/OSMSidebar";
import { manifest } from "./manifest";

export class OSMSearchPlugin implements WorldPlugin {
    id = manifest.id;
    name = manifest.name;
    description = manifest.description!;
    icon = "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/></svg>";
    category = manifest.category as any;
    version = manifest.version;

    private ctx!: PluginContext;

    async initialize(ctx: PluginContext) {
        this.ctx = ctx;
    }
    
    destroy() {}

    async fetch(timeRange: TimeRange): Promise<GeoEntity[]> { return []; }

    getPollingInterval() { return 999999999; }

    getLayerConfig(): LayerConfig {
        return { color: "#ff0000", clusterEnabled: true, clusterDistance: 50 };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        return { type: "point", color: "#ff0000", size: 8 };
    }

    getSidebarComponent() { return OSMSidebar; }
    getGlobeComponent() { return OSMBboxOverlay; }
}

export { manifest };
