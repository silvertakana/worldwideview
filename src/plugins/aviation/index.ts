import { Plane } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";

interface OpenSkyState {
    icao24: string;
    callsign: string | null;
    origin_country: string;
    time_position: number | null;
    last_contact: number;
    longitude: number | null;
    latitude: number | null;
    baro_altitude: number | null;
    on_ground: boolean;
    velocity: number | null;
    true_track: number | null;
    vertical_rate: number | null;
    sensors: number[] | null;
    geo_altitude: number | null;
    squawk: string | null;
    spi: boolean;
    position_source: number;
}

function altitudeToColor(altitude: number | null): string {
    if (altitude === null || altitude <= 0) return "#4ade80"; // green — ground
    if (altitude < 3000) return "#22d3ee"; // cyan — low
    if (altitude < 8000) return "#3b82f6"; // blue — medium
    if (altitude < 12000) return "#a78bfa"; // purple — high
    return "#f472b6"; // pink — very high
}

export class AviationPlugin implements WorldPlugin {
    id = "aviation";
    name = "Aviation";
    description = "Real-time aircraft tracking via OpenSky Network";
    icon = Plane;
    category = "aviation" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
    }

    destroy(): void {
        this.context = null;
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        console.log(`[TIME] AviationPlugin.fetch started at ${performance.now()}`);
        try {
            const state = useStore.getState();
            let res;
            let data: any;

            if (state.isPlaybackMode) {
                res = await fetch(`/api/aviation/history?time=${state.currentTime.getTime()}`);
                if (!res.ok) throw new Error(`History API returned ${res.status}`);
                const historyData = await res.json();

                if (!historyData.records || !Array.isArray(historyData.records)) return [];

                return historyData.records.map((s: any): GeoEntity => {
                    return {
                        id: `aviation-history-${s.icao24}`,
                        pluginId: "aviation",
                        latitude: s.latitude,
                        longitude: s.longitude,
                        altitude: (s.altitude || 0) * 10, // Scale for visibility matching Live mode
                        heading: s.heading || undefined,
                        speed: s.speed || undefined,
                        timestamp: new Date(s.timestamp), // from DB
                        label: s.callsign || s.icao24,
                        properties: {
                            icao24: s.icao24,
                            callsign: s.callsign,
                            altitude_m: s.altitude,
                            velocity_ms: s.speed,
                            heading: s.heading,
                            on_ground: s.altitude === null || s.altitude <= 0,
                        },
                    };
                });
            } else {
                console.log(`[TIME] AviationPlugin API request starting at ${performance.now()}`);
                res = await fetch("/api/aviation");
                console.log(`[TIME] AviationPlugin API request finished at ${performance.now()} with status ${res.status}`);
                if (!res.ok) throw new Error(`Aviation API returned ${res.status}`);
                data = await res.json();

                if (data.error && !data.states) {
                    console.warn("[AviationPlugin] API Warning:", data.error);
                    return [];
                }

                if (data._isFallback) {
                    console.warn("[AviationPlugin] Warning: Using historical fallback data from Supabase due to live API rate-limiting.");
                }
            }

            if (!data.states || !Array.isArray(data.states)) return [];

            console.log(`[TIME] AviationPlugin processing ${data.states.length} states at ${performance.now()}`);
            const entities = data.states
                .filter((s: unknown[]) => s[6] !== null && s[5] !== null)
                .map((s: unknown[]): GeoEntity => {
                    const state: OpenSkyState = {
                        icao24: s[0] as string,
                        callsign: (s[1] as string)?.trim() || null,
                        origin_country: s[2] as string,
                        time_position: s[3] as number | null,
                        last_contact: s[4] as number,
                        longitude: s[5] as number | null,
                        latitude: s[6] as number | null,
                        baro_altitude: s[7] as number | null,
                        on_ground: s[8] as boolean,
                        velocity: s[9] as number | null,
                        true_track: s[10] as number | null,
                        vertical_rate: s[11] as number | null,
                        sensors: s[12] as number[] | null,
                        geo_altitude: s[13] as number | null,
                        squawk: s[14] as string | null,
                        spi: s[15] as boolean,
                        position_source: s[16] as number,
                    };

                    return {
                        id: `aviation-${state.icao24}`,
                        pluginId: "aviation",
                        latitude: state.latitude!,
                        longitude: state.longitude!,
                        altitude: (state.baro_altitude || 0) * 10, // Scale for visibility
                        heading: state.true_track || undefined,
                        speed: state.velocity || undefined,
                        timestamp: new Date(
                            (state.time_position || state.last_contact) * 1000
                        ),
                        label: state.callsign || state.icao24,
                        properties: {
                            icao24: state.icao24,
                            callsign: state.callsign,
                            origin_country: state.origin_country,
                            altitude_m: state.baro_altitude,
                            velocity_ms: state.velocity,
                            heading: state.true_track,
                            vertical_rate: state.vertical_rate,
                            on_ground: state.on_ground,
                            squawk: state.squawk,
                        },
                    };
                });
            console.log(`[TIME] AviationPlugin mapping entities finished at ${performance.now()}`);
            return entities;
        } catch (err) {
            console.error("[AviationPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 15000; // 15 seconds (matches OpenSky anon limit + backend cache)
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#3b82f6",
            clusterEnabled: true,
            clusterDistance: 40,
            maxEntities: 5000,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const alt = entity.properties.altitude_m as number | null;
        return {
            type: "point",
            color: altitudeToColor(alt),
            size: entity.properties.on_ground ? 4 : 6,
            rotation: entity.heading,
            outlineColor: "#000000",
            outlineWidth: 1,
            labelText: entity.label || undefined,
            labelFont: "11px JetBrains Mono, monospace",
        };
    }
}
