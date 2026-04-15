import { Search } from "lucide-react";
import type { PluginManifest, WorldPlugin, PluginContext, TimeRange, GeoEntity, LayerConfig, CesiumEntityOptions } from "@worldwideview/wwv-plugin-sdk";
import { OSMBboxOverlay } from "./components/OSMBboxOverlay";
import { OSMSidebar } from "./components/OSMSidebar";
import { manifest } from "./manifest";

export class OSMSearchPlugin implements WorldPlugin {
    id = manifest.id;
    name = manifest.name;
    description = manifest.description!;
    icon = Search;
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
        return { 
            type: "point", 
            color: "#ff0000", 
            size: 8,
            // Ensure points are always visible and don't sink into terrain
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        };
    }

    /** Configures how the camera and UI behaves when an OSM entity is selected */
    getSelectionBehavior(entity: GeoEntity) {
        return {
            // Default "go-to" distance in meters. 
            // 500m provides a good "street-level" view for OSM features.
            flyToBaseDistance: 500,
            showTrail: false
        };
    }

    getSidebarComponent() { return OSMSidebar; }
    getGlobeComponent() { return OSMBboxOverlay; }

    /** Public bridge for the sidebar component to push search results into the main map state */
    pushResults(entities: GeoEntity[]) {
        if (this.ctx) {
            this.ctx.onDataUpdate(entities);
        }
    }

    /** Maps Overpass API elements to WorldWideView GeoEntities */
    mapOverpassToEntities(elements: any[]): GeoEntity[] {
        return elements
            .filter(el => (el.lat && el.lon) || el.center)
            .map(el => {
                const lat = el.lat || el.center?.lat;
                const lon = el.lon || el.center?.lon;
                const name = el.tags?.name || el.tags?.amenity || el.tags?.shop || el.tags?.highway || `OSM ${el.type} ${el.id}`;
                
                return {
                    id: `osm-${el.type}-${el.id}`,
                    pluginId: this.id,
                    latitude: lat,
                    longitude: lon,
                    timestamp: new Date(),
                    label: name,
                    properties: {
                        osm_id: el.id,
                        osm_type: el.type,
                        ...el.tags
                    }
                };
            });
    }
}

export { manifest };
