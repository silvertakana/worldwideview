import { NextResponse } from "next/server";

/**
 * GET /api/texas/boundary
 *
 * Returns a GeoJSON FeatureCollection containing only the Texas state boundary,
 * extracted from the Natural Earth / PublicaMundi US-states dataset (public domain).
 * Cached for 24 hours — the boundary never changes.
 */

export const revalidate = 86400;

const SOURCE_URL =
    "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

export async function GET() {
    try {
        const res = await fetch(SOURCE_URL, {
            headers: { "User-Agent": "WorldWideView/1.0" },
            next: { revalidate },
        });

        if (!res.ok) {
            return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
        }

        const data = await res.json();
        const features = (data?.features ?? []).filter(
            (f: any) => f?.properties?.name === "Texas",
        );

        return NextResponse.json(
            { type: "FeatureCollection", features },
            {
                headers: {
                    "Cache-Control": "public, max-age=86400",
                },
            },
        );
    } catch (err) {
        console.error("[TexasBoundary]", err);
        return NextResponse.json({ error: "Failed to fetch boundary" }, { status: 502 });
    }
}
