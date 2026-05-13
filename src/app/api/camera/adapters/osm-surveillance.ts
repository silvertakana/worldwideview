/**
 * OpenStreetMap surveillance points (`man_made=surveillance`).
 *
 * Location-only — most OSM surveillance nodes don't have public stream URLs,
 * but the geometry alone is useful as a "where do public/government cameras
 * exist" overlay alongside the live DOT feeds.
 *
 * The query is bounded to a list of major metros (~30km radius each) so a
 * single Overpass call doesn't return hundreds of thousands of points.
 * Operators who want fuller coverage can extend `OVERPASS_QUERY` and bump
 * the per-query cap. Output is capped at 3000 nodes total.
 *
 * Cache TTL is 7 days — OSM data changes slowly and Overpass is shared
 * infrastructure that politely asks consumers not to re-poll aggressively.
 */

import type { CameraAdapter, CameraFeature } from "./types";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const OVERPASS_QUERY = `[out:json][timeout:25];
(
  node["man_made"="surveillance"](around:30000,37.7749,-122.4194);
  node["man_made"="surveillance"](around:30000,34.0522,-118.2437);
  node["man_made"="surveillance"](around:30000,40.7128,-74.0060);
  node["man_made"="surveillance"](around:30000,51.5074,-0.1278);
  node["man_made"="surveillance"](around:30000,48.8566,2.3522);
  node["man_made"="surveillance"](around:30000,35.6762,139.6503);
  node["man_made"="surveillance"](around:30000,35.7796,-78.6382);
);
out body 3000;`;

interface OverpassNode {
    type: "node";
    id: number;
    lat: number;
    lon: number;
    tags?: Record<string, string>;
}

export const osmSurveillanceAdapter: CameraAdapter = {
    id: "osm-surveillance",
    displayName: "OSM Surveillance Points",
    region: "Global (sampled major metros)",
    cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
    fetch: async () => {
        const res = await fetch(OVERPASS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "WorldWideView/1.0",
            },
            body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
        });
        if (!res.ok) throw new Error(`overpass ${res.status}`);
        const data = (await res.json()) as { elements?: OverpassNode[] };
        const nodes = (data.elements ?? []).filter(
            (e): e is OverpassNode =>
                e.type === "node" && typeof e.lat === "number",
        );

        return nodes.map<CameraFeature>((n) => {
            const t = n.tags ?? {};
            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [n.lon, n.lat] },
                properties: {
                    id: `osm-${n.id}`,
                    source: "osm-surveillance",
                    stream: null,
                    streamType: null,
                    hls: null,
                    name: t.name ?? "Surveillance",
                    country: t["addr:country"],
                    location_description: t.description ?? "",
                    categories: ["surveillance"],
                    extra: {
                        operator: t.operator,
                        surveillanceType: t["surveillance:type"],
                        cameraType: t["camera:type"],
                        cameraDirection: t.camera_direction,
                        osmId: n.id,
                    },
                },
            };
        });
    },
};
