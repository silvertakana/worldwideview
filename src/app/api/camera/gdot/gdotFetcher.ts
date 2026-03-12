/**
 * Fetches all traffic camera data from the GDOT ArcGIS REST API.
 *
 * The API paginates at 2000 records, so we loop with `resultOffset`
 * until all features are retrieved.
 */

const GDOT_BASE =
    "https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services" +
    "/GDOT_Live_Traffic_Cameras/FeatureServer/0/query";

const PAGE_SIZE = 2000;

export interface GdotCameraFeature {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: {
        stream: string;
        hls: string | null;
        country: string;
        region: string;
        city: string;
        source: string;
        name: string;
        route: string;
        direction: string;
        location_description: string;
        categories: string[];
    };
}

/** Convert a raw ArcGIS feature into our GeoJSON format. */
function toGeoJsonFeature(raw: any): GdotCameraFeature | null {
    const { attributes: a, geometry: g } = raw;
    if (!g?.x || !g?.y) return null;

    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [g.x, g.y] },
        properties: {
            stream: a.HLS || a.url || "",
            hls: a.HLS || null,
            country: "United States",
            region: `${a.county || ""} County, Georgia`,
            city: a.subdivision || "Georgia",
            source: "gdot",
            name: a.name || "",
            route: a.route || "",
            direction: a.dir || "",
            location_description: a.location_description || "",
            categories: ["traffic"],
        },
    };
}

/** Fetch all GDOT cameras, handling ArcGIS pagination. */
export async function fetchGdotCameras(): Promise<GdotCameraFeature[]> {
    const all: GdotCameraFeature[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const params = new URLSearchParams({
            where: "1=1",
            outFields: "*",
            outSR: "4326",
            f: "json",
            resultRecordCount: String(PAGE_SIZE),
            resultOffset: String(offset),
        });

        const res = await fetch(`${GDOT_BASE}?${params}`, {
            headers: { "User-Agent": "WorldWideView/1.0" },
        });

        if (!res.ok) throw new Error(`GDOT API returned ${res.status}`);

        const json = await res.json();
        const features = json.features || [];

        for (const f of features) {
            const converted = toGeoJsonFeature(f);
            if (converted) all.push(converted);
        }

        hasMore = json.exceededTransferLimit === true;
        offset += features.length;
    }

    return all;
}
