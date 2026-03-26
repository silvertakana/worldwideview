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

interface OpenSkyState {
    icao24: string; callsign: string | null; origin_country: string;
    time_position: number | null; last_contact: number;
    longitude: number | null; latitude: number | null;
    baro_altitude: number | null; on_ground: boolean;
    velocity: number | null; true_track: number | null;
    vertical_rate: number | null; sensors: number[] | null;
    geo_altitude: number | null; squawk: string | null;
    spi: boolean; position_source: number;
}

function altitudeToColor(altitude: number | null): string {
    if (altitude === null || altitude <= 0) return "#4ade80";
    if (altitude < 3000) return "#22d3ee";
    if (altitude < 8000) return "#3b82f6";
    if (altitude < 12000) return "#a78bfa";
    return "#f472b6";
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

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            // Use PluginContext instead of direct useStore access
            if (this.context!.isPlaybackMode()) {
                const time = this.context!.getCurrentTime().getTime();
                const res = await fetch(`/api/aviation/history?time=${time}`);
                if (!res.ok) throw new Error(`History API returned ${res.status}`);
                const historyData = await res.json();
                if (!historyData.records || !Array.isArray(historyData.records)) return [];
                return historyData.records.map((s: Record<string, unknown>): GeoEntity => ({
                    id: `aviation-history-${s.icao24}`,
                    pluginId: "aviation",
                    latitude: s.latitude as number,
                    longitude: s.longitude as number,
                    altitude: ((s.altitude as number) || 0) * 10,
                    heading: (s.heading as number) || undefined,
                    speed: (s.speed as number) || undefined,
                    timestamp: new Date(s.timestamp as string),
                    label: (s.callsign as string) || (s.icao24 as string),
                    properties: { icao24: s.icao24, callsign: s.callsign, altitude_m: s.altitude, velocity_ms: s.speed, heading: s.heading, on_ground: (s.altitude as number) === null || (s.altitude as number) <= 0 },
                }));
            }

            const res = await fetch("/api/aviation");
            if (!res.ok) throw new Error(`Aviation API returned ${res.status}`);
            const data = await res.json();
            if (data.error && !data.states) return [];
            if (!data.states || !Array.isArray(data.states)) return [];

            return data.states
                .filter((s: unknown[]) => s[6] !== null && s[5] !== null)
                .map((s: unknown[]): GeoEntity => {
                    const st: OpenSkyState = {
                        icao24: s[0] as string, callsign: (s[1] as string)?.trim() || null,
                        origin_country: s[2] as string, time_position: s[3] as number | null,
                        last_contact: s[4] as number, longitude: s[5] as number | null,
                        latitude: s[6] as number | null, baro_altitude: s[7] as number | null,
                        on_ground: s[8] as boolean, velocity: s[9] as number | null,
                        true_track: s[10] as number | null, vertical_rate: s[11] as number | null,
                        sensors: s[12] as number[] | null, geo_altitude: s[13] as number | null,
                        squawk: s[14] as string | null, spi: s[15] as boolean, position_source: s[16] as number,
                    };
                    return {
                        id: `aviation-${st.icao24}`, pluginId: "aviation",
                        latitude: st.latitude!, longitude: st.longitude!,
                        altitude: (st.baro_altitude || 0) * 10,
                        heading: st.true_track || undefined, speed: st.velocity || undefined,
                        timestamp: new Date((st.time_position || st.last_contact) * 1000),
                        label: st.callsign || st.icao24,
                        properties: { icao24: st.icao24, callsign: st.callsign, origin_country: st.origin_country, altitude_m: st.baro_altitude, velocity_ms: st.velocity, heading: st.true_track, vertical_rate: st.vertical_rate, on_ground: st.on_ground, squawk: st.squawk },
                    };
                });
        } catch (err) {
            console.error("[AviationPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number { return 15000; }
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
            { label: "Airborne", color: "#f59e0b", filterId: "state", filterValue: "airborne" },
            { label: "Grounded", color: "#94a3b8", filterId: "state", filterValue: "grounded" },
        ];
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            { id: "origin_country", label: "Country", type: "select", propertyKey: "origin_country", options: [{ value: "United States", label: "United States" }, { value: "China", label: "China" }, { value: "United Kingdom", label: "United Kingdom" }, { value: "Germany", label: "Germany" }, { value: "France", label: "France" }, { value: "Japan", label: "Japan" }, { value: "Australia", label: "Australia" }, { value: "Canada", label: "Canada" }, { value: "India", label: "India" }, { value: "Brazil", label: "Brazil" }, { value: "Russia", label: "Russia" }, { value: "Turkey", label: "Turkey" }, { value: "South Korea", label: "South Korea" }, { value: "Indonesia", label: "Indonesia" }, { value: "Mexico", label: "Mexico" }] },
            { id: "altitude", label: "Altitude (m)", type: "range", propertyKey: "altitude_m", range: { min: 0, max: 15000, step: 500 } },
            { id: "on_ground", label: "On Ground", type: "boolean", propertyKey: "on_ground" },
            { id: "callsign", label: "Callsign", type: "text", propertyKey: "callsign" },
        ];
    }
}
