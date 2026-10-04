import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { keyVerifyLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";

/** Minimum length sanity check before attempting verification. */
const MIN_KEY_LENGTH = 20;

/**
 * Probe the Places API (New). Legacy `maps.googleapis.com/maps/api/place/*` cannot be enabled
 * on a new Google Cloud project, so the old probe reported every fresh key as invalid.
 */
async function verifyGoogleMaps(key: string): Promise<{ valid: boolean; error?: string }> {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
            "X-Goog-Api-Key": key,
            // The New API has no default field set; without a mask every call fails with 400.
            "X-Goog-FieldMask": "places.id",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ textQuery: "test", maxResultCount: 1 }),
    });
    if (res.ok) return { valid: true };

    const data = (await res.json().catch(() => null)) as
        | { error?: { status?: unknown; message?: unknown } }
        | null;
    if (typeof data?.error?.message === "string" && data.error.message) {
        return { valid: false, error: data.error.message };
    }
    if (typeof data?.error?.status === "string" && data.error.status) {
        return { valid: false, error: data.error.status };
    }
    return { valid: false, error: `Places API returned HTTP ${res.status}` };
}

async function verifyNasaFirms(key: string): Promise<{ valid: boolean; error?: string }> {
    // FIRMS returns 200 with "Invalid MAP_KEY." body on failure
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_SNPP_NRT/world/1`;
    const res = await fetch(url);
    const text = await res.text();
    if (text.trim().startsWith("Invalid MAP_KEY")) {
        return { valid: false, error: "Invalid MAP_KEY" };
    }
    return { valid: true };
}

export async function POST(request: Request) {
    const rateLimited = keyVerifyLimiter.check(getClientIp(request));
    if (rateLimited) return rateLimited;

    const session = await getServerSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { service?: string; key?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { service, key } = body;
    if (!service || !key || typeof key !== "string") {
        return NextResponse.json({ error: "service and key are required" }, { status: 400 });
    }
    if (key.length < MIN_KEY_LENGTH) {
        return NextResponse.json({ valid: false, error: "Key is too short" });
    }

    try {
        switch (service) {
            case "google_maps":
                return NextResponse.json(await verifyGoogleMaps(key));
            case "nasa_firms":
                return NextResponse.json(await verifyNasaFirms(key));
            default:
                return NextResponse.json({ error: `Unknown service: ${service}` }, { status: 400 });
        }
    } catch (err) {
        console.error("[KeyVerify] Unexpected error:", err);
        return NextResponse.json({ error: "Verification request failed" }, { status: 500 });
    }
}

export const runtime = "nodejs";
