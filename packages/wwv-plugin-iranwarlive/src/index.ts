import { ShieldAlert, Rocket, Plane, Target, Bomb } from "lucide-react";
import {
    type GeoEntity,
    type TimeRange,
    type FilterDefinition,
    type ServerPluginConfig,
} from "@worldwideview/wwv-plugin-sdk";
import { BaseIncidentPlugin } from "@worldwideview/wwv-lib-incidents";

function typeToIcon(type: string) {
    switch(type.toLowerCase()) {
        case "missile strike": return Rocket;
        case "air strike": return Plane;
        case "ground combat": return Target;
        case "artillery": return Bomb;
        default: return ShieldAlert;
    }
}

export class IranWarLivePlugin extends BaseIncidentPlugin {
    id = "iranwarlive";
    name = "Iran War Live";
    description = "Live OSINT tracking — Data sourced from IranWarLive.com (Not for Life-Safety)";
    icon = ShieldAlert;
    category = "conflict" as const;
    version = "1.0.2";
    
    protected defaultLayerColor = "#ef4444";
    protected clusterDistance = 40;

    protected getSeverityValue(entity: GeoEntity): number {
        return (entity.properties.casualties as number) || 0;
    }

    protected getSeverityColor(value: number): string {
        return "#ef4444"; // Vivid alert red for all kinetic events
    }

    protected getSeveritySize(value: number): number {
        return 16; // Maintain uniform 0.8 scale size approximately 
    }

    protected getEntityIcon(entity: GeoEntity): any {
        const type = (entity.properties.type as string) || "Unknown";
        return typeToIcon(type);
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const engineBase = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL
                ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, '').replace(/^ws/, 'http')
                : 'http://localhost:5001';
            const res = await globalThis.fetch(`${engineBase}/data/iranwarlive`);
            
            if (!res.ok) throw new Error(`IranWarLive Backend returned ${res.status}`);
            
            const data = await res.json();
            
            if (!data.items || !Array.isArray(data.items)) return [];

            return data.items.map((item: any): GeoEntity => {
                const lat = item._osint_meta?.coordinates?.lat || 0;
                const lon = item._osint_meta?.coordinates?.lng || 0;
                const eventTime = new Date(item.timestamp);
                const hoursAgo = Math.max(0, Math.round((Date.now() - eventTime.getTime()) / (1000 * 60 * 60)));
                
                return {
                    id: item.event_id,
                    pluginId: "iranwarlive",
                    latitude: lat,
                    longitude: lon,
                    timestamp: eventTime,
                    label: item.type + (item.location ? ` in ${item.location}` : ''),
                    properties: {
                        hours_ago: hoursAgo,
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
            console.error("[IranWarLivePlugin] Fetch error from microservice backend:", err);
            return [];
        }
    }

    getServerConfig(): ServerPluginConfig {
        return { apiBasePath: "/api/iranwarlive", pollingIntervalMs: 0, historyEnabled: true };
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
            },
            {
                id: "hours_ago", label: "Max Hours Ago", type: "range", propertyKey: "hours_ago",
                range: { min: 0, max: 168, step: 1 }
            }
        ];
    }

    getLegend() {
        return [
            { label: "Kinetic Event", color: "#ef4444" },
        ];
    }
}
