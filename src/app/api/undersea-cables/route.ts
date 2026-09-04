import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

/**
 * Serves the submarine cable network as raw GeoJSON.
 *
 * The `@worldwideview/wwv-plugin-undersea-cables` frontend loads this path
 * directly into a Cesium `GeoJsonDataSource`, so the body must be a bare
 * FeatureCollection — not wrapped in an envelope.
 */

const DATA_PATH = path.join(process.cwd(), "public", "data", "undersea-cables.geojson");

// 728 KB of static geometry — read once per server lifetime rather than per request.
let cached: string | null = null;

async function readCables(): Promise<string> {
    if (cached === null) {
        cached = await readFile(DATA_PATH, "utf8");
    }
    return cached;
}

export async function GET() {
    try {
        const geojson = await readCables();

        return new NextResponse(geojson, {
            status: 200,
            headers: {
                "Content-Type": "application/geo+json",
                "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        console.error("[UnderseaCablesRoute] Error:", error);
        return NextResponse.json(
            { error: "Failed to load undersea cable data" },
            { status: 500 },
        );
    }
}
