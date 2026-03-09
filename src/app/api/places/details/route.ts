import { NextResponse } from "next/server";

// Server-side cache: keyed by place_id, 24-hour TTL (place geometry is stable)
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("place_id");

    if (!placeId || typeof placeId !== "string") {
        return NextResponse.json({ error: "place_id is required" }, { status: 400 });
    }

    // Use user-provided key if present in header, otherwise fall back to .env
    const userKey = request.headers.get("X-User-Google-Key");
    const apiKey = userKey || process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error("GOOGLE_MAPS_API_KEY is not defined and no user key provided");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Separate cache entries for user-provided keys vs default
    const cachePrefix = userKey ? `user:${userKey.slice(0, 8)}:` : "";
    const cacheId = `${cachePrefix}${placeId}`;
    const cached = cache.get(cacheId);
    if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data);
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
            placeId
        )}&fields=geometry,name,types,formatted_address&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== "OK") {
            console.error("Google Places Details API Error:", data);
            return NextResponse.json({ error: "Failed to fetch place details" }, { status: 500 });
        }

        const location = data.result.geometry?.location;
        if (!location) {
            return NextResponse.json({ error: "No geometry found for place" }, { status: 404 });
        }

        const result = {
            lat: location.lat,
            lon: location.lng,
            name: data.result.name,
            types: data.result.types || [],
        };
        cache.set(cacheId, { data: result, expiresAt: Date.now() + TTL_MS });
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in Places Details route:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
