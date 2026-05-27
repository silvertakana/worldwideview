/**
 * War Zones Plugin — Conflict events from ACLED API (last 30 days).
 * Requires free ACLED API credentials (email + key) from https://developer.acleddata.com/
 * Refresh: every hour.
 */
import { AlertTriangle } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";
import { fetchViaProxy } from "./proxy-utils";

const LS_KEY_ACLED_EMAIL = "wwv_acled_email";
const LS_KEY_ACLED_KEY = "wwv_acled_key";

function getCredentials(): { email: string; key: string } | null {
    if (typeof window === "undefined") return null;
    const email = localStorage.getItem(LS_KEY_ACLED_EMAIL) || "";
    const key = localStorage.getItem(LS_KEY_ACLED_KEY) || "";
    if (!email || !key) return null;
    return { email, key };
}

function getLast30Days(): { start: string; end: string } {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { start: fmt(start), end: fmt(end) };
}

function fatalityColor(fatalities: number): string {
    if (fatalities >= 50) return "#7f1d1d";
    if (fatalities >= 10) return "#dc2626";
    if (fatalities >= 1)  return "#ef4444";
    return "#f87171";
}

function fatalitySize(fatalities: number): number {
    if (fatalities >= 100) return 22;
    if (fatalities >= 50)  return 18;
    if (fatalities >= 10)  return 14;
    if (fatalities >= 1)   return 10;
    return 7;
}

class WarZonesPlugin implements WorldPlugin {
    id = "warzones";
    name = "War Zones";
    description = "Active conflict events from ACLED (last 30 days) — free API key required";
    icon = AlertTriangle;
    category = "conflict" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {}
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        const creds = getCredentials();
        if (!creds) return [];

        try {
            const { start, end } = getLast30Days();
            const params = new URLSearchParams({
                key: creds.key,
                email: creds.email,
                event_date: `${start}|${end}`,
                event_date_where: "BETWEEN",
                limit: "1000",
                fields: "event_id_cnty,event_date,event_type,actor1,actor2,country,location,latitude,longitude,fatalities,notes",
            });

            const url = `https://api.acleddata.com/acled/read?${params}`;
            const data = await fetchViaProxy(url);
            const json: any = await data.json();

            if (!Array.isArray(json.data)) return [];

            return json.data
                .filter((ev: any) =>
                    typeof ev.latitude === "string" && typeof ev.longitude === "string"
                )
                .map((ev: any) => {
                    const lat = parseFloat(ev.latitude);
                    const lon = parseFloat(ev.longitude);
                    const fatalities = parseInt(ev.fatalities ?? "0", 10) || 0;

                    if (!isFinite(lat) || !isFinite(lon)) return null;

                    return {
                        id: `warzone-${ev.event_id_cnty}`,
                        pluginId: "warzones",
                        latitude: lat,
                        longitude: lon,
                        timestamp: new Date(ev.event_date ?? Date.now()),
                        label: `⚔️ ${ev.location ?? ev.country}`,
                        properties: {
                            eventId: ev.event_id_cnty,
                            eventType: ev.event_type ?? "",
                            actor1: ev.actor1 ?? "",
                            actor2: ev.actor2 ?? "",
                            country: ev.country ?? "",
                            location: ev.location ?? "",
                            fatalities,
                            notes: ev.notes ?? "",
                            date: ev.event_date ?? "",
                        },
                    } satisfies GeoEntity;
                })
                .filter(Boolean) as GeoEntity[];
        } catch {
            return [];
        }
    }

    getPollingInterval(): number {
        return 60 * 60_000; // 1 hour
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#dc2626",
            clusterEnabled: false,
            clusterDistance: 50,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const fatalities = (entity.properties.fatalities as number) ?? 0;
        return {
            type: "point",
            color: fatalityColor(fatalities),
            size: fatalitySize(fatalities),
            outlineColor: "#7f1d1d",
            outlineWidth: 2,
        };
    }

    requiresConfiguration(): boolean {
        return !getCredentials();
    }
}

export const warZonesPlugin = new WarZonesPlugin();
