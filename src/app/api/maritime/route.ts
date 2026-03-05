import { NextResponse } from "next/server";
import { getCachedVessels } from "@/lib/ais-stream";

/**
 * Maritime AIS proxy.
 * Returns live data from aisstream.io.
 */
export async function GET() {
    const vessels = getCachedVessels();

    // If the cache is completely empty, we return null to trigger the fallback demo data
    // in the plugin while the websocket populates. Once it's running, we return the real array.
    if (vessels.length === 0) {
        return NextResponse.json({ vessels: null });
    }

    // Format the cached data into GeoEntities
    const geoEntities = vessels.map((v) => ({
        id: `maritime-${v.mmsi}`,
        pluginId: "maritime",
        latitude: v.lat,
        longitude: v.lon,
        heading: v.heading,
        speed: v.speed,
        timestamp: v.timestamp,
        label: v.name,
        properties: {
            mmsi: v.mmsi,
            vesselName: v.name,
            vesselType: v.type, // TODO: Enhance with real type categorization if needed
            speed_knots: v.speed,
            heading: v.heading,
        },
    }));

    return NextResponse.json({ vessels: geoEntities });
}
