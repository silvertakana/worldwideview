/**
 * Earthquakes Plugin — Real-time seismic events from USGS GeoJSON feed.
 * Uses the local /api/earthquake proxy route to avoid CORS issues.
 * Refresh: every 5 minutes.
 */
import { Activity } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";

function magnitudeColor(mag: number): string {
    if (mag >= 5) return "#7f1d1d";   // dark red
    if (mag >= 4) return "#ea580c";   // orange
    if (mag >= 3) return "#d97706";   // amber
    return "#fde047";                  // yellow
}

function magnitudeSize(mag: number): number {
    if (mag >= 5) return 18;
    if (mag >= 4) return 12;
    if (mag >= 3) return 8;
    return 6;
}

class EarthquakesPlugin implements WorldPlugin {
    id = "earthquakes";
    name = "Earthquakes";
    description = "Real-time global seismic events (M1.0+) from USGS GeoJSON feed";
    icon = Activity;
    category = "natural-disaster" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {}
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            // Use our local proxy route to avoid CORS issues with USGS
            const res = await fetch("/api/earthquake", { signal: AbortSignal.timeout(10000) });
            if (!res.ok) {
                // Fallback: try direct USGS URL (works server-side, may fail client-side)
                const fallback = await fetch(
                    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
                    { signal: AbortSignal.timeout(10000) }
                );
                if (!fallback.ok) return [];
                const data = await fallback.json();
                return this.parseFeatures(data.features ?? []);
            }
            const data = await res.json();
            return this.parseFeatures(data.features ?? []);
        } catch {
            return [];
        }
    }

    private parseFeatures(features: any[]): GeoEntity[] {
        return features
            .filter((f) => {
                const coords = f?.geometry?.coordinates;
                return Array.isArray(coords) && coords.length >= 2
                    && typeof coords[0] === "number" && typeof coords[1] === "number";
            })
            .map((f) => {
                const [lon, lat, depth] = f.geometry.coordinates;
                const mag = f.properties?.mag ?? 0;
                const place = f.properties?.place ?? "Unknown";
                const time = f.properties?.time ? new Date(f.properties.time) : new Date();

                return {
                    id: `quake-${f.id}`,
                    pluginId: "earthquakes",
                    latitude: lat,
                    longitude: lon,
                    altitude: 0,
                    timestamp: time,
                    label: `M${mag.toFixed(1)} ${place}`,
                    properties: {
                        magnitude: mag,
                        place,
                        depth: typeof depth === "number" ? Math.round(depth) : 0,
                        depthKm: typeof depth === "number" ? Math.round(depth) : 0,
                        time: time.toISOString(),
                        url: f.properties?.url ?? "",
                        felt: f.properties?.felt ?? 0,
                        significance: f.properties?.sig ?? 0,
                    },
                };
            });
    }

    getPollingInterval(): number {
        return 5 * 60_000; // 5 minutes
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#f59e0b",
            clusterEnabled: false,
            clusterDistance: 40,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const mag = (entity.properties.magnitude as number) ?? 0;
        return {
            type: "point",
            color: magnitudeColor(mag),
            size: magnitudeSize(mag),
            outlineColor: "#ffffff",
            outlineWidth: 1,
        };
    }
}

export const earthquakesPlugin = new EarthquakesPlugin();
