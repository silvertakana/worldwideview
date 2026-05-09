import { NextResponse } from "next/server";
import { fetchWsdotCameras } from "./wsdotFetcher";
import type { GdotCameraFeature } from "../gdot/gdotFetcher";

/** In-memory cache with TTL. */
let cache: { data: GdotCameraFeature[]; expiry: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
    try {
        const now = Date.now();

        if (cache && now < cache.expiry) {
            return NextResponse.json({ cameras: cache.data, cached: true });
        }

        const cameras = await fetchWsdotCameras();
        cache = { data: cameras, expiry: now + CACHE_TTL_MS };

        return NextResponse.json({ cameras, cached: false });
    } catch (error: any) {
        console.error("[WSDOT API] Error:", error);
        if (cache) {
            return NextResponse.json({ cameras: cache.data, cached: true, stale: true });
        }
        return NextResponse.json(
            { error: "Failed to fetch WSDOT cameras" },
            { status: 502 },
        );
    }
}
