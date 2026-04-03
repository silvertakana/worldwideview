import { Scale } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin,
    type GeoEntity,
    type TimeRange,
    type PluginContext,
    type LayerConfig,
    type CesiumEntityOptions,
    type SelectionBehavior,
    type FilterDefinition,
    type ServerPluginConfig,
} from "@worldwideview/wwv-plugin-sdk";

const AUTHORITY_COLORS: Record<string, string> = {
    "OFAC": "#ef4444",   // Red
    "EU": "#3b82f6",     // Blue
    "UN": "#10b981",     // Green
    "UK": "#8b5cf6",     // Purple
    "BIS": "#f97316",    // Orange
    "DEFAULT": "#6b7280" // Gray
};

export class InternationalSanctionsPlugin implements WorldPlugin {
    id = "international-sanctions";
    name = "International Sanctions";
    description = "Global entities, vessels, and facilities under active sanctions";
    icon = Scale;
    category = "economic" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;
    private iconUrls: Record<string, string> = {};

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
    }

    destroy(): void {
        this.context = null;
    }

    async fetch(timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await globalThis.fetch(`/api/plugins/sanctions?start=${timeRange.start.toISOString()}&end=${timeRange.end.toISOString()}`);
            if (!res.ok) throw new Error(`Sanctions API returned ${res.status}`);
            
            const data = await res.json();
            const sanctions = data.items || [];

            return sanctions.map((s: any): GeoEntity => ({
                id: s.id,
                pluginId: this.id,
                latitude: s.latitude,
                longitude: s.longitude,
                altitude: 0,
                timestamp: new Date(s.timestamp),
                label: s.targetName,
                properties: {
                    ...s
                },
            }));
        } catch (err) {
            console.error(`[${this.name}] Fetch error:`, err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 60000; // Poll every 60 seconds
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ef4444",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 5000,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const authority = (entity.properties.authority as string) || "DEFAULT";
        const color = AUTHORITY_COLORS[authority] || AUTHORITY_COLORS.DEFAULT;

        if (!this.iconUrls[color]) {
            this.iconUrls[color] = createSvgIconUrl(Scale, { color });
        }

        return {
            type: "billboard",
            iconUrl: this.iconUrls[color],
            color,
            size: 28,
            outlineColor: "#ffffff",
            outlineWidth: 2,
            labelText: entity.label,
            labelFont: "12px sans-serif",
        };
    }

    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null {
        return {
            showTrail: false,
            flyToOffsetMultiplier: 2,
            flyToBaseDistance: 500000,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "authority",
                label: "Sanctioning Authority",
                type: "select",
                propertyKey: "authority",
                options: [
                    { value: "OFAC", label: "US OFAC" },
                    { value: "EU", label: "European Union" },
                    { value: "UN", label: "United Nations" },
                    { value: "UK", label: "UK OFSI" },
                    { value: "BIS", label: "US BIS" }
                ]
            },
            {
                id: "country",
                label: "Target Country",
                type: "text",
                propertyKey: "country"
            }
        ];
    }

    getLegend() {
        return [
            { label: "US OFAC", color: AUTHORITY_COLORS.OFAC },
            { label: "European Union", color: AUTHORITY_COLORS.EU },
            { label: "United Nations", color: AUTHORITY_COLORS.UN },
            { label: "UK OFSI", color: AUTHORITY_COLORS.UK },
            { label: "US BIS", color: AUTHORITY_COLORS.BIS },
            { label: "Other", color: AUTHORITY_COLORS.DEFAULT },
        ];
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/plugins/sanctions",
            pollingIntervalMs: 60000 * 60, // Seeder runs hourly
            historyEnabled: false, // Sanctions are active lists, history less relevant for basic map
        };
    }
}
