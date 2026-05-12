import type {
    WorldPlugin,
    GeoEntity,
    LayerConfig,
    CesiumEntityOptions,
    TimeRange,
    PluginContext,
} from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";
import type { WaypointData } from "@/core/state/store";

const ICON_URL = "/icons/waypoint-pin.svg";

function waypointToEntity(w: WaypointData): GeoEntity {
    return {
        id: `waypoint-${w.id}`,
        pluginId: "waypoints",
        latitude: w.lat,
        longitude: w.lon,
        timestamp: new Date(w.createdAt),
        label: w.title,
        properties: {
            waypointId: w.id,
            title: w.title,
            description: w.description,
            color: w.color,
            feedUrl: `/api/waypoints/${w.id}/feed`,
        },
    };
}

export const waypointPlugin: WorldPlugin = {
    id: "waypoints",
    name: "My Waypoints",
    description: "Custom map pins with attached blog posts and RSS feeds.",
    icon: "📍",
    category: "custom",
    version: "1.0.0",

    async initialize(_ctx: PluginContext): Promise<void> {},
    destroy(): void {},
    getPollingInterval(): number { return 30_000; },

    getLayerConfig(): LayerConfig {
        return {
            color: "#38bdf8",
            iconUrl: ICON_URL,
            clusterEnabled: false,
            clusterDistance: 60,
        };
    },

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetch("/api/waypoints");
            if (!res.ok) return [];
            const data = await res.json();
            const waypoints: WaypointData[] = data.waypoints ?? [];
            useStore.getState().setWaypoints(waypoints);
            return waypoints.map(waypointToEntity);
        } catch {
            return [];
        }
    },

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const color = (entity.properties.color as string | undefined) ?? "#38bdf8";
        return {
            type: "billboard",
            iconUrl: ICON_URL,
            color,
            size: 32,
            iconScale: 0.8,
            disableDepthTestDistance: Infinity,
            disableClustering: true,
        };
    },

    getDetailComponent() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WaypointDetail } = require("./WaypointDetailComponent");
        return WaypointDetail;
    },

    getSelectionBehavior() {
        return { flyToBaseDistance: 5000 };
    },
};
