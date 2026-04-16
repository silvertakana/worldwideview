import { Radar } from "lucide-react";
import {
    type WorldPlugin,
    type GeoEntity,
    type TimeRange,
    type PluginContext,
    type LayerConfig,
    type CesiumEntityOptions,
    type SelectionBehavior,
    type ServerPluginConfig,
    type FilterDefinition,
    createSvgIconUrl,
} from "@worldwideview/wwv-plugin-sdk";

interface SatelliteResponse {
    noradId: number;
    name: string;
    latitude: number;
    longitude: number;
    altitude: number;
    heading: number;
    speed: number;
    group: string;
    country?: string;
    objectType?: string;
    period?: number;
}

export class SurveillanceSatellitesPlugin implements WorldPlugin {
    id = "surveillance-satellites";
    name = "Surveillance Satellites";
    description = "Active military and reconnaissance satellite tracking";
    icon = Radar;
    category = "infrastructure" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;
    private iconUrls: Record<string, string> = {};

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
    }

    destroy(): void {
        this.context = null;
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const engineBase = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL
                ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, '').replace(/^ws/, 'http')
                : 'http://localhost:5001';
            const res = await globalThis.fetch(`${engineBase}/data/surveillance_satellites`);
            if (!res.ok) throw new Error(`Satellite API returned ${res.status}`);
            const data = await res.json();
            const surveillanceSats = data.satellites || data.items || [];
            if (!surveillanceSats || !Array.isArray(surveillanceSats)) return [];

            return surveillanceSats.map(
                (sat: SatelliteResponse): GeoEntity => ({
                    id: `surv-sat-${sat.noradId}`,
                    pluginId: "surveillance-satellites",
                    latitude: sat.latitude,
                    longitude: sat.longitude,
                    altitude: sat.altitude * 1000, // km → meters
                    heading: sat.heading,
                    speed: sat.speed,
                    timestamp: new Date(),
                    label: sat.name,
                    properties: {
                        noradId: sat.noradId,
                        name: sat.name,
                        group: sat.group === "military" ? "Military" : "Recon",
                        country: sat.country || "Unknown",
                        objectType: sat.objectType,
                        altitudeKm: Math.round(sat.altitude),
                        speedKph: Math.round(sat.speed * 3.6),
                        period: sat.period,
                    },
                }),
            );
        } catch (err) {
            console.error("[SurveillanceSatellitesPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 0; // WebSocket streaming, or handles live polling on its own
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ef4444",
            clusterEnabled: false,
            clusterDistance: 0,
            maxEntities: 1000,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const group = entity.properties.group as string;
        const color = group === "Military" ? "#3b82f6" : "#f97316";

        if (!this.iconUrls[color]) {
            this.iconUrls[color] = createSvgIconUrl(Radar, { color });
        }

        return {
            type: "billboard",
            iconUrl: this.iconUrls[color],
            color,
            size: 8,
            outlineColor: "#000000",
            outlineWidth: 1,
            labelText: entity.label,
            labelFont: "12px sans-serif",
            disableManualHorizonCulling: true,
            disableDepthTestDistance: 0,
        };
    }

    getSelectionBehavior(_entity: GeoEntity): SelectionBehavior | null {
        return {
            showTrail: true,
            trailDurationSec: 300,
            trailStepSec: 10,
            trailColor: "#ef4444",
            flyToOffsetMultiplier: 4,
            flyToBaseDistance: 2000000,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "group",
                label: "Mission Type",
                type: "select",
                propertyKey: "group",
                options: [
                    { value: "Military", label: "Military Operations" },
                    { value: "Recon", label: "Reconnaissance" },
                ],
            },
        ];
    }

    getLegend() {
        return [
            { label: "Military Satellites", color: "#3b82f6", filterId: "group", filterValue: "Military" },
            { label: "Reconnaissance", color: "#f97316", filterId: "group", filterValue: "Recon" }
        ];
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/surveillance_satellites",
            pollingIntervalMs: 0,
            historyEnabled: true,
        };
    }
}
