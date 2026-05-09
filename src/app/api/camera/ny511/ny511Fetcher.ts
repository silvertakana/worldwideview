/**
 * Fetches all NYSDOT / 511NY traffic cameras.
 *
 * API: https://511ny.org/api/getcameras?key=<KEY>&format=json
 * Public API; key parameter is required but the endpoint accepts any value.
 * Self-hosters can set NY511_API_KEY to a real key (free at
 * https://511ny.org/developers) for first-class rate-limit treatment.
 *
 * Returns ~1,500 enabled cameras across NY State, ~80% with HLS streams.
 */

import type { GdotCameraFeature } from "../gdot/gdotFetcher";

const NY511_BASE = "https://511ny.org/api/getcameras";

interface Ny511Camera {
    Latitude: number;
    Longitude: number;
    ID: string;
    Name: string | null;
    DirectionOfTravel: string | null;
    RoadwayName: string | null;
    Url: string | null;
    VideoUrl: string | null;
    Disabled: boolean;
    Blocked: boolean;
}

/** Pull a county/region hint out of `RoadwayName [Region]` if present. */
function extractCity(roadwayName: string | null): string {
    if (!roadwayName) return "New York";
    const m = roadwayName.match(/\[([^\]]+)\]/);
    return m ? m[1].trim() : "New York";
}

function toGeoJsonFeature(c: Ny511Camera): GdotCameraFeature | null {
    if (c.Disabled || c.Blocked) return null;
    if (typeof c.Latitude !== "number" || typeof c.Longitude !== "number") return null;

    const hls = c.VideoUrl ?? null;

    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.Longitude, c.Latitude] },
        properties: {
            stream: hls || c.Url || "",
            hls,
            country: "United States",
            region: "New York",
            city: extractCity(c.RoadwayName),
            source: "ny511",
            name: c.ID || "",
            route: c.RoadwayName?.replace(/\s*\[[^\]]+\]\s*$/, "").trim() || "",
            direction: c.DirectionOfTravel === "Unknown" ? "" : (c.DirectionOfTravel ?? ""),
            location_description: c.Name ?? "",
            categories: ["traffic"],
        },
    };
}

/** Fetch all 511NY cameras. */
export async function fetch511NyCameras(): Promise<GdotCameraFeature[]> {
    const key = process.env.NY511_API_KEY || "test";
    const url = `${NY511_BASE}?key=${encodeURIComponent(key)}&format=json`;

    const res = await fetch(url, {
        headers: { "User-Agent": "WorldWideView/1.0" },
    });
    if (!res.ok) throw new Error(`511NY API returned ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const cameras: GdotCameraFeature[] = [];
    for (const c of data) {
        const f = toGeoJsonFeature(c as Ny511Camera);
        if (f) cameras.push(f);
    }
    return cameras;
}
