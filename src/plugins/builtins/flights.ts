/**
 * Flights Plugin — Live aircraft positions from OpenSky Network (anonymous).
 * Uses a CORS proxy chain for browser-side access.
 * Refresh: every 60 seconds.
 */
import { Plane } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";
import { fetchViaProxy } from "./proxy-utils";

const OPENSKY_URL = "https://opensky-network.org/api/states/all";
const MAX_AIRCRAFT = 500;

// Aircraft type icon - simple plane SVG
const PLANE_ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="15" fill="rgba(15,23,42,0.85)"/>
  <path d="M16 4 L20 14 L28 14 L24 18 L26 28 L16 22 L6 28 L8 18 L4 14 L12 14 Z"
        fill="#60a5fa" stroke="#93c5fd" stroke-width="0.5"/>
</svg>
`);

function stateToEntity(state: any[]): GeoEntity | null {
    // OpenSky state vector: [icao24, callsign, origin_country, time_position, last_contact,
    //   longitude, latitude, baro_altitude, on_ground, velocity, true_track, vertical_rate,
    //   sensors, geo_altitude, squawk, spi, position_source]
    const [icao24, callsign, country, , , lon, lat, baroAlt, onGround, velocity, trueTrack] = state;

    if (onGround) return null;
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    if (lat === 0 && lon === 0) return null;

    const altFt = baroAlt != null ? Math.round(baroAlt * 3.28084) : 0;
    const speedKt = velocity != null ? Math.round(velocity * 1.94384) : 0;
    const heading = typeof trueTrack === "number" ? trueTrack : 0;

    return {
        id: `flight-${icao24}`,
        pluginId: "flights",
        latitude: lat,
        longitude: lon,
        altitude: baroAlt ?? 0,
        heading,
        speed: speedKt,
        timestamp: new Date(),
        label: (callsign?.trim() || icao24).toUpperCase(),
        properties: {
            icao24,
            callsign: callsign?.trim() || icao24,
            country: country || "Unknown",
            altitudeFt: altFt,
            speedKnots: speedKt,
            heading,
        },
    };
}

class FlightsPlugin implements WorldPlugin {
    id = "flights";
    name = "Live Flights";
    description = "Real-time global aircraft positions from OpenSky Network (anonymous)";
    icon = Plane;
    category = "aviation" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {}
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetchViaProxy(OPENSKY_URL);
            const data: { states?: any[][] } = await res.json();
            if (!data.states) return [];

            const entities: GeoEntity[] = [];
            for (const state of data.states) {
                if (entities.length >= MAX_AIRCRAFT) break;
                const entity = stateToEntity(state);
                if (entity) entities.push(entity);
            }
            return entities;
        } catch {
            return [];
        }
    }

    getPollingInterval(): number {
        return 60_000; // 60 seconds
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#60a5fa",
            iconUrl: PLANE_ICON,
            clusterEnabled: true,
            clusterDistance: 30,
            maxEntities: MAX_AIRCRAFT,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        return {
            type: "billboard",
            iconUrl: PLANE_ICON,
            iconScale: 0.7,
            rotation: entity.heading ?? 0,
            color: "#60a5fa",
            disableDepthTestDistance: 1,
        };
    }
}

export const flightsPlugin = new FlightsPlugin();
