import type { 
    WorldPlugin, 
    GeoEntity, 
    TimeRange, 
    PluginContext, 
    LayerConfig,
    FilterDefinition,
    CesiumEntityOptions,
    ServerPluginConfig
} from "@worldwideview/wwv-plugin-sdk";
import { Hand } from "lucide-react";

export class CivilUnrestPlugin implements WorldPlugin {
    id = "civil-unrest";
    name = "Civil Unrest";
    description = "Tracks global protests, riots, and civil disturbances via ACLED.";
    icon = Hand;
    category = "conflict" as const;
    version = "1.1.0";

    async initialize(ctx: PluginContext): Promise<void> {
        console.log("[CivilUnrestPlugin] Initialized.");
    }

    destroy(): void {
        console.log("[CivilUnrestPlugin] Destroyed.");
    }
    
    getPollingInterval(): number {
        return 3600000; // 1 hour
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#eab308",
            clusterEnabled: true,
            clusterDistance: 50,
            minZoomLevel: 3
        };
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/external/civil_unrest",
            pollingIntervalMs: 3600000, 
            historyEnabled: false,
            availabilityEnabled: false
        };
    }

    async fetch(timeRange: TimeRange): Promise<GeoEntity[]> {
        const res = await fetch("/api/external/civil_unrest");
        const json = await res.json();
        
        // Route returns { data: { source, fetchedAt, items, totalCount } }
        // or { data: [...] } from legacy format — handle both
        const payload = json.data;
        if (!payload) return [];

        const items = Array.isArray(payload) ? payload : (payload.items || []);
        
        return items.map((item: any) => ({
            id: `unrest-${item.id}`,
            latitude: item.lat,
            longitude: item.lon,
            name: `${item.type}: ${item.location || 'Unknown'}`,
            properties: {
                type: item.type,
                subType: item.subType,
                actor1: item.actor1,
                actor2: item.actor2,
                fatalities: item.fatalities,
                country: item.country,
                location: item.location,
                date: item.date,
                source: item.source,
                notes: item.notes,
            }
        }));
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "type",
                label: "Event Type",
                type: "select",
                propertyKey: "type",
                options: [
                    { value: "Protests", label: "Protests" },
                    { value: "Riots", label: "Riots" }
                ]
            },
            {
                id: "subType",
                label: "Sub-Type",
                type: "select",
                propertyKey: "subType",
                options: [
                    { value: "Peaceful protest", label: "Peaceful Protest" },
                    { value: "Protest with intervention", label: "Protest w/ Intervention" },
                    { value: "Excessive force against protesters", label: "Excessive Force" },
                    { value: "Violent demonstration", label: "Violent Demonstration" },
                    { value: "Mob violence", label: "Mob Violence" },
                ]
            }
        ];
    }

    getLegend() {
        return [
            { label: "Riots", color: "#ef4444" },
            { label: "Violent Protests", color: "#f97316" },
            { label: "Peaceful Protests", color: "#eab308" },
        ];
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const type = (entity.properties?.type as string) || "";
        const subType = (entity.properties?.subType as string) || "";
        const fatalities = (entity.properties?.fatalities as number) || 0;
        
        let color = "#eab308"; // Default: peaceful protest (yellow)
        if (type === "Riots") {
            color = "#ef4444"; // Red for riots
        } else if (
            subType.includes("Violent") || 
            subType.includes("force") || 
            subType.includes("intervention")
        ) {
            color = "#f97316"; // Orange for violent protests
        }

        // Scale point size by fatality count
        let size = 8;
        if (fatalities > 10) size = 16;
        else if (fatalities > 0) size = 12;

        return {
            type: "point",
            color,
            size,
        };
    }
}
