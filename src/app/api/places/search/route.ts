import { NextResponse } from "next/server";
import { transliterate } from "@/lib/utils/transliterate";
import {
    PlacesError,
    autocompletePlaces,
    placesKeyFingerprint,
    resolvePlacesKey,
} from "@/lib/places/googlePlaces";

// Server-side cache: keyed by normalised input, 1-hour TTL
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

function errorResponse(error: PlacesError): NextResponse {
    return NextResponse.json(
        {
            error: error.message,
            code: "places_upstream_error",
            googleStatus: error.googleStatus,
        },
        { status: 502 }
    );
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input");

    if (!input || !input.trim()) {
        return NextResponse.json({ error: "Input is required" }, { status: 400 });
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

    // Separate cache entries per key, fingerprinted: every Google key starts with the same
    // 8 characters, so a first-8 prefix would let one user read another user's results.
    const cachePrefix = resolved.source === "user" ? "user:" + placesKeyFingerprint(resolved.key) + ":" : "";
    const cacheKey = cachePrefix + input.toLowerCase().trim();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data);
    }

    try {
        // No type restriction - returns addresses, establishments, landmarks, regions, etc.
        const predictions = (await autocompletePlaces(input, resolved.key)).map((prediction) => ({
            description: transliterate(prediction.description),
            placeId: prediction.placeId,
            mainText: transliterate(prediction.mainText),
            secondaryText: transliterate(prediction.secondaryText),
            types: prediction.types,
        }));

        const result = { predictions };
        cache.set(cacheKey, { data: result, expiresAt: Date.now() + TTL_MS });
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof PlacesError) {
            console.error("Google Places autocomplete failed:", error.googleStatus, error.message);
            return errorResponse(error);
        }
        console.error("Error in Places Autocomplete route:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
