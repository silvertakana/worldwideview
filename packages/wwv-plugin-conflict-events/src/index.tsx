import { Crosshair } from "lucide-react";
import {
    type GeoEntity,
    type TimeRange,
    type FilterDefinition,
    type ServerPluginConfig
} from "@worldwideview/wwv-plugin-sdk";
import { BaseIncidentPlugin } from "@worldwideview/wwv-lib-incidents";

export class ConflictEventsPlugin extends BaseIncidentPlugin {
    id = "conflict-events";
    name = "Conflict Events";
    description = "Recent conflict events and violence mapping";
    icon = Crosshair;
    category = "conflict" as const;
    version = "1.0.1";
    
    protected defaultLayerColor = "#ef4444";
    protected clusterDistance = 50;
    
    private data: GeoEntity[] = [];

    protected getSeverityValue(entity: GeoEntity): number {
        return (entity.properties?.fatalities as number) || 0;
    }

    protected getSeverityColor(fatalities: number): string {
        if (fatalities > 10) return "#ef4444";
        if (fatalities > 0) return "#f97316";
        return "#facc15"; // Yellow for Low/Remote
    }

    protected getSeveritySize(fatalities: number): number {
        if (fatalities > 10) return 20;
        if (fatalities > 0) return 15;
        return 10;
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/conflict_events",
            pollingIntervalMs: 3600 * 24 * 1000, 
            requiresAuth: false,
            historyEnabled: false,
            availabilityEnabled: true
        };
    }

    async fetch(timeRange: TimeRange): Promise<GeoEntity[]> {
        const engineBase = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL
            ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, '').replace(/^ws/, 'http')
            : 'http://localhost:5001';
        const res = await fetch(`${engineBase}/data/conflict_events`);
        const json = await res.json();
        
        if (json.data) {
            this.data = json.data;
            return this.data;
        }
        return [];
    }

    getPollingInterval(): number { 
        return 3600 * 24 * 1000;
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "type",
                label: "Event Type",
                propertyKey: "type",
                type: "select",
                options: [
                    { value: "Battles", label: "Battles" },
                    { value: "Explosions/Remote violence", label: "Explosions/Remote violence" },
                    { value: "Violence against civilians", label: "Violence against civilians" },
                    { value: "Protests", label: "Protests" },
                    { value: "Riots", label: "Riots" },
                    { value: "Strategic developments", label: "Strategic developments" }
                ]
            }
        ];
    }

    getLegend() {
        return [
            { label: "High Fatalities (>10)", color: "#ef4444" },
            { label: "Medium Fatalities (1-10)", color: "#f97316" },
            { label: "Low Fatalities / Remote", color: "#facc15" },
        ];
    }
}
