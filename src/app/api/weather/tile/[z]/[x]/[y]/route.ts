import { NextRequest, NextResponse } from "next/server";

export const revalidate = 600;

const ALLOWED_LAYERS = [
    "clouds_new",
    "precipitation_new",
    "pressure_new",
    "wind_new",
    "temp_new",
] as const;

type WeatherLayer = (typeof ALLOWED_LAYERS)[number];

function isValidLayer(layer: string): layer is WeatherLayer {
    return ALLOWED_LAYERS.includes(layer as WeatherLayer);
}

function isValidTileCoord(value: string): boolean {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
    const { z, x, y } = await params;
    const layer = req.nextUrl.searchParams.get("layer");

    if (!layer || !isValidLayer(layer)) {
        return NextResponse.json(
            { error: `Invalid layer. Must be one of: ${ALLOWED_LAYERS.join(", ")}` },
            { status: 400 },
        );
    }

    if (!isValidTileCoord(z) || !isValidTileCoord(x) || !isValidTileCoord(y)) {
        return NextResponse.json(
            { error: "Invalid tile coordinates" },
            { status: 400 },
        );
    }

    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: "Weather API not configured" },
            { status: 503 },
        );
    }

    const tileUrl = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${apiKey}`;

    try {
        const response = await fetch(tileUrl, {
            headers: { "User-Agent": "WorldWideView/1.0" },
            next: { revalidate },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch weather tile" },
                { status: 502 },
            );
        }

        const buffer = await response.arrayBuffer();

        return new Response(buffer, {
            status: 200,
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=600, stale-while-revalidate=300",
            },
        });
    } catch (error) {
        console.error("[WeatherTile] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch weather tile" },
            { status: 502 },
        );
    }
}
