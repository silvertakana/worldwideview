import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/** Minimum length sanity check before attempting verification. */
const MIN_KEY_LENGTH = 20;

async function verifyGoogleMaps(key: string): Promise<{ valid: boolean; error?: string }> {
    // Use a minimal Places Autocomplete request as a probe
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=a&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
        return { valid: true };
    }
    return { valid: false, error: data.error_message || data.status };
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
    const session = await auth();
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
