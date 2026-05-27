import { NextResponse } from "next/server";
import { transliterate } from "@/lib/utils/transliterate";

// Server-side cache: keyed by normalised input, 1-hour TTL
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input");

    if (!input || typeof input !== "string") {
        return NextResponse.json({ error: "Input is required" }, { status: 400 });
    }

    // Use user-provided key if present in header AND looks valid, otherwise fall back to .env
    const userKey = request.headers.get("X-User-Google-Key");
    const isValidUserKey = userKey && userKey.length >= 20;
    const apiKey = isValidUserKey ? userKey : process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error("GOOGLE_MAPS_API_KEY is not defined and no user key provided");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Separate cache entries for user-provided keys vs default
    const cachePrefix = userKey ? `user:${userKey.slice(0, 8)}:` : "";
    const cacheKey = `${cachePrefix}${input.toLowerCase().trim()}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data);
    }

    try {
        // No type restriction — returns addresses, establishments, landmarks, regions, etc.
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            input
        )}&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
            console.error("Google Places API Error:", data);
            return NextResponse.json({ error: "Failed to fetch predictions" }, { status: 500 });
        }

        const predictions = data.predictions.map((p: any) => ({
            description: transliterate(p.description ?? ""),
            placeId: p.place_id,
            mainText: transliterate(p.structured_formatting?.main_text || p.description),
            secondaryText: transliterate(p.structured_formatting?.secondary_text || ""),
            types: p.types,
        }));

        const result = { predictions };
        cache.set(cacheKey, { data: result, expiresAt: Date.now() + TTL_MS });
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in Places Autocomplete route:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
