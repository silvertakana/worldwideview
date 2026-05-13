import type {
    WorldPlugin,
    GeoEntity,
    LayerConfig,
    CesiumEntityOptions,
    TimeRange,
    PluginContext,
} from "@/core/plugins/PluginTypes";
import { createSvgIconUrl } from "@worldwideview/wwv-plugin-sdk";
import { Car } from "lucide-react";
import type { EmergencyItem } from "@/app/api/emergency/route";

const COLOR_TRAFFIC = "#22d3ee";

let iconUrl: string | null = null;
function getIconUrl(): string {
    if (!iconUrl) {
        iconUrl = createSvgIconUrl(Car, {
            color: COLOR_TRAFFIC,
            size: 18,
            backgroundColor: "rgba(10,10,20,0.88)",
        });
    }
    return iconUrl;
}

function itemToEntity(item: EmergencyItem): GeoEntity | null {
    if (!item.lat || !item.lon) return null;
    return {
        id: item.id,
        pluginId: "austin-traffic",
        latitude: item.lat,
        longitude: item.lon,
        timestamp: new Date(item.publishedAt),
        label: item.title,
        properties: { ...item },
    };
}

export const trafficPlugin: WorldPlugin = {
    id: "austin-traffic",
    name: "Austin Traffic",
    description: "Active traffic incidents in Austin with real-time GPS locations.",
    icon: "TriangleAlert",
    category: "intelligence",
    version: "1.0.0",

    async initialize(_ctx: PluginContext): Promise<void> {},
    destroy(): void {},
    getPollingInterval(): number { return 60_000; },

    getLayerConfig(): LayerConfig {
        return { color: COLOR_TRAFFIC, clusterEnabled: true, clusterDistance: 40 };
    },

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetch("/api/emergency?category=traffic&limit=50");
            if (!res.ok) return [];
            const data = await res.json();
            const items: EmergencyItem[] = data.items ?? [];
            return items.map(itemToEntity).filter((e): e is GeoEntity => e !== null);
        } catch {
            return [];
        }
    },

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return {
            type: "billboard",
            iconUrl: getIconUrl(),
            color: COLOR_TRAFFIC,
            size: 24,
            iconScale: 0.85,
            disableDepthTestDistance: Infinity,
        };
    },

    getSelectionBehavior() {
        return { flyToBaseDistance: 8_000 };
    },

    getLegend() {
        return [{ label: "Traffic Incident", color: COLOR_TRAFFIC }];
    },

    getDetailComponent() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PublicSafetyDetail } = require("./PublicSafetyDetail");
        return PublicSafetyDetail;
    },
};
