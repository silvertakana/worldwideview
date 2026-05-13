import { NextResponse } from "next/server";

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const TTL_MS = 60 * 60 * 1000;

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const FIELD_MASK =
    "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input");

    if (!input || typeof input !== "string") {
        return NextResponse.json({ error: "Input is required" }, { status: 400 });
    }

    const userKey = request.headers.get("X-User-Google-Key");
    const isValidUserKey = userKey && userKey.length >= 20;
    const apiKey = isValidUserKey ? userKey : process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error("GOOGLE_MAPS_API_KEY is not defined and no user key provided");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const cachePrefix = userKey ? `user:${userKey.slice(0, 8)}:` : "";
    const cacheKey = `${cachePrefix}${input.toLowerCase().trim()}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data);
    }

    try {
        const response = await fetch(AUTOCOMPLETE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask": FIELD_MASK,
            },
            body: JSON.stringify({ input }),
        });

        const data = (await response.json()) as {
            suggestions?: Array<{
                placePrediction?: {
                    placeId?: string;
                    text?: { text?: string };
                    structuredFormat?: {
                        mainText?: { text?: string };
                        secondaryText?: { text?: string };
                    };
                    types?: string[];
                };
            }>;
            error?: { code?: number; message?: string; status?: string };
        };

        if (!response.ok || data.error) {
            console.error("Google Places API (New) Error:", response.status, data);
            return NextResponse.json({ error: "Failed to fetch predictions" }, { status: 500 });
        }

        const predictions =
            data.suggestions
                ?.map((s) => s.placePrediction)
                .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
                .map((p) => {
                    const fullText = p.text?.text ?? "";
                    const mainText = p.structuredFormat?.mainText?.text ?? fullText;
                    const secondaryText = p.structuredFormat?.secondaryText?.text ?? "";
                    return {
                        description: fullText,
                        placeId: p.placeId as string,
                        mainText,
                        secondaryText,
                        types: p.types ?? [],
                    };
                }) ?? [];

        const result = { predictions };
        cache.set(cacheKey, { data: result, expiresAt: Date.now() + TTL_MS });
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in Places Autocomplete route:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
