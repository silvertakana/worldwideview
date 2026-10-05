import { NextResponse } from "next/server";
import { transliterate } from "@/lib/utils/transliterate";
import { getClientIp } from "@/lib/rateLimit";
import { placesLimiter } from "@/lib/rateLimiters";
import {
    PlacesError,
    fetchPlaceDetails,
    placesKeyFingerprint,
    resolvePlacesKey,
} from "@/lib/places/googlePlaces";

// Server-side cache: keyed by place_id, 24-hour TTL (place geometry is stable)
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: Request) {
    // 1. Rate limiting -- cheapest check, before any billed upstream call
    const rateLimited = placesLimiter.check(getClientIp(request));
    if (rateLimited) return rateLimited;

    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("place_id");

    if (!placeId || !placeId.trim()) {
        return NextResponse.json({ error: "place_id is required" }, { status: 400 });
    }

    const resolved = resolvePlacesKey(request);
    if (!resolved) {
        console.error("GOOGLE_MAPS_API_KEY is not defined and no user key provided");
        return NextResponse.json(
            {
                error: "Google place search is not configured on this instance.",
                code: "places_not_configured",
            },
            { status: 503 }
        );
    }

    // Separate cache entries per key, fingerprinted (see the search route).
    const cachePrefix = resolved.source === "user" ? "user:" + placesKeyFingerprint(resolved.key) + ":" : "";
    const cacheId = cachePrefix + placeId;
    const cached = cache.get(cacheId);
    if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data);
    }

    try {
        const place = await fetchPlaceDetails(placeId, resolved.key);

        const result = {
            lat: place.lat,
            lon: place.lon,
            name: transliterate(place.name),
            types: place.types,
            viewport: place.viewport,
        };
        cache.set(cacheId, { data: result, expiresAt: Date.now() + TTL_MS });
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof PlacesError) {
            console.error("Google Places details failed:", error.googleStatus, error.message);
            return NextResponse.json(
                {
                    error: error.message,
                    code: "places_upstream_error",
                    googleStatus: error.googleStatus,
                },
                { status: error.httpStatus === 404 ? 404 : 502 }
            );
        }
        console.error("Error in Places Details route:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
