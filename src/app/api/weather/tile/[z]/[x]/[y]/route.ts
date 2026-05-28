import { NextRequest, NextResponse } from "next/server";
import { WEATHER_LAYERS, isValidWeatherLayer } from "@/lib/weatherLayers";

export const revalidate = 600;

const MAX_ZOOM = 18;

function isValidTileCoord(value: string, zoom?: number): boolean {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return false;
    if (zoom !== undefined) {
        if (n >= Math.pow(2, zoom)) return false;
    }
    return true;
}

function isValidZoom(value: string): boolean {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= MAX_ZOOM;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
    const { z, x, y } = await params;
    const layer = req.nextUrl.searchParams.get("layer");

    if (!layer || !isValidWeatherLayer(layer)) {
        return NextResponse.json(
            { error: `Invalid layer. Must be one of: ${WEATHER_LAYERS.join(", ")}` },
            { status: 400 },
        );
    }

    if (!isValidZoom(z)) {
        return NextResponse.json(
            { error: "Invalid tile coordinates" },
            { status: 400 },
        );
    }

    const zNum = Number(z);
    if (!isValidTileCoord(x, zNum) || !isValidTileCoord(y, zNum)) {
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
    } catch {
        return NextResponse.json(
            { error: "Failed to fetch weather tile" },
            { status: 502 },
        );
    }
}
