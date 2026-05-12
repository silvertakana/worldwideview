import { 
    createSvgIconUrl,
    type WorldPlugin, 
    type GeoEntity, 
    type TimeRange, 
    type PluginContext, 
    type LayerConfig, 
    type CesiumEntityOptions, 
    type ServerPluginConfig, 
    type FilterDefinition,
    type PluginCategory
} from "@worldwideview/wwv-plugin-sdk";

export abstract class BaseIncidentPlugin implements WorldPlugin {
    abstract id: string;
    abstract name: string;
    abstract description: string;
    abstract icon: any;
    abstract category: PluginCategory;
    abstract version: string;

    protected context: PluginContext | null = null;
    protected iconUrls: Record<string, string> = {};
    
    // Configurable rendering defaults
    protected defaultLayerColor = "#ef4444";
    protected clusterDistance = 40;
    
    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.context = null; }

    abstract fetch(timeRange: TimeRange): Promise<GeoEntity[]>;
    
    // Typical incident pipelines scale visually based on a primary "severity" value 
    // (e.g. fatalities, magnitude, acres burned)
    protected abstract getSeverityValue(entity: GeoEntity): number;
    protected abstract getSeverityColor(value: number): string;
    protected abstract getSeveritySize(value: number): number;

    protected getEntityIcon(entity: GeoEntity): any {
        return this.icon;
    }

    abstract getServerConfig(): ServerPluginConfig;
    abstract getFilterDefinitions(): FilterDefinition[];
    abstract getLegend?(): { label: string; color: string; filterId?: string; filterValue?: string }[];

    getPollingInterval(): number { 
        return 0; // Incident plugins typically use ServerConfig.pollingIntervalMs or WebSocket
    }

    getLayerConfig(): LayerConfig {
        return { 
            color: this.defaultLayerColor, 
            clusterEnabled: true, 
            clusterDistance: this.clusterDistance 
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const severity = this.getSeverityValue(entity);
        const color = this.getSeverityColor(severity);
        const size = this.getSeveritySize(severity);
        const iconComponent = this.getEntityIcon(entity);
        
        // Cache key includes icon name + color
        const iconName = iconComponent?.displayName || iconComponent?.name || "default";
        const cacheKey = `${iconName}-${color}`;
        
        if (!this.iconUrls[cacheKey]) {
            this.iconUrls[cacheKey] = createSvgIconUrl(iconComponent, { color });
        }

        return {
            type: "billboard", 
            iconUrl: this.iconUrls[cacheKey], 
            color,
            size,
            outlineColor: "#000000", 
            outlineWidth: 1,
            labelText: entity.label || undefined,
            labelFont: "11px JetBrains Mono, monospace" // Adds optional label standard
        };
    }
}
