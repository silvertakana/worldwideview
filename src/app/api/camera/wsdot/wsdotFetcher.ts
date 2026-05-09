/**
 * Fetches all WSDOT (Washington State DOT) highway cameras.
 *
 * API: https://wsdot.wa.gov/Traffic/api/HighwayCameras/HighwayCamerasREST.svc/GetCamerasAsJson?AccessCode=<KEY>
 * Requires a free WSDOT Traveler Information API key
 * (https://wsdot.wa.gov/traffic/api/). Returns ~1,600 active cameras across
 * Washington State plus ~70 ODOT-shared cameras at I-5/I-205 border
 * crossings into Oregon. All cameras return direct JPG snapshot URLs.
 *
 * Without WSDOT_API_KEY set, the fetcher returns [] (logged once on first
 * call) so the combined endpoint stays operational.
 */

import type { GdotCameraFeature } from "../gdot/gdotFetcher";

const WSDOT_BASE =
    "https://wsdot.wa.gov/Traffic/api/HighwayCameras/HighwayCamerasREST.svc/GetCamerasAsJson";

interface WsdotCamera {
    CameraID: number;
    CameraLocation: {
        Description: string | null;
        Direction: string | null;
        Latitude: number;
        Longitude: number;
        MilePost: number | null;
        RoadName: string | null;
    };
    CameraOwner: string | null;
    Description: string | null;
    DisplayLatitude: number;
    DisplayLongitude: number;
    ImageHeight: number;
    ImageWidth: number;
    ImageURL: string;
    IsActive: boolean;
    OwnerURL: string | null;
    Region: string | null;
    SortOrder: number;
    Title: string | null;
}

let warnedMissingKey = false;

function toGeoJsonFeature(c: WsdotCamera): GdotCameraFeature | null {
    if (!c.IsActive) return null;
    if (!c.ImageURL) return null;

    const lat = c.DisplayLatitude ?? c.CameraLocation?.Latitude;
    const lon = c.DisplayLongitude ?? c.CameraLocation?.Longitude;
    if (typeof lat !== "number" || typeof lon !== "number") return null;

    const owner = c.CameraOwner ?? "";
    const isOdot = /odot|tripcheck/i.test(owner);

    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: {
            stream: c.ImageURL,
            hls: null,
            country: "United States",
            region: isOdot ? "Oregon" : "Washington",
            city: isOdot ? "Oregon" : "Washington",
            source: "wsdot",
            name: c.Title ?? `Camera ${c.CameraID}`,
            route: c.CameraLocation?.RoadName ?? "",
            direction: c.CameraLocation?.Direction ?? "",
            location_description: c.Title ?? c.Description ?? "",
            categories: ["traffic"],
        },
    };
}

/** Fetch all WSDOT cameras. Requires WSDOT_API_KEY env var. */
export async function fetchWsdotCameras(): Promise<GdotCameraFeature[]> {
    const key = process.env.WSDOT_API_KEY;
    if (!key) {
        if (!warnedMissingKey) {
            console.warn(
                "[WSDOT] WSDOT_API_KEY not set — skipping. " +
                "Get a free key at https://wsdot.wa.gov/traffic/api/",
            );
            warnedMissingKey = true;
        }
        return [];
    }

    const url = `${WSDOT_BASE}?AccessCode=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
        headers: { "User-Agent": "WorldWideView/1.0" },
    });
    if (!res.ok) throw new Error(`WSDOT API returned ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const cameras: GdotCameraFeature[] = [];
    for (const c of data) {
        const f = toGeoJsonFeature(c as WsdotCamera);
        if (f) cameras.push(f);
    }
    return cameras;
}
