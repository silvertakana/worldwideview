import { NextResponse, type NextRequest } from "next/server";
import { fetchManyAdapters, resolveSources } from "../adapters/registry";

/**
 * Aggregator. Reads the adapter registry and fetches the requested sources.
 * Per-adapter caching lives in the registry, so individual sources can have
 * different TTLs without colliding here.
 *
 * Query params:
 *   ?sources=caltrans,gdot   → only those adapters
 *   ?sources=all (default)   → all registered adapters (back-compat with
 *                              the old behavior — every existing client
 *                              that hits this URL with no query continues
 *                              to receive the merged-everything payload)
 *   ?sources=none            → empty list (used by clients to short-circuit
 *                              without changing the default-on behavior of
 *                              this endpoint)
 *
 * Response shape kept backwards-compatible with the old /traffic endpoint:
 *   { cameras: CameraFeature[], total: number, sources: string[] }
 */
export async function GET(req: NextRequest) {
    const sources = resolveSources(req.nextUrl.searchParams.get("sources"));
    if (sources.length === 0) {
        return NextResponse.json({ cameras: [], total: 0, sources: [] });
    }
    try {
        const cameras = await fetchManyAdapters(sources);
        return NextResponse.json({
            cameras,
            total: cameras.length,
            sources,
        });
    } catch (error: any) {
        console.error("[TrafficCameras] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch traffic cameras" },
            { status: 502 },
        );
    }
}
