import type {
    WorldPlugin,
    GeoEntity,
    LayerConfig,
    CesiumEntityOptions,
    TimeRange,
    PluginContext,
} from "@/core/plugins/PluginTypes";
import { createSvgIconUrl } from "@worldwideview/wwv-plugin-sdk";
import { ShieldAlert } from "lucide-react";
import { getSectorCentroid } from "./sectorCentroids";
import type { EmergencyItem } from "@/app/api/emergency/route";

const COLOR_CRITICAL = "#ef4444";
const COLOR_WARNING  = "#f97316";
const COLOR_INFO     = "#a78bfa";

const ICON_CACHE: Partial<Record<string, string>> = {};

function getColor(item: EmergencyItem): string {
    if (item.severity === "critical") return COLOR_CRITICAL;
    if (item.severity === "warning")  return COLOR_WARNING;
    return COLOR_INFO;
}

function getIconUrl(color: string): string {
    if (!ICON_CACHE[color]) {
        ICON_CACHE[color] = createSvgIconUrl(ShieldAlert, {
            color,
            size: 18,
            backgroundColor: "rgba(10,10,20,0.88)",
        });
    }
    return ICON_CACHE[color]!;
}

function itemToEntity(item: EmergencyItem): GeoEntity {
    const centroid = getSectorCentroid(item.sector ?? "");
    const lat = centroid.lat + (Math.random() - 0.5) * 0.008;
    const lon = centroid.lon + (Math.random() - 0.5) * 0.008;
    const color = getColor(item);
    return {
        id: item.id,
        pluginId: "apd-crime",
        latitude: lat,
        longitude: lon,
        timestamp: new Date(item.publishedAt),
        label: item.crimeType ?? item.title,
        properties: { ...item, _color: color },
    };
}

export const crimePlugin: WorldPlugin = {
    id: "apd-crime",
    name: "APD Crime Reports",
    description: "Austin Police Department crime reports from the last 72 hours.",
    icon: "ShieldAlert",
    category: "intelligence",
    version: "1.0.0",

    async initialize(_ctx: PluginContext): Promise<void> {},
    destroy(): void {},
    getPollingInterval(): number { return 120_000; },

    getLayerConfig(): LayerConfig {
        return { color: COLOR_INFO, clusterEnabled: true, clusterDistance: 60 };
    },

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetch("/api/emergency?category=crime&limit=200&days=3");
            if (!res.ok) return [];
            const data = await res.json();
            const items: EmergencyItem[] = data.items ?? [];
            return items.map(itemToEntity);
        } catch {
            return [];
        }
    },

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const color = (entity.properties as any)._color as string ?? COLOR_INFO;
        return {
            type: "billboard",
            iconUrl: getIconUrl(color),
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

    getGlobeComponent() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { SectorOverlayGlobe } = require("./SectorOverlayGlobe");
        return SectorOverlayGlobe;
    },
};
