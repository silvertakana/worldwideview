import { Satellite } from "lucide-react";
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

/** Color map by CelesTrak group. */
const GROUP_COLORS: Record<string, string> = {
    stations: "#00fff7",
    visual: "#f0abfc",
    weather: "#a78bfa",
    "gps-ops": "#22c55e",
    resource: "#f97316",
    starlink: "#ffffff",
    military: "#3b82f6",
};

function groupColor(group: string): string {
    return GROUP_COLORS[group] ?? "#94a3b8";
}

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

export class SatellitePlugin implements WorldPlugin {
    id = "satellite";
    name = "Satellites";
    description = "Real-time satellite tracking (ISS, GPS, weather, military)";
    icon = Satellite;
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
            const res = await globalThis.fetch(`/api/external/satellite`);
            if (!res.ok) throw new Error(`Satellite API returned ${res.status}`);
            const data = await res.json();
            const satelliteItems = data.satellites || data.items || [];
            if (!satelliteItems || !Array.isArray(satelliteItems)) return [];

            return satelliteItems.map(
                (sat: SatelliteResponse): GeoEntity => ({
                    id: `satellite-${sat.noradId}`,
                    pluginId: "satellite",
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
                        group: sat.group,
                        country: sat.country,
                        objectType: sat.objectType,
                        altitudeKm: sat.altitude,
                        period: sat.period,
                    },
                }),
            );
        } catch (err) {
            console.error("[SatellitePlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 0; // WS Streaming
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#00fff7",
            clusterEnabled: false, // satellites are spread out; clustering looks wrong
            clusterDistance: 0,
            maxEntities: 1000,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const group = (entity.properties.group as string) || "";
        const isStation = group === "stations";
        const color = groupColor(group);

        if (!this.iconUrls[color]) {
            this.iconUrls[color] = createSvgIconUrl(Satellite, { color });
        }

        return {
            type: "billboard", iconUrl: this.iconUrls[color], color,
            size: isStation ? 12 : 6,
            outlineColor: "#000000",
            outlineWidth: 1,
            labelText: isStation ? entity.label : undefined,
            labelFont: "12px sans-serif",
            disableManualHorizonCulling: true,
            disableDepthTestDistance: 0,
        };
    }

    getSelectionBehavior(_entity: GeoEntity): SelectionBehavior | null {
        return {
            showTrail: true,
            trailDurationSec: 300, // 5 minute trail (shows orbital arc)
            trailStepSec: 10,
            trailColor: "#00fff7",
            flyToOffsetMultiplier: 4,
            flyToBaseDistance: 2000000, // 2000 km
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "group",
                label: "Satellite Group",
                type: "select",
                propertyKey: "group",
                options: [
                    { value: "stations", label: "Space Stations" },
                    { value: "visual", label: "Brightest Satellites" },
                    { value: "weather", label: "Weather" },
                    { value: "gps-ops", label: "GPS" },
                    { value: "resource", label: "Earth Observation" },
                ],
            },
        ];
    }

    getLegend(): { label: string; color: string; filterId?: string; filterValue?: string }[] {
        return [
            { label: "Space Stations", color: groupColor("stations"), filterId: "group", filterValue: "stations" },
            { label: "Brightest Satellites", color: groupColor("visual"), filterId: "group", filterValue: "visual" },
            { label: "Weather", color: groupColor("weather"), filterId: "group", filterValue: "weather" },
            { label: "GPS", color: groupColor("gps-ops"), filterId: "group", filterValue: "gps-ops" },
            { label: "Earth Observation", color: groupColor("resource"), filterId: "group", filterValue: "resource" },
            { label: "Starlink", color: groupColor("starlink"), filterId: "group", filterValue: "starlink" },
            { label: "Military", color: groupColor("military"), filterId: "group", filterValue: "military" },
            { label: "Other", color: groupColor("other"), filterId: "group", filterValue: "other" },
        ];
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/external/satellite",
            pollingIntervalMs: 0,
            historyEnabled: true,
        };
    }
}
