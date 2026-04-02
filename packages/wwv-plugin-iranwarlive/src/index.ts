import { ShieldAlert, Rocket, Plane, Target, Bomb } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin,
    type GeoEntity,
    type TimeRange,
    type PluginContext,
    type LayerConfig,
    type CesiumEntityOptions,
    type FilterDefinition,
} from "@worldwideview/wwv-plugin-sdk";

function typeToIcon(type: string) {
    switch(type) {
        case "Missile Strike": return Rocket;
        case "Air Strike": return Plane;
        case "Ground Combat": return Target;
        case "Artillery": return Bomb;
        default: return ShieldAlert;
    }
}

export class IranWarStrikesPlugin implements WorldPlugin {
    id = "iranwarlive";
    name = "Iran War Strikes";
    description = "Live OSINT strike tracking — Data sourced from IranWarLive.com (Not for Life-Safety)";
    icon = ShieldAlert;
    category = "conflict" as const;
    version = "1.0.0";
    private context: PluginContext | null = null;
    private iconUrls: Record<string, string> = {};

    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.context = null; }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            // We route through Next.js rewrites to hit the shared data engine backend seamlessly
            const res = await globalThis.fetch("/api/external/iranwarlive/history");
            
            if (!res.ok) throw new Error(`IranWarLive Backend returned ${res.status}`);
            
            const data = await res.json();
            
            if (!data.items || !Array.isArray(data.items)) return [];

            return data.items.map((item: any): GeoEntity => {
                const lat = item._osint_meta?.coordinates?.lat || 0;
                const lon = item._osint_meta?.coordinates?.lng || 0;
                
                return {
                    id: item.event_id,
                    pluginId: "iranwarlive",
                    latitude: lat,
                    longitude: lon,
                    timestamp: new Date(item.timestamp),
                    label: item.type,
                    properties: {
                        type: item.type,
                        confidence: item.confidence,
                        location: item.location,
                        summary: item.event_summary,
                        casualties: item._osint_meta?.casualties || 0,
                        source_url: item.source_url,
                        preview_image: item.preview_image,
                        preview_video: item.preview_video
                    },
                };
            });
        } catch (err) {
            console.error("[IranWarStrikesPlugin] Fetch error from microservice backend:", err);
            return [];
        }
    }

    getPollingInterval(): number { return 60000; } // Poll the fastify backend every minute

    getLayerConfig(): LayerConfig {
        return { color: "#ef4444", clusterEnabled: true, clusterDistance: 40 };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const type = (entity.properties.type as string) || "Unknown";
        const IconComponent = typeToIcon(type);
        const color = "#ef4444"; // Vivid alert red for all kinetic events

        const cacheKey = `${type}-${color}`;
        if (!this.iconUrls[cacheKey]) {
            this.iconUrls[cacheKey] = createSvgIconUrl(IconComponent, { color });
        }

        return {
            type: "billboard", 
            iconUrl: this.iconUrls[cacheKey], 
            color,
            iconScale: 0.8
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "type", label: "Strike Type", type: "select", propertyKey: "type",
                options: [
                    { value: "Missile Strike", label: "Missile Strike" }, 
                    { value: "Air Strike", label: "Air Strike" }
                ],
            },
            {
                id: "confidence", label: "Intelligence Confidence", type: "select", propertyKey: "confidence",
                options: [{ value: "News Wire", label: "News Wire" }, { value: "State Actor", label: "State Defense Press" }],
            }
        ];
    }
}
