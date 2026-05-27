/**
 * News Plugin — World news from 5 major RSS feeds, pinned to source capitals.
 * Feeds fetched via allorigins CORS proxy and parsed with DOMParser.
 * Refresh: every 15 minutes.
 */
import { Newspaper } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";

interface RssFeed {
    name: string;
    url: string;
    lat: number;
    lon: number;
}

const RSS_FEEDS: RssFeed[] = [
    {
        name: "BBC World",
        url: "https://feeds.bbci.co.uk/news/world/rss.xml",
        lat: 51.5074,
        lon: -0.1278,
    },
    {
        name: "Al Jazeera",
        url: "https://www.aljazeera.com/xml/rss/all.xml",
        lat: 25.2854,
        lon: 51.5310,
    },
    {
        name: "New York Times",
        url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        lat: 40.7128,
        lon: -74.0060,
    },
    {
        name: "ABC Australia",
        url: "https://www.abc.net.au/news/feed/2942460/rss.xml",
        lat: -33.8688,
        lon: 151.2093,
    },
    {
        name: "Times of India",
        url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
        lat: 28.6139,
        lon: 77.2090,
    },
];

const MAX_HEADLINES = 5;

async function fetchFeedHeadlines(feed: RssFeed): Promise<string[]> {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const items = Array.from(doc.querySelectorAll("item")).slice(0, MAX_HEADLINES);
    return items.map((item) => item.querySelector("title")?.textContent?.trim() ?? "");
}

class NewsPlugin implements WorldPlugin {
    id = "news";
    name = "World News";
    description = "Top headlines from BBC, Al Jazeera, NYT, ABC Australia, Times of India";
    icon = Newspaper;
    category = "intelligence" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {}
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        const entities: GeoEntity[] = [];

        for (let i = 0; i < RSS_FEEDS.length; i++) {
            const feed = RSS_FEEDS[i];
            // Stagger requests by 300ms
            if (i > 0) await new Promise((r) => setTimeout(r, 300));

            try {
                const headlines = await fetchFeedHeadlines(feed);
                if (headlines.length === 0) continue;

                // Small offset for feeds sharing similar coordinates
                const latOffset = (i % 2) * 0.05;

                entities.push({
                    id: `news-${feed.name.replace(/\s+/g, "-").toLowerCase()}`,
                    pluginId: "news",
                    latitude: feed.lat + latOffset,
                    longitude: feed.lon,
                    timestamp: new Date(),
                    label: `📰 ${feed.name}`,
                    properties: {
                        source: feed.name,
                        headlines,
                        headlineCount: headlines.length,
                    },
                });
            } catch {
                // skip feed on error
            }
        }

        return entities;
    }

    getPollingInterval(): number {
        return 15 * 60_000; // 15 minutes
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#a78bfa",
            clusterEnabled: false,
            clusterDistance: 60,
        };
    }

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return {
            type: "point",
            color: "#a78bfa",
            size: 12,
            outlineColor: "#7c3aed",
            outlineWidth: 2,
        };
    }
}

export const newsPlugin = new NewsPlugin();
