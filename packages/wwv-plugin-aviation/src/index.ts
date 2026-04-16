import { Plane } from "lucide-react";
import type {
    GeoEntity,
    TimeRange,
    ServerPluginConfig,
    FilterDefinition,
} from "@worldwideview/wwv-plugin-sdk";
import { BaseAviationPlugin } from "@worldwideview/wwv-lib-aviation";

function getAltitudeBand(altitude: number | null): string {
    if (altitude === null || altitude <= 0) return "grounded";
    if (altitude < 3000) return "low";
    if (altitude < 8000) return "mid";
    if (altitude < 12000) return "high";
    return "extreme";
}

export class AviationPlugin extends BaseAviationPlugin {
    id = "aviation";
    name = "Aviation";
    description = "Real-time aircraft tracking via OpenSky Network";
    icon = Plane;
    version = "1.0.8";

    protected getAltitudeColor(altitude: number | null): string {
        if (altitude === null || altitude <= 0) return "#4ade80";
        if (altitude < 3000) return "#22d3ee";
        if (altitude < 8000) return "#3b82f6";
        if (altitude < 12000) return "#a78bfa";
        return "#f472b6";
    }

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
            const rawTs = st.ts || st.time_position || st.last_contact || st.last_updated;
            return {
                id: `aviation-${st.icao24}`, pluginId: "aviation",
                latitude: st.lat, longitude: st.lon,
                altitude: (st.alt || 0) * 10,
                heading: st.hdg || undefined, speed: st.spd || undefined,
                timestamp: new Date(rawTs ? rawTs * 1000 : Date.now()),
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
            const engineBase = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL
                ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, '').replace(/^ws/, 'http')
                : 'http://localhost:5001';

            let res: Response;
            if (this.context!.isPlaybackMode()) {
                const timeStr = this.context!.getCurrentTime().getTime();
                res = await fetch(`${engineBase}/data/aviation?time=${timeStr}`);
            } else {
                res = await fetch(`${engineBase}/data/aviation?lookback=15m`);
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
