import { Plane } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
    SelectionBehavior,
    ServerPluginConfig,
    FilterDefinition,
} from "@worldwideview/wwv-plugin-sdk";



function altitudeToColor(altitude: number | null): string {
    if (altitude === null || altitude <= 0) return "#4ade80";
    if (altitude < 3000) return "#22d3ee";
    if (altitude < 8000) return "#3b82f6";
    if (altitude < 12000) return "#a78bfa";
    return "#f472b6";
}

function getAltitudeBand(altitude: number | null): string {
    if (altitude === null || altitude <= 0) return "grounded";
    if (altitude < 3000) return "low";
    if (altitude < 8000) return "mid";
    if (altitude < 12000) return "high";
    return "extreme";
}

export class AviationPlugin implements WorldPlugin {
    id = "aviation";
    name = "Aviation";
    description = "Real-time aircraft tracking via OpenSky Network";
    icon = Plane;
    category = "aviation" as const;
    version = "1.0.0";
    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.context = null; }

    private mapPayloadToEntities(payloadData: any): GeoEntity[] {
        let aircraftList: any[] = [];
        if (Array.isArray(payloadData)) {
            aircraftList = payloadData;
        } else if (payloadData && typeof payloadData === 'object') {
            aircraftList = Object.values(payloadData);
        } else {
            return [];
        }

        return aircraftList.map((st: any): GeoEntity => {
            return {
                id: `aviation-${st.icao24}`, pluginId: "aviation",
                latitude: st.lat, longitude: st.lon,
                altitude: (st.alt || 0) * 10,
                heading: st.hdg || undefined, speed: st.spd || undefined,
                timestamp: new Date(st.ts ? st.ts * 1000 : Date.now()),
                label: st.callsign || st.icao24,
                properties: {
                    icao24: st.icao24,
                    callsign: st.callsign,
                    origin_country: st.origin_country,
                    altitude_m: st.alt,
                    altitude_band: getAltitudeBand(st.alt || 0),
                    velocity_ms: st.spd,
                    heading: st.hdg,
                    vertical_rate: st.vertical_rate,
                    on_ground: st.on_ground,
                    squawk: st.squawk
                },
            };
        });
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            let res: Response;
            
            if (this.context!.isPlaybackMode()) {
                const timeStr = this.context!.getCurrentTime().getTime();
                res = await fetch(`/api/external/aviation?time=${timeStr}`);
            } else {
                res = await fetch("/api/external/aviation?lookback=15m");
            }
            
            if (!res.ok) throw new Error(`Data Engine API returned ${res.status}`);
            const data = await res.json();
            
            return this.mapPayloadToEntities(data.items);
        } catch (err: any) {
            console.error("[AviationPlugin] Fetch error:", err);
            if (this.context?.onError) this.context.onError(err);
            return [];
        }
    }

    mapWebsocketPayload(payload: any): GeoEntity[] {
        return this.mapPayloadToEntities(payload);
    }

    getPollingInterval(): number {
        return 0; // Disabled in favor of WebSocket firehose
    }
    getLayerConfig(): LayerConfig { return { color: "#3b82f6", clusterEnabled: true, clusterDistance: 40, maxEntities: 5000 }; }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const alt = entity.properties.altitude_m as number | null;
        const isAirborne = !entity.properties.on_ground;
        return {
            type: "model", iconUrl: "/plane-icon.svg", size: isAirborne ? 8 : 5,
            modelUrl: "/airplane/scene.gltf", modelScale: 75, modelMinPixelSize: 16, modelHeadingOffset: 180,
            color: altitudeToColor(alt), rotation: entity.heading,
            labelText: entity.label || undefined, labelFont: "11px JetBrains Mono, monospace",
        };
    }

    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null {
        if (entity.properties.on_ground) return null;
        return { showTrail: true, trailDurationSec: 60, trailStepSec: 5, trailColor: "#00fff7", flyToOffsetMultiplier: 3, flyToBaseDistance: 30000 };
    }

    getServerConfig(): ServerPluginConfig {
        return { apiBasePath: "/api/aviation", pollingIntervalMs: 5000, requiresAuth: true, historyEnabled: true, availabilityEnabled: true };
    }

    getLegend(): { label: string; color: string; filterId?: string; filterValue?: string }[] {
        return [
            { label: "0 m (Grounded)", color: "#4ade80", filterId: "altitude_band", filterValue: "grounded" },
            { label: "< 3,000 m", color: "#22d3ee", filterId: "altitude_band", filterValue: "low" },
            { label: "3,000 - 8,000 m", color: "#3b82f6", filterId: "altitude_band", filterValue: "mid" },
            { label: "8,000 - 12,000 m", color: "#a78bfa", filterId: "altitude_band", filterValue: "high" },
            { label: "> 12,000 m", color: "#f472b6", filterId: "altitude_band", filterValue: "extreme" },
        ];
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            { id: "origin_country", label: "Country", type: "select", propertyKey: "origin_country", options: [{ value: "United States", label: "United States" }, { value: "China", label: "China" }, { value: "United Kingdom", label: "United Kingdom" }, { value: "Germany", label: "Germany" }, { value: "France", label: "France" }, { value: "Japan", label: "Japan" }, { value: "Australia", label: "Australia" }, { value: "Canada", label: "Canada" }, { value: "India", label: "India" }, { value: "Brazil", label: "Brazil" }, { value: "Russia", label: "Russia" }, { value: "Turkey", label: "Turkey" }, { value: "South Korea", label: "South Korea" }, { value: "Indonesia", label: "Indonesia" }, { value: "Mexico", label: "Mexico" }] },
            { id: "altitude", label: "Altitude (m)", type: "range", propertyKey: "altitude_m", range: { min: 0, max: 15000, step: 500 } },
            {
                id: "altitude_band", label: "Altitude Category", type: "select", propertyKey: "altitude_band",
                options: [
                    { value: "grounded", label: "0 m (Grounded)" },
                    { value: "low", label: "< 3,000 m" },
                    { value: "mid", label: "3,000 - 8,000 m" },
                    { value: "high", label: "8,000 - 12,000 m" },
                    { value: "extreme", label: "> 12,000 m" },
                ]
            },
            { id: "on_ground", label: "On Ground", type: "boolean", propertyKey: "on_ground" },
            { id: "callsign", label: "Callsign", type: "text", propertyKey: "callsign" },
        ];
    }
}
