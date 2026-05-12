import { Radio } from "lucide-react";
import {
    createSvgIconUrl,
    type CesiumEntityOptions,
    type GeoEntity,
    type LayerConfig,
    type PluginContext,
    type TimeRange,
    type WorldPlugin,
} from "@worldwideview/wwv-plugin-sdk";
import { makeAudioController, type Place } from "./AudioController";

/**
 * Radio Garden — drag the globe over a city, hear its local radio.
 *
 * Each entity is a *place* (a city or town) with a count of stations
 * broadcasting from there. Channels and stream URLs are fetched lazily
 * by the audio controller when the camera target lands on a place,
 * so we never ship the full per-station catalog to the browser at once.
 *
 * The actual "what's under the reticle plays automatically" behaviour
 * is mounted in a sibling React component injected via
 * `getGlobeComponent`; this file is just the data + render config.
 */

interface RadioPlace extends GeoEntity {
    properties: {
        country: string | null;
        station_count: number;
    };
}

interface PlaceRow {
    id: string;
    name: string;
    country: string | null;
    lat: number;
    lon: number;
    station_count: number;
}

const PLUGIN_ID = "radio-garden";

let pluginContext: PluginContext | null = null;

// Mutable reference the AudioController reads on every camera-change event.
// Updated by `fetch()` so the controller always sees the current place set
// without us having to pipe Zustand state through the SDK boundary.
const placesRef: { current: Place[] } = { current: [] };
const audioControllerComponent = makeAudioController(placesRef);

const ICON_URL_BUSY = createSvgIconUrl(Radio, {
    color: "#22d3ee",
    size: 22,
    background: true,
});
const ICON_URL_QUIET = createSvgIconUrl(Radio, {
    color: "#94a3b8",
    size: 18,
    background: true,
});

async function fetchPlaces(): Promise<RadioPlace[]> {
    if (!pluginContext) return [];
    // Same-origin route to the plugin's own backend, brokered by the
    // host's `/api/plugin/<id>/<path>` proxy. No CORS, no port discovery
    // — the supervisor manages the actual port.
    const res = await fetch("/api/plugin/radio-garden/places", {
        credentials: "include",
    });
    if (!res.ok) {
        throw new Error(`Radio Garden /places returned ${res.status}`);
    }
    const body = (await res.json()) as { items?: PlaceRow[] };
    const items = Array.isArray(body.items) ? body.items : [];

    // Keep the AudioController's `placesRef` in sync so it can resolve
    // "nearest place to camera" without going through the host store.
    placesRef.current = items.map((p) => ({
        id: p.id,
        name: p.name,
        country: p.country,
        lat: p.lat,
        lon: p.lon,
        station_count: p.station_count,
    }));

    const now = new Date();
    return items.map((p) => ({
        id: `place-${p.id}`,
        pluginId: PLUGIN_ID,
        latitude: p.lat,
        longitude: p.lon,
        timestamp: now,
        label: p.name,
        properties: {
            country: p.country,
            station_count: p.station_count,
            // Store the bare place id (without the "place-" prefix) so the
            // audio controller can call /api/plugin/radio-garden/place/:id/channels.
            place_id: p.id,
        },
    })) as RadioPlace[];
}

const plugin: WorldPlugin = {
    id: PLUGIN_ID,
    name: "Radio Garden",
    description:
        "Drag the globe over a city and a local station starts playing. Powered by Radio Garden's place index — ~12,500 places worldwide.",
    icon: Radio,
    category: "custom",
    version: "0.1.0",

    async initialize(ctx: PluginContext): Promise<void> {
        pluginContext = ctx;
    },

    destroy(): void {
        pluginContext = null;
    },

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        return fetchPlaces();
    },

    // Refresh once a day — the place list is essentially static. The
    // host's PollingManager calls fetch() once on enable then again on
    // this interval; that's fine.
    getPollingInterval(): number {
        return 24 * 60 * 60 * 1000;
    },

    getLayerConfig(): LayerConfig {
        return {
            color: "#22d3ee",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 15_000, // Radio Garden has ~12.5k places; leave headroom.
        };
    },

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const props = entity.properties as RadioPlace["properties"];
        const busy = (props.station_count ?? 0) >= 10;
        return {
            type: "billboard",
            iconUrl: busy ? ICON_URL_BUSY : ICON_URL_QUIET,
            iconScale: busy ? 0.65 : 0.55,
            labelText: entity.label,
            labelFont: "11px Inter, sans-serif",
            distanceDisplayCondition: { near: 0, far: 8_000_000 },
        };
    },

    getLegend() {
        return [
            { label: "10+ stations", color: "#22d3ee" },
            { label: "< 10 stations", color: "#94a3b8" },
        ];
    },

    getGlobeComponent() {
        return audioControllerComponent;
    },
};

export default plugin;
