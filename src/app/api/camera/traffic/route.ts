import { NextResponse } from "next/server";
import { fetchGdotCameras, type GdotCameraFeature } from "../gdot/gdotFetcher";
import { fetchTflCameras } from "../tfl/tflFetcher";
import { fetchCaltransCameras } from "../caltrans/caltransFetcher";

/** In-memory cache for traffic cameras with 24h TTL. */
let cache: { data: GdotCameraFeature[]; expiry: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Merge all traffic camera sources.
 * Add new fetchers here as they are implemented.
 */
async function fetchAllTrafficCameras(): Promise<GdotCameraFeature[]> {
    const results = await Promise.allSettled([
        fetchGdotCameras(),
        fetchTflCameras(),
        fetchCaltransCameras(),
    ]);

    const all: GdotCameraFeature[] = [];
    for (const r of results) {
        if (r.status === "fulfilled") all.push(...r.value);
    }
    return all;
}

export async function GET() {
    try {
        const now = Date.now();

        if (cache && now < cache.expiry) {
            return NextResponse.json({
                cameras: cache.data,
                total: cache.data.length,
                cached: true,
            });
        }

        const cameras = await fetchAllTrafficCameras();
        cache = { data: cameras, expiry: now + CACHE_TTL_MS };

        return NextResponse.json({
            cameras,
            total: cameras.length,
            cached: false,
        });
    } catch (error: any) {
        console.error("[TrafficCameras] Error:", error);
        if (cache) {
            return NextResponse.json({
                cameras: cache.data,
                total: cache.data.length,
                cached: true,
                stale: true,
            });
        }
        return NextResponse.json(
            { error: "Failed to fetch traffic cameras", details: error.message },
            { status: 502 },
        );
    }
}
