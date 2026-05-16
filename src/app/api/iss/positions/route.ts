import { NextResponse } from "next/server";

export const revalidate = 60;

const WTIA_POSITIONS_URL = "https://api.wheretheiss.at/v1/satellites/25544/positions";
const MAX_TIMESTAMPS = 10;

function isValidPosition(item: any): boolean {
    return (
        item != null
        && typeof item === "object"
        && Number.isFinite(item.latitude)
        && Number.isFinite(item.longitude)
        && Number.isFinite(item.altitude)
        && Number.isFinite(item.velocity)
        && Number.isFinite(item.timestamp)
    );
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const timestampsParam = searchParams.get("timestamps");

    if (!timestampsParam) {
        return NextResponse.json(
            { error: "Missing required 'timestamps' query parameter" },
            { status: 400 },
        );
    }

    const timestamps = timestampsParam
        .split(",")
        .map((t) => t.trim())
        .filter((t) => /^\d+$/.test(t));

    if (timestamps.length === 0) {
        return NextResponse.json(
            { error: "No valid timestamps provided" },
            { status: 400 },
        );
    }

    if (timestamps.length > MAX_TIMESTAMPS) {
        return NextResponse.json(
            { error: `Maximum ${MAX_TIMESTAMPS} timestamps allowed per request` },
            { status: 400 },
        );
    }

    try {
        const url = `${WTIA_POSITIONS_URL}?timestamps=${timestamps.join(",")}&units=kilometers`;

        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                "User-Agent": "WorldWideView/1.0",
            },
            next: { revalidate },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch ISS positions" },
                { status: 502 },
            );
        }

        const data = await response.json();
        const positions = (Array.isArray(data) ? data : [])
            .filter(isValidPosition)
            .map((p) => ({
                latitude: p.latitude,
                longitude: p.longitude,
                altitude: p.altitude,
                velocity: p.velocity,
                visibility: p.visibility,
                timestamp: p.timestamp,
            }));

        return NextResponse.json({ positions });
    } catch (error) {
        console.error("[IssPositionsRoute] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch ISS positions" },
            { status: 502 },
        );
    }
}
