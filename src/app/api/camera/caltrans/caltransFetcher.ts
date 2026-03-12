/**
 * Fetches all Caltrans CCTV cameras across all 12 California districts.
 *
 * API: https://cwwp2.dot.ca.gov/data/d{N}/cctv/cctvStatusD{NN}.json
 * Free, no authentication required.
 * Returns ~3,400 cameras with HLS streaming URLs and JPEG snapshots.
 */

import type { GdotCameraFeature } from "../gdot/gdotFetcher";

const DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function districtUrl(d: number): string {
    const padded = String(d).padStart(2, "0");
    return `https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${padded}.json`;
}

function toGeoJsonFeature(raw: any): GdotCameraFeature | null {
    const cam = raw.cctv;
    if (!cam?.location) return null;

    const lat = parseFloat(cam.location.latitude);
    const lon = parseFloat(cam.location.longitude);
    if (isNaN(lat) || isNaN(lon)) return null;
    if (cam.inService === "false") return null;

    const hls = cam.imageData?.streamingVideoURL || null;
    const jpeg = cam.imageData?.static?.currentImageURL || "";

    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: {
            stream: hls || jpeg,
            hls,
            country: "United States",
            region: `District ${cam.location.district}, California`,
            city: cam.location.nearbyPlace || "California",
            source: "caltrans",
            name: cam.location.locationName || "",
            route: cam.location.route || "",
            direction: cam.location.direction || "",
            location_description: cam.location.locationName || "",
            categories: ["traffic"],
        },
    };
}

/** Fetch all Caltrans cameras across all 12 districts in parallel. */
export async function fetchCaltransCameras(): Promise<GdotCameraFeature[]> {
    const results = await Promise.allSettled(
        DISTRICTS.map(async (d) => {
            const res = await fetch(districtUrl(d), {
                headers: { "User-Agent": "WorldWideView/1.0" },
            });
            if (!res.ok) return [];
            const json = await res.json();
            if (!Array.isArray(json.data)) return [];
            const cameras: GdotCameraFeature[] = [];
            for (const item of json.data) {
                const f = toGeoJsonFeature(item);
                if (f) cameras.push(f);
            }
            return cameras;
        }),
    );

    return results
        .filter((r): r is PromiseFulfilledResult<GdotCameraFeature[]> => r.status === "fulfilled")
        .flatMap((r) => r.value);
}
