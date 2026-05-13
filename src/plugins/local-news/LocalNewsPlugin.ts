import type {
    WorldPlugin,
    GeoEntity,
    LayerConfig,
    CesiumEntityOptions,
    TimeRange,
    PluginContext,
} from "@/core/plugins/PluginTypes";
import { createSvgIconUrl } from "@worldwideview/wwv-plugin-sdk";
import { Newspaper } from "lucide-react";
import { getOutlet } from "./outlets";
import type { FeedItem } from "@/app/api/feeds/texas/route";

const NEWS_COLOR = "#a78bfa";

const ICON_URL = createSvgIconUrl(Newspaper, {
    color: NEWS_COLOR,
    size: 18,
    backgroundColor: "rgba(15,10,30,0.88)",
});

function itemToEntity(item: FeedItem): GeoEntity {
    const outlet = getOutlet(item.source);
    return {
        id: item.id,
        pluginId: "local-news",
        latitude: outlet.lat,
        longitude: outlet.lon,
        timestamp: new Date(item.publishedAt),
        label: item.source,
        properties: {
            headline: item.title,
            url: item.url,
            source: item.source,
            city: outlet.city,
            summary: item.summary ?? "",
            publishedAt: item.publishedAt,
            severity: item.severity ?? "info",
        },
    };
}

export const localNewsPlugin: WorldPlugin = {
    id: "local-news",
    name: "Local News",
    description: "Live headlines from Texas news outlets, pinned to each bureau's location.",
    icon: "📰",
    category: "intelligence",
    version: "1.0.0",

    async initialize(_ctx: PluginContext): Promise<void> {},
    destroy(): void {},
    getPollingInterval(): number { return 180_000; },

    getLayerConfig(): LayerConfig {
        return {
            color: NEWS_COLOR,
            iconUrl: ICON_URL,
            clusterEnabled: true,
            clusterDistance: 80,
        };
    },

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetch("/api/feeds/texas?category=news&limit=100");
            if (!res.ok) return [];
            const data = await res.json();
            const items: FeedItem[] = data.items ?? [];
            return items.map(itemToEntity);
        } catch {
            return [];
        }
    },

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        return {
            type: "billboard",
            iconUrl: ICON_URL,
            color: NEWS_COLOR,
            size: 28,
            iconScale: 0.85,
            disableDepthTestDistance: Infinity,
        };
    },

    getSelectionBehavior() {
        return { flyToBaseDistance: 80_000 };
    },

    getLegend() {
        return [{ label: "News Article", color: NEWS_COLOR }];
    },

    getSidebarComponent() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { LocalNewsSidebar } = require("./LocalNewsSidebar");
        return LocalNewsSidebar;
    },

    getDetailComponent() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { LocalNewsDetail } = require("./LocalNewsDetail");
        return LocalNewsDetail;
    },
};
