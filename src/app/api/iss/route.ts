import { NextResponse } from "next/server";

export const revalidate = 10;

const WTIA_URL = "https://api.wheretheiss.at/v1/satellites/25544";

interface IssApiResponse {
    name: string;
    id: number;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    visibility: string;
    footprint: number;
    timestamp: number;
    units: string;
}

function isValidResponse(data: unknown): data is IssApiResponse {
    if (typeof data !== "object" || data === null) return false;
    const d = data as Record<string, unknown>;
    return (
        Number.isFinite(d.latitude)
        && Number.isFinite(d.longitude)
        && Number.isFinite(d.altitude)
        && Number.isFinite(d.velocity)
        && Number.isFinite(d.timestamp)
    );
}

export async function GET() {
    try {
        const response = await fetch(WTIA_URL, {
            headers: {
                Accept: "application/json",
                "User-Agent": "WorldWideView/1.0",
            },
            next: { revalidate },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch ISS position" },
                { status: 502 },
            );
        }

        const data = await response.json();

        if (!isValidResponse(data)) {
            return NextResponse.json(
                { error: "Invalid ISS position data" },
                { status: 502 },
            );
        }

        return NextResponse.json({
            id: data.id,
            name: data.name,
            latitude: data.latitude,
            longitude: data.longitude,
            altitude: data.altitude,
            velocity: data.velocity,
            visibility: data.visibility,
            footprint: data.footprint,
            timestamp: data.timestamp,
            units: data.units,
        });
    } catch (error) {
        console.error("[IssRoute] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch ISS position" },
            { status: 502 },
        );
    }
}
