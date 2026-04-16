import { Flame } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin,
    type GeoEntity,
    type TimeRange,
    type PluginContext,
    type LayerConfig,
    type CesiumEntityOptions,
    type FilterDefinition,
    type ServerPluginConfig,
} from "@worldwideview/wwv-plugin-sdk";

function frpToColor(frp: number): string {
    if (frp < 10) return "#fbbf24";
    if (frp < 50) return "#f97316";
    if (frp < 100) return "#ef4444";
    return "#dc2626";
}

function frpToSize(frp: number): number {
    if (frp < 10) return 5;
    if (frp < 50) return 7;
    if (frp < 100) return 9;
    return 12;
}

function getFrpBand(frp: number): string {
    if (frp < 10) return "low";
    if (frp < 50) return "moderate";
    if (frp < 100) return "high";
    return "extreme";
}

export class WildfirePlugin implements WorldPlugin {
    id = "wildfire";
    name = "Wildfire";
    description = "Active fire detection via NASA FIRMS (VIIRS)";
    icon = Flame;
    category = "natural-disaster" as const;
    version = "1.0.0";
    private context: PluginContext | null = null;
    private iconUrls: Record<string, string> = {};

    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.context = null; }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const engineBase = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL
                ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, '').replace(/^ws/, 'http')
                : 'http://localhost:5001';
            const res = await globalThis.fetch(`${engineBase}/data/wildfires`);
            if (!res.ok) throw new Error(`Wildfire API returned ${res.status}`);
            const data = await res.json();
            if (!data.items || !Array.isArray(data.items)) return [];

            return data.items.map((fire: {
                latitude: number; longitude: number; frp: number; confidence: string;
                acq_date: string; acq_time: string; satellite: string;
                bright_ti4?: number; bright_ti5?: number; tier?: number;
            }): GeoEntity => ({
                id: `wildfire-${fire.latitude.toFixed(4)}-${fire.longitude.toFixed(4)}-${fire.acq_date}-${fire.tier || 3}`,
                pluginId: "wildfire",
                latitude: fire.latitude,
                longitude: fire.longitude,
                timestamp: new Date(`${fire.acq_date}T${fire.acq_time.padStart(4, "0").slice(0, 2)}:${fire.acq_time.padStart(4, "0").slice(2)}:00Z`),
                label: `FRP: ${fire.frp}`,
                properties: {
                    frp: fire.frp, frp_band: getFrpBand(fire.frp), confidence: fire.confidence, satellite: fire.satellite,
                    acq_date: fire.acq_date, acq_time: fire.acq_time,
                    bright_ti4: fire.bright_ti4, bright_ti5: fire.bright_ti5, tier: fire.tier,
                },
            }));
        } catch (err) {
            console.error("[WildfirePlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number { return 0; }
    
    getServerConfig(): ServerPluginConfig {
        return { apiBasePath: "/api/wildfires", pollingIntervalMs: 0, historyEnabled: true };
    }
    getLayerConfig(): LayerConfig {
        return { color: "#ef4444", clusterEnabled: true, clusterDistance: 30 };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const frp = (entity.properties.frp as number) || 0;
        const color = frpToColor(frp);
        const tier = (entity.properties.tier as number) || 3;
        let distanceDisplayCondition: { near: number; far: number } | undefined;
        if (tier === 1) distanceDisplayCondition = { near: 3500000, far: Number.POSITIVE_INFINITY };
        else if (tier === 2) distanceDisplayCondition = { near: 1000000, far: 3500000 };
        else if (tier === 3) distanceDisplayCondition = { near: 0, far: 1000000 };

        if (!this.iconUrls[color]) {
            this.iconUrls[color] = createSvgIconUrl(Flame, { color });
        }

        return {
            type: "billboard", iconUrl: this.iconUrls[color], color,
            iconScale: (frpToSize(frp) / 10) * (tier === 1 ? 2 : tier === 2 ? 1.5 : 1),
            distanceDisplayCondition,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            { id: "frp", label: "Fire Radiative Power (MW)", type: "range", propertyKey: "frp", range: { min: 0, max: 500, step: 10 } },
            {
                id: "frp_band", label: "Intensity Category", type: "select", propertyKey: "frp_band",
                options: [
                    { value: "low", label: "FRP < 10 (Low)" },
                    { value: "moderate", label: "FRP 10 - 50 (Moderate)" },
                    { value: "high", label: "FRP 50 - 100 (High)" },
                    { value: "extreme", label: "FRP > 100 (Extreme)" },
                ]
            },
            {
                id: "confidence", label: "Confidence", type: "select", propertyKey: "confidence",
                options: [{ value: "low", label: "Low" }, { value: "nominal", label: "Nominal" }, { value: "high", label: "High" }],
            },
            {
                id: "satellite", label: "Satellite", type: "select", propertyKey: "satellite",
                options: [{ value: "N", label: "Suomi NPP" }, { value: "1", label: "NOAA-20" }, { value: "2", label: "NOAA-21" }],
            },
        ];
    }

    getLegend(): { label: string; color: string; filterId?: string; filterValue?: string }[] {
        return [
            { label: "FRP < 10 (Low)", color: "#fbbf24", filterId: "frp_band", filterValue: "low" },
            { label: "FRP 10 - 50 (Moderate)", color: "#f97316", filterId: "frp_band", filterValue: "moderate" },
            { label: "FRP 50 - 100 (High)", color: "#ef4444", filterId: "frp_band", filterValue: "high" },
            { label: "FRP > 100 (Extreme)", color: "#dc2626", filterId: "frp_band", filterValue: "extreme" },
        ];
    }
}
