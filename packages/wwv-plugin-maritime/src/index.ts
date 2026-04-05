import { Ship } from "lucide-react";
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
    type SelectionBehavior,
} from "@worldwideview/wwv-plugin-sdk";
import { MaritimeSettings } from "./MaritimeSettings";

const VESSEL_COLORS: Record<string, string> = {
    cargo: "#f59e0b",
    tanker: "#ef4444",
    passenger: "#3b82f6",
    fishing: "#22d3ee",
    military: "#a78bfa",
    sailing: "#4ade80",
    tug: "#f97316",
    other: "#94a3b8",
};

function getVesselColor(type: string): string {
    const lower = type.toLowerCase();
    for (const [key, color] of Object.entries(VESSEL_COLORS)) {
        if (lower.includes(key)) return color;
    }
    return VESSEL_COLORS.other;
}



export class MaritimePlugin implements WorldPlugin {
    id = "maritime";
    name = "Maritime";
    description = "Vessel tracking via AIS feeds";
    icon = Ship;
    category = "maritime" as const;
    version = "1.0.0";
    private context: PluginContext | null = null;
    private iconUrls: Record<string, string> = {};

    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.context = null; }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            let lookback = "1h";
            if (this.context) {
                const rawSettings = this.context.getPluginSettings<Record<string, unknown>>(this.id);
                if (rawSettings && rawSettings.trailDuration) {
                    lookback = rawSettings.trailDuration as string;
                }
            }
            if (lookback === "0h") lookback = "";
            const query = lookback ? `?lookback=${lookback}` : "";
            
            const res = await fetch(`/api/external/maritime${query}`);
            if (!res.ok) throw new Error(`Maritime API returned ${res.status}`);
            const data = await res.json();
            const vessels = data.items || [];
            return vessels.map((v: any) => {
                // Handle both GeoEntity structure and data-engine structure
                return {
                    id: `maritime-${v.mmsi || v.id}`,
                    pluginId: "maritime",
                    latitude: v.lat ?? v.latitude,
                    longitude: v.lon ?? v.longitude,
                    heading: v.hdg ?? v.heading,
                    speed: v.spd ?? v.speed,
                    timestamp: v.last_updated ? new Date(v.last_updated * 1000) : new Date(v.timestamp || Date.now()),
                    label: v.name ?? v.label,
                    properties: { 
                        mmsi: v.mmsi, 
                        vesselName: v.name, 
                        vesselType: v.type || (v.properties && v.properties.vesselType) || "other", 
                        speed_knots: v.spd ?? v.speed, 
                        heading: v.hdg ?? v.heading,
                        history: v.history || (v.properties && v.properties.history) || []
                    },
                };
            });
        } catch (err) {
            console.error("[MaritimePlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 0; // Disabled in favor of WebSocket firehose
    }

    getServerConfig(): ServerPluginConfig {
        return { apiBasePath: "/api/external/maritime", pollingIntervalMs: 0, historyEnabled: true };
    }

    getLayerConfig(): LayerConfig {
        return { color: "#f59e0b", clusterEnabled: true, clusterDistance: 50 };
    }
    
    getSettingsComponent() {
        return MaritimeSettings;
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const vesselType = (entity.properties.vesselType as string) || "other";
        const color = getVesselColor(vesselType);
        if (!this.iconUrls[color]) {
            this.iconUrls[color] = createSvgIconUrl(Ship, { color });
        }
        return {
            type: "billboard", iconUrl: this.iconUrls[color], color,
            rotation: entity.heading,
            labelText: entity.label || undefined, labelFont: "11px JetBrains Mono, monospace",
            distanceDisplayCondition: { near: 0, far: 1000000 },
        };
    }

    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null {
        return {
            showTrail: true,
            trailDurationSec: 3600,
            trailStepSec: 60,
            trailColor: getVesselColor((entity.properties.vesselType as string) || "other"),
            flyToOffsetMultiplier: 3,
            flyToBaseDistance: 15000,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "vessel_type", label: "Vessel Type", type: "select", propertyKey: "vesselType",
                options: [
                    { value: "cargo", label: "Cargo" }, { value: "tanker", label: "Tanker" },
                    { value: "passenger", label: "Passenger" }, { value: "fishing", label: "Fishing" },
                    { value: "military", label: "Military" }, { value: "sailing", label: "Sailing" },
                    { value: "tug", label: "Tug" }, { value: "other", label: "Other" },
                ],
            },
            { id: "speed", label: "Speed (knots)", type: "range", propertyKey: "speed_knots", range: { min: 0, max: 30, step: 1 } },
        ];
    }

    getLegend(): { label: string; color: string; filterId?: string; filterValue?: string }[] {
        return [
            { label: "Cargo", color: VESSEL_COLORS.cargo, filterId: "vessel_type", filterValue: "cargo" },
            { label: "Tanker", color: VESSEL_COLORS.tanker, filterId: "vessel_type", filterValue: "tanker" },
            { label: "Passenger", color: VESSEL_COLORS.passenger, filterId: "vessel_type", filterValue: "passenger" },
            { label: "Fishing", color: VESSEL_COLORS.fishing, filterId: "vessel_type", filterValue: "fishing" },
            { label: "Military", color: VESSEL_COLORS.military, filterId: "vessel_type", filterValue: "military" },
            { label: "Sailing", color: VESSEL_COLORS.sailing, filterId: "vessel_type", filterValue: "sailing" },
            { label: "Tug", color: VESSEL_COLORS.tug, filterId: "vessel_type", filterValue: "tug" },
            { label: "Other", color: VESSEL_COLORS.other, filterId: "vessel_type", filterValue: "other" },
        ];
    }
}
