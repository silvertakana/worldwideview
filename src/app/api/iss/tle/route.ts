import { NextResponse } from "next/server";

export const revalidate = 3600;

const WTIA_TLE_URL = "https://api.wheretheiss.at/v1/satellites/25544/tles/latest";

interface TleApiResponse {
    requested_timestamp: number;
    tle_timestamp: number;
    id: string;
    name: string;
    header: string;
    line1: string;
    line2: string;
}

function isValidTle(data: unknown): data is TleApiResponse {
    if (typeof data !== "object" || data === null) return false;
    const d = data as Record<string, unknown>;
    return (
        typeof d.line1 === "string"
        && typeof d.line2 === "string"
        && d.line1.length > 0
        && d.line2.length > 0
        && Number.isFinite(d.tle_timestamp)
    );
}

export async function GET() {
    try {
        const response = await fetch(WTIA_TLE_URL, {
            headers: {
                Accept: "application/json",
                "User-Agent": "WorldWideView/1.0",
            },
            next: { revalidate },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch ISS TLE data" },
                { status: 502 },
            );
        }

        const data = await response.json();

        if (!isValidTle(data)) {
            return NextResponse.json(
                { error: "Invalid ISS TLE data" },
                { status: 502 },
            );
        }

        return NextResponse.json({
            id: data.id,
            name: data.name,
            header: data.header,
            line1: data.line1,
            line2: data.line2,
            tleTimestamp: data.tle_timestamp,
        });
    } catch (error) {
        console.error("[IssTleRoute] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch ISS TLE data" },
            { status: 502 },
        );
    }
}
