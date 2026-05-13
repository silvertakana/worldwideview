/**
 * NCDOT (North Carolina DOT) adapter.
 *
 * NCDOT exposes its public traffic-cam API in two parts: a bulk endpoint
 * that returns ~770 cameras with only `{ id, latitude, longitude }`, and a
 * detail endpoint that returns one camera's full record (locationName,
 * roadId, countyId, imageURL, status). To get usable data we fan out an
 * N+1 fetch from the bulk list with bounded concurrency. First call lands
 * in ~15s; the registry's per-adapter cache holds it for 24h after that.
 *
 * No key required. Image URLs are direct ~45KB JPEGs at 640x360.
 */

import type { CameraAdapter, CameraFeature } from "./types";

const BULK_URL = "https://eapps.ncdot.gov/services/traffic-prod/v1/cameras";
const DETAIL_URL = (id: number) =>
    `https://eapps.ncdot.gov/services/traffic-prod/v1/cameras/${id}`;

const CONCURRENCY = 20;

interface BulkRecord {
    id: number;
    latitude: number;
    longitude: number;
}

interface DetailRecord {
    id: number;
    locationName: string | null;
    displayName: string | null;
    mileMarker: number | null;
    roadId: number;
    countyId: number;
    latitude: number;
    longitude: number;
    imageURL: string;
    isDOTCamera: boolean;
    status: string;
}

async function fetchDetail(id: number): Promise<DetailRecord | null> {
    try {
        const res = await fetch(DETAIL_URL(id), {
            headers: { "User-Agent": "WorldWideView/1.0" },
        });
        if (!res.ok) return null;
        if (res.status === 204) return null; // camera deleted/unavailable
        const text = await res.text();
        if (!text) return null;
        return JSON.parse(text) as DetailRecord;
    } catch {
        return null;
    }
}

/** Bounded-concurrency Promise.all. */
async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    async function run() {
        while (next < items.length) {
            const i = next++;
            results[i] = await worker(items[i]);
        }
    }
    await Promise.all(Array.from({ length: limit }, run));
    return results;
}

function toFeature(d: DetailRecord): CameraFeature | null {
    if (d.status && d.status !== "OK") return null;
    if (!d.imageURL) return null;
    if (typeof d.latitude !== "number" || typeof d.longitude !== "number") return null;
    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [d.longitude, d.latitude] },
        properties: {
            id: `ncdot-${d.id}`,
            source: "ncdot",
            stream: d.imageURL,
            streamType: "image",
            hls: null,
            name: d.displayName || d.locationName || `NCDOT camera ${d.id}`,
            country: "United States",
            region: "North Carolina",
            city: "North Carolina",
            location_description: d.locationName ?? "",
            categories: ["traffic"],
            extra: {
                mileMarker: d.mileMarker,
                roadId: d.roadId,
                countyId: d.countyId,
                ncdotStatus: d.status,
            },
        },
    };
}

export const ncdotAdapter: CameraAdapter = {
    id: "ncdot",
    displayName: "NCDOT (North Carolina)",
    region: "United States — North Carolina",
    fetch: async () => {
        const bulkRes = await fetch(BULK_URL, {
            headers: { "User-Agent": "WorldWideView/1.0" },
        });
        if (!bulkRes.ok) throw new Error(`NCDOT bulk ${bulkRes.status}`);
        const bulk = (await bulkRes.json()) as BulkRecord[];
        if (!Array.isArray(bulk)) return [];

        const details = await mapWithConcurrency(bulk, CONCURRENCY, (b) =>
            fetchDetail(b.id),
        );

        const features: CameraFeature[] = [];
        for (const d of details) {
            if (!d) continue;
            const f = toFeature(d);
            if (f) features.push(f);
        }
        return features;
    },
};
