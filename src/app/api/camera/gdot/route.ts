import { NextResponse } from "next/server";
import { fetchGdotCameras, type GdotCameraFeature } from "./gdotFetcher";

/** In-memory cache with TTL. */
let cache: { data: GdotCameraFeature[]; expiry: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
    try {
        const now = Date.now();

        if (cache && now < cache.expiry) {
            return NextResponse.json({ cameras: cache.data, cached: true });
        }

        const cameras = await fetchGdotCameras();
        cache = { data: cameras, expiry: now + CACHE_TTL_MS };

        return NextResponse.json({ cameras, cached: false });
    } catch (error: any) {
        console.error("[GDOT API] Error:", error);
        // Serve stale cache on error if available
        if (cache) {
            return NextResponse.json({ cameras: cache.data, cached: true, stale: true });
        }
        return NextResponse.json(
            { error: "Failed to fetch GDOT cameras", details: error.message },
            { status: 502 },
        );
    }
}
