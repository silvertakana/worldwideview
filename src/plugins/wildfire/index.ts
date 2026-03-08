import { Flame } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
    FilterDefinition,
} from "@/core/plugins/PluginTypes";
import { buildUserKeyHeaders } from "@/lib/userApiKeys";

function frpToColor(frp: number): string {
    if (frp < 10) return "#fbbf24";   // yellow — low
    if (frp < 50) return "#f97316";   // orange — medium
    if (frp < 100) return "#ef4444";  // red — high
    return "#dc2626";                  // dark red — extreme
}

function frpToSize(frp: number): number {
    if (frp < 10) return 5;
    if (frp < 50) return 7;
    if (frp < 100) return 9;
    return 12;
}

export class WildfirePlugin implements WorldPlugin {
    id = "wildfire";
    name = "Wildfire";
    description = "Active fire detection via NASA FIRMS (VIIRS)";
    icon = Flame;
    category = "natural-disaster" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
    }

    destroy(): void {
        this.context = null;
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await globalThis.fetch("/api/wildfire", {
                headers: buildUserKeyHeaders(),
            });
            if (!res.ok) throw new Error(`Wildfire API returned ${res.status}`);
            const data = await res.json();

            if (!data.fires || !Array.isArray(data.fires)) return [];

            return data.fires.map(
                (fire: {
                    latitude: number;
                    longitude: number;
                    frp: number;
                    confidence: string;
                    acq_date: string;
                    acq_time: string;
                    satellite: string;
                    bright_ti4?: number;
                    bright_ti5?: number;
                    tier?: number;
                }): GeoEntity => ({
                    id: `wildfire-${fire.latitude.toFixed(4)}-${fire.longitude.toFixed(4)}-${fire.acq_date}-${fire.tier || 3}`,
                    pluginId: "wildfire",
                    latitude: fire.latitude,
                    longitude: fire.longitude,
                    timestamp: new Date(`${fire.acq_date}T${fire.acq_time.padStart(4, "0").slice(0, 2)}:${fire.acq_time.padStart(4, "0").slice(2)}:00Z`),
                    label: `FRP: ${fire.frp}`,
                    properties: {
                        frp: fire.frp,
                        confidence: fire.confidence,
                        satellite: fire.satellite,
                        acq_date: fire.acq_date,
                        acq_time: fire.acq_time,
                        bright_ti4: fire.bright_ti4,
                        bright_ti5: fire.bright_ti5,
                        tier: fire.tier,
                    },
                })
            );
        } catch (err) {
            console.error("[WildfirePlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 300000; // 5 minutes
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ef4444",
            clusterEnabled: true,
            clusterDistance: 30,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const frp = (entity.properties.frp as number) || 0;
        const tier = (entity.properties.tier as number) || 3;

        let distanceDisplayCondition: { near: number; far: number } | undefined;

        // Tier 1: Macro (visible from very far down to ~3,500km)
        if (tier === 1) distanceDisplayCondition = { near: 3500000, far: Number.POSITIVE_INFINITY };
        // Tier 2: Meso (visible from ~3,500km down to ~1,000km)
        else if (tier === 2) distanceDisplayCondition = { near: 1000000, far: 3500000 };
        // Tier 3: Micro (visible from ~1,000km to surface)
        else if (tier === 3) distanceDisplayCondition = { near: 0, far: 1000000 };

        return {
            type: "point",
            color: frpToColor(frp),
            size: frpToSize(frp) * (tier === 1 ? 2 : tier === 2 ? 1.5 : 1), // Make higher tiers slightly larger
            outlineColor: "#000000",
            outlineWidth: 1,
            distanceDisplayCondition,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "frp",
                label: "Fire Radiative Power (MW)",
                type: "range",
                propertyKey: "frp",
                range: { min: 0, max: 500, step: 10 },
            },
            {
                id: "confidence",
                label: "Confidence",
                type: "select",
                propertyKey: "confidence",
                options: [
                    { value: "low", label: "Low" },
                    { value: "nominal", label: "Nominal" },
                    { value: "high", label: "High" },
                ],
            },
            {
                id: "satellite",
                label: "Satellite",
                type: "select",
                propertyKey: "satellite",
                options: [
                    { value: "N", label: "Suomi NPP" },
                    { value: "1", label: "NOAA-20" },
                    { value: "2", label: "NOAA-21" },
                ],
            },
        ];
    }
}
