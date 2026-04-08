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

    private mapPayloadToEntities(payloadData: any, existingEntities?: GeoEntity[]): GeoEntity[] {
        const currentMap = new Map(existingEntities?.map(e => [e.id, e]) || []);
        let vessels: any[] = [];
        
        if (Array.isArray(payloadData)) {
            vessels = payloadData;
        } else if (payloadData && typeof payloadData === 'object') {
            vessels = Object.values(payloadData);
        } else {
            return [];
        }

        return vessels.map((v: any) => {
            const entityId = `maritime-${v.mmsi || v.id}`;
            const existing = currentMap.get(entityId);
            
            // Maintain and append to history natively here, reducing database load
            // Fallback to v.history (for API pull) or existing history (for WS pull)
            const history = v.history || (v.properties && v.properties.history) || existing?.properties.history || [];
            
            if (v.last_updated || v.ts) {
                const currentTs = v.last_updated || v.ts;
                const lastTs = history.length > 0 ? history[history.length - 1].ts : 0;
                
                // Only push if time strictly advanced
                if (currentTs > lastTs && (v.lat ?? v.latitude) !== undefined && (v.lon ?? v.longitude) !== undefined) {
                    history.push({ lat: v.lat ?? v.latitude, lon: v.lon ?? v.longitude, ts: currentTs });
                }
            }
            
            // Limit bounds to avoid OOM for 50,000 ships
            if (history.length > 61) history.splice(0, history.length - 61); // ~1 hour of minute-level updates

            return {
                id: entityId,
                pluginId: "maritime",
                latitude: v.lat ?? v.latitude,
                longitude: v.lon ?? v.longitude,
                heading: v.hdg === 511 ? undefined : (v.hdg ?? v.heading),
                speed: v.spd !== undefined ? v.spd * 0.514444 : (v.speed !== undefined ? v.speed * 0.514444 : undefined),
                timestamp: v.last_updated ? new Date(v.last_updated * 1000) : new Date(v.timestamp || Date.now()),
                label: v.name ?? v.label,
                properties: { 
                    mmsi: v.mmsi, 
                    vesselName: v.name, 
                    vesselType: v.type || (v.properties && v.properties.vesselType) || "other", 
                    speed_knots: v.spd ?? v.speed, 
                    heading: v.hdg ?? v.heading,
                    history: history
                },
            };
        });
    }

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
            return this.mapPayloadToEntities(data.items);
        } catch (err) {
            console.error("[MaritimePlugin] Fetch error:", err);
            return [];
        }
    }

    mapWebsocketPayload(payload: any, existingEntities?: GeoEntity[]): GeoEntity[] {
        return this.mapPayloadToEntities(payload, existingEntities);
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
            trailOptions: {
                width: 2,
                color: color,
                opacityFade: true
            }
        };
    }

    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null {
        if (!entity.speed || entity.speed < 0.1) return null; // No generated trails for moored ships
        
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
