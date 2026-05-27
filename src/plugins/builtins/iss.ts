/**
 * ISS Tracker Plugin — International Space Station real-time position.
 * Uses the local /api/iss proxy (backed by wheretheiss.at).
 * Updates every 5 seconds.
 */
import { Satellite } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";

const ISS_ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="17" fill="rgba(15,23,42,0.9)"/>
  <!-- ISS body -->
  <rect x="14" y="16" width="8" height="4" rx="1" fill="#e2e8f0"/>
  <!-- Solar panels left -->
  <rect x="2"  y="14" width="10" height="3" rx="0.5" fill="#fbbf24"/>
  <rect x="2"  y="19" width="10" height="3" rx="0.5" fill="#fbbf24"/>
  <!-- Solar panels right -->
  <rect x="24" y="14" width="10" height="3" rx="0.5" fill="#fbbf24"/>
  <rect x="24" y="19" width="10" height="3" rx="0.5" fill="#fbbf24"/>
  <!-- Glow -->
  <circle cx="18" cy="18" r="5" fill="none" stroke="#fbbf2480" stroke-width="2"/>
</svg>
`);

class ISSPlugin implements WorldPlugin {
    id = "iss";
    name = "ISS Tracker";
    description = "International Space Station real-time position — updates every 5 seconds";
    icon = Satellite;
    category = "space" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {}
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetch("/api/iss", { signal: AbortSignal.timeout(6000) });
            if (!res.ok) {
                // Fallback to open-notify (may have CORS issues in browser)
                const fallback = await fetch("http://api.open-notify.org/iss-now.json", {
                    signal: AbortSignal.timeout(5000),
                });
                if (!fallback.ok) return [];
                const fd = await fallback.json();
                const pos = fd.iss_position;
                if (!pos) return [];
                return [this.buildEntity(
                    parseFloat(pos.latitude),
                    parseFloat(pos.longitude),
                    420,   // ~420 km typical ISS altitude
                    7.66,  // ~7.66 km/s typical velocity
                )];
            }

            const data = await res.json();
            if (typeof data.latitude !== "number") return [];

            return [this.buildEntity(
                data.latitude,
                data.longitude,
                data.altitude ?? 420,
                data.velocity ?? 7.66,
            )];
        } catch {
            return [];
        }
    }

    private buildEntity(lat: number, lon: number, altKm: number, velocityKms: number): GeoEntity {
        const speedKnots = Math.round(velocityKms * 1.94384);
        return {
            id: "iss-25544",
            pluginId: "iss",
            latitude: lat,
            longitude: lon,
            altitude: altKm * 1000, // convert km to meters
            speed: speedKnots,
            timestamp: new Date(),
            label: "🛸 ISS",
            properties: {
                name: "ISS (ZARYA)",
                altitudeKm: Math.round(altKm),
                velocityKms: velocityKms.toFixed(2),
                speedKnots,
                latitude: lat.toFixed(4),
                longitude: lon.toFixed(4),
            },
        };
    }

    getPollingInterval(): number {
        return 5_000; // 5 seconds
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#fbbf24",
            iconUrl: ISS_ICON,
            clusterEnabled: false,
            clusterDistance: 0,
            maxEntities: 1,
        };
    }

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return {
            type: "billboard",
            iconUrl: ISS_ICON,
            iconScale: 1.0,
            color: "#fbbf24",
            disableDepthTestDistance: 1,
            disableManualHorizonCulling: true, // ISS is above the horizon from most viewpoints
        };
    }
}

export const issPlugin = new ISSPlugin();
