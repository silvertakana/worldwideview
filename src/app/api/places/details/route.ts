import { NextResponse } from "next/server";

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

const DETAILS_FIELD_MASK = "location,types,viewport";

function mapViewport(vp: {
    low?: { latitude?: number; longitude?: number };
    high?: { latitude?: number; longitude?: number };
} | null): { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } } | null {
    if (
        vp?.low?.latitude === undefined ||
        vp.low.longitude === undefined ||
        vp?.high?.latitude === undefined ||
        vp.high.longitude === undefined
    ) {
        return null;
    }
    return {
        southwest: { lat: vp.low.latitude, lng: vp.low.longitude },
        northeast: { lat: vp.high.latitude, lng: vp.high.longitude },
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("place_id");

    if (!placeId || typeof placeId !== "string") {
        return NextResponse.json({ error: "place_id is required" }, { status: 400 });
    }

    const userKey = request.headers.get("X-User-Google-Key");
    const isValidUserKey = userKey && userKey.length >= 20;
    const apiKey = isValidUserKey ? userKey : process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error("GOOGLE_MAPS_API_KEY is not defined and no user key provided");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const cachePrefix = userKey ? `user:${userKey.slice(0, 8)}:` : "";
    const cacheId = `${cachePrefix}${placeId}`;
    const cached = cache.get(cacheId);
    if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data);
    }

    try {
        const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
        const response = await fetch(url, {
            headers: {
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask": DETAILS_FIELD_MASK,
            },
        });

        const data = (await response.json()) as {
            location?: { latitude?: number; longitude?: number };
            types?: string[];
            viewport?: {
                low?: { latitude?: number; longitude?: number };
                high?: { latitude?: number; longitude?: number };
            };
            error?: { code?: number; message?: string; status?: string };
        };

        if (!response.ok || data.error) {
            console.error("Google Places Details API (New) Error:", response.status, data);
            return NextResponse.json({ error: "Failed to fetch place details" }, { status: 500 });
        }

        const location = data.location;
        if (
            location?.latitude === undefined ||
            location.longitude === undefined
        ) {
            return NextResponse.json({ error: "No geometry found for place" }, { status: 404 });
        }

        const result = {
            lat: location.latitude,
            lon: location.longitude,
            types: data.types ?? [],
            viewport: mapViewport(data.viewport ?? null),
        };
        cache.set(cacheId, { data: result, expiresAt: Date.now() + TTL_MS });
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in Places Details route:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
