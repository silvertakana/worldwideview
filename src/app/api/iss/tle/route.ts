import { NextResponse } from "next/server";

export const revalidate = 3600;

const WTIA_TLE_URL = "https://api.wheretheiss.at/v1/satellites/25544/tles/latest";

function isValidTle(data: any): boolean {
    return (
        data != null
        && typeof data === "object"
        && typeof data.line1 === "string"
        && typeof data.line2 === "string"
        && data.line1.length > 0
        && data.line2.length > 0
        && Number.isFinite(data.tle_timestamp)
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
