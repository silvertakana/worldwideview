/**
 * Global Disasters Plugin — Events from GDACS (Global Disaster Alert and Coordination System).
 * Fetched via CORS proxy. No API key required.
 * Refresh: every 30 minutes.
 */
import { AlertOctagon } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";
import { fetchViaProxy } from "./proxy-utils";

const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS?alertlevel=Green;Orange;Red&limit=200";

function alertColor(level: string): string {
    const l = level.toLowerCase();
    if (l === "red")    return "#dc2626";
    if (l === "orange") return "#ea580c";
    return "#16a34a";
}

function disasterEmoji(type: string): string {
    const t = (type || "").toLowerCase();
    if (t.includes("flood"))     return "🌊";
    if (t.includes("storm") || t.includes("cyclone") || t.includes("typhoon") || t.includes("hurricane")) return "🌀";
    if (t.includes("earthquake") || t.includes("seismic")) return "🔥";
    if (t.includes("volcano"))   return "🌋";
    if (t.includes("drought"))   return "☀️";
    if (t.includes("fire") || t.includes("wildfire")) return "🔥";
    return "⚠️";
}

class DisastersPlugin implements WorldPlugin {
    id = "disasters";
    name = "Global Disasters";
    description = "Active disaster alerts from GDACS — floods, storms, earthquakes, and more";
    icon = AlertOctagon;
    category = "natural-disaster" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {}
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetchViaProxy(GDACS_URL);
            const data: any = await res.json();

            const features = Array.isArray(data?.features) ? data.features
                : Array.isArray(data?.items) ? data.items
                : [];

            return features
                .filter((f: any) => {
                    const coords = f?.geometry?.coordinates ?? f?.geometry?.point?.coordinates;
                    return Array.isArray(coords) && coords.length >= 2;
                })
                .map((f: any): GeoEntity | null => {
                    const coords = f?.geometry?.coordinates ?? f?.geometry?.point?.coordinates;
                    const props = f?.properties ?? f;

                    const lon = parseFloat(coords[0]);
                    const lat = parseFloat(coords[1]);
                    if (!isFinite(lat) || !isFinite(lon)) return null;

                    const alertLevel = props?.alertlevel ?? props?.AlertLevel ?? "Green";
                    const eventType = props?.eventtype ?? props?.EventType ?? "Unknown";
                    const country = props?.country ?? props?.Country ?? "";
                    const name = props?.eventname ?? props?.EventName ?? eventType;
                    const severity = props?.severity ?? props?.Severity ?? "";
                    const dateFrom = props?.fromdate ?? props?.FromDate ?? "";
                    const dateTo = props?.todate ?? props?.ToDate ?? "";
                    const eventId = props?.eventid ?? props?.EventId ?? `${lon}-${lat}`;

                    return {
                        id: `disaster-${eventId}`,
                        pluginId: "disasters",
                        latitude: lat,
                        longitude: lon,
                        timestamp: dateFrom ? new Date(dateFrom) : new Date(),
                        label: `${disasterEmoji(eventType)} ${name} (${alertLevel})`,
                        properties: {
                            eventType,
                            alertLevel,
                            country,
                            name,
                            severity,
                            dateFrom,
                            dateTo,
                            url: props?.url ?? props?.Url ?? "",
                        },
                    };
                })
                .filter(Boolean) as GeoEntity[];
        } catch {
            return [];
        }
    }

    getPollingInterval(): number {
        return 30 * 60_000; // 30 minutes
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ea580c",
            clusterEnabled: false,
            clusterDistance: 50,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const level = (entity.properties.alertLevel as string) ?? "Green";
        return {
            type: "point",
            color: alertColor(level),
            size: level.toLowerCase() === "red" ? 16 : level.toLowerCase() === "orange" ? 12 : 8,
            outlineColor: "#1c1917",
            outlineWidth: 1,
        };
    }
}

export const disastersPlugin = new DisastersPlugin();
