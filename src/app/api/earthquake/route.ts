import { NextResponse } from "next/server";

export const revalidate = 120;

const FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

function isValidFeature(feature: any): boolean {
    const coordinates = feature?.geometry?.coordinates;
    const time = feature?.properties?.time;

    return Array.isArray(coordinates)
        && coordinates.length >= 2
        && Number.isFinite(coordinates[0])
        && Number.isFinite(coordinates[1])
        && Number.isFinite(time);
}

export async function GET() {
    try {
        const response = await fetch(FEED_URL, {
            headers: {
                Accept: "application/geo+json, application/json",
                "User-Agent": "WorldWideView/1.0",
            },
            next: { revalidate },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch earthquake feed" },
                { status: 502 },
            );
        }

        const data = await response.json();
        const features = Array.isArray(data?.features)
            ? data.features.filter(isValidFeature)
            : [];

        return NextResponse.json({
            type: "FeatureCollection",
            metadata: data?.metadata,
            bbox: data?.bbox,
            features,
        });
    } catch (error) {
        console.error("[EarthquakeRoute] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch earthquake feed" },
            { status: 502 },
        );
    }
}
