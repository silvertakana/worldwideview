import type {
    WorldPlugin,
    GeoEntity,
    LayerConfig,
    CesiumEntityOptions,
    TimeRange,
    PluginContext,
} from "@/core/plugins/PluginTypes";
import { createSvgIconUrl } from "@worldwideview/wwv-plugin-sdk";
import { ShieldAlert, Car } from "lucide-react";
import { getSectorCentroid } from "./sectorCentroids";
import type { EmergencyItem } from "@/app/api/emergency/route";

const COLOR_CRITICAL = "#ef4444";
const COLOR_WARNING  = "#f97316";
const COLOR_INFO     = "#a78bfa";
const COLOR_TRAFFIC  = "#22d3ee";

const ICON_CACHE: Partial<Record<string, string>> = {};

function getColor(item: EmergencyItem): string {
    if (item.category === "traffic")  return COLOR_TRAFFIC;
    if (item.severity === "critical") return COLOR_CRITICAL;
    if (item.severity === "warning")  return COLOR_WARNING;
    return COLOR_INFO;
}

function getIconUrl(color: string, isTraffic: boolean): string {
    const key = `${color}-${isTraffic}`;
    if (!ICON_CACHE[key]) {
        ICON_CACHE[key] = createSvgIconUrl(isTraffic ? Car : ShieldAlert, {
            color,
            size: 18,
            backgroundColor: "rgba(10,10,20,0.88)",
        });
    }
    return ICON_CACHE[key]!;
}

function itemToEntity(item: EmergencyItem): GeoEntity | null {
    let lat: number;
    let lon: number;

    if (item.category === "traffic") {
        if (!item.lat || !item.lon) return null;
        lat = item.lat;
        lon = item.lon;
    } else {
        const centroid = getSectorCentroid(item.sector ?? "");
        lat = centroid.lat + (Math.random() - 0.5) * 0.008;
        lon = centroid.lon + (Math.random() - 0.5) * 0.008;
    }

    const color = getColor(item);

    return {
        id: item.id,
        pluginId: "public-safety",
        latitude: lat,
        longitude: lon,
        timestamp: new Date(item.publishedAt),
        label: item.crimeType ?? item.title,
        properties: { ...item, _color: color },
    };
}

export const publicSafetyPlugin: WorldPlugin = {
    id: "public-safety",
    name: "Public Safety",
    description: "Austin APD crime reports (72 hrs) and active traffic incidents.",
    icon: "🚨",
    category: "intelligence",
    version: "1.0.0",

    async initialize(_ctx: PluginContext): Promise<void> {},
    destroy(): void {},
    getPollingInterval(): number { return 120_000; },

    getLayerConfig(): LayerConfig {
        return {
            color: COLOR_INFO,
            clusterEnabled: true,
            clusterDistance: 60,
        };
    },

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const [crimeRes, trafficRes] = await Promise.all([
                fetch("/api/emergency?category=crime&limit=200&days=3"),
                fetch("/api/emergency?category=traffic&limit=50"),
            ]);

            const crimeItems: EmergencyItem[]   = crimeRes.ok   ? (await crimeRes.json()).items   ?? [] : [];
            const trafficItems: EmergencyItem[] = trafficRes.ok ? (await trafficRes.json()).items ?? [] : [];

            return [...crimeItems, ...trafficItems]
                .map(itemToEntity)
                .filter((e): e is GeoEntity => e !== null);
        } catch {
            return [];
        }
    },

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const props = entity.properties as unknown as EmergencyItem & { _color: string };
        const color = props._color ?? COLOR_INFO;
        return {
            type: "billboard",
            iconUrl: getIconUrl(color, props.category === "traffic"),
            color,
            size: 26,
            iconScale: 0.85,
            disableDepthTestDistance: Infinity,
        };
    },

    getSelectionBehavior() {
        return { flyToBaseDistance: 12_000 };
    },

    getLegend() {
        return [
            { label: "Violent / Family Violence", color: COLOR_CRITICAL },
            { label: "Serious Crime",              color: COLOR_WARNING  },
            { label: "Crime Report",               color: COLOR_INFO     },
            { label: "Traffic Incident",           color: COLOR_TRAFFIC  },
        ];
    },

    getSidebarComponent() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PublicSafetySidebar } = require("./PublicSafetySidebar");
        return PublicSafetySidebar;
    },

    getDetailComponent() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PublicSafetyDetail } = require("./PublicSafetyDetail");
        return PublicSafetyDetail;
    },
};
