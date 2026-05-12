import type { 
    WorldPlugin, 
    GeoEntity, 
    TimeRange, 
    PluginContext, 
    LayerConfig, 
    CesiumEntityOptions, 
    SelectionBehavior, 
    ServerPluginConfig, 
    FilterDefinition 
} from "@worldwideview/wwv-plugin-sdk";

/**
 * Base abstraction for aviation-based plugins.
 * Inheriting plugins inherit default clustering, models, selection, and rendering logic.
 */
export abstract class BaseAviationPlugin implements WorldPlugin {
    abstract id: string;
    abstract name: string;
    abstract description: string;
    abstract icon: any;
    category = "aviation" as const;
    abstract version: string;

    protected context: PluginContext | null = null;
    
    // Configurable rendering defaults
    protected defaultLayerColor = "#3b82f6";
    protected defaultTrailColor = "#00fff7";
    protected iconUrl = "/plane-icon.svg";
    protected modelUrl = "/airplane/scene.gltf";
    
    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.context = null; }

    // Implementations must define how payload comes via fetch and websocket
    abstract fetch(timeRange: TimeRange): Promise<GeoEntity[]>;
    abstract mapWebsocketPayload(payload: any): GeoEntity[];
    
    // Server backend configurations
    abstract getServerConfig(): ServerPluginConfig;
    
    // Legends and Filters
    abstract getFilterDefinitions(): FilterDefinition[];
    abstract getLegend(): { label: string; color: string; filterId?: string; filterValue?: string }[];

    getPollingInterval(): number { 
        return 0; // Disabled in favor of WebSocket firehose 
    }

    getLayerConfig(): LayerConfig {
        return { 
            color: this.defaultLayerColor, 
            clusterEnabled: true, 
            clusterDistance: 40, 
            maxEntities: 5000 
        };
    }

    /**
     * Define the color based on the altitude (meters) specific to the aviation domain
     */
    protected abstract getAltitudeColor(altitudeMeters: number | null): string;

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const alt = entity.properties.altitude_m as number | null;
        const isAirborne = !entity.properties.on_ground;
        
        return {
            type: "model", 
            iconUrl: this.iconUrl, 
            size: isAirborne ? 8 : 5,
            modelUrl: this.modelUrl, 
            modelScale: 2.56, 
            modelMinPixelSize: 16, 
            modelHeadingOffset: 180,
            color: this.getAltitudeColor(alt), 
            rotation: entity.heading,
            labelText: entity.label || undefined, 
            labelFont: "11px JetBrains Mono, monospace"
        };
    }

    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null {
        if (entity.properties.on_ground) return null;
        return { 
            showTrail: true, 
            trailDurationSec: 60, 
            trailStepSec: 5, 
            trailColor: this.defaultTrailColor, 
            flyToOffsetMultiplier: 3, 
            flyToBaseDistance: 30000 
        };
    }
}
