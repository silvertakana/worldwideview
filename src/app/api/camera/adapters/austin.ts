import type { CameraAdapter, CameraFeature } from "./types";

/**
 * Austin traffic cameras — merges two public feeds:
 *
 *  1. ATD Mobility Portal  (GeoJSON / JSON, no key)
 *     https://data.mobility.austin.gov/traffic-cameras
 *
 *  2. City of Austin Open Data (Socrata dataset b4k4-adkb, no key)
 *     https://data.austintexas.gov/resource/b4k4-adkb.json
 *
 * Only cameras with camera_status === "TURNED_ON" are included.
 * `screenshot_address` is used as the still-image stream URL.
 */

const ATD_URL = "https://data.mobility.austin.gov/traffic-cameras";
const SOCRATA_URL =
    "https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=500&$where=camera_status=%27TURNED_ON%27";

interface AtdFeature {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] } | null;
    properties: {
        CAMERA_ID?: string | number;
        CAMERA_MFG?: string;
        LOCATION_NAME?: string;
        SCREENSHOT_ADDRESS?: string;
        screenshot_address?: string;
        STATUS?: string;
        camera_status?: string;
        [k: string]: unknown;
    };
}

interface SocrataRow {
    camera_id?: string;
    location_name?: string;
    screenshot_address?: string;
    camera_status?: string;
    location?: { latitude?: string; longitude?: string };
    longitude?: string;
    latitude?: string;
    [k: string]: unknown;
}

function normAtd(features: AtdFeature[]): CameraFeature[] {
    return features
        .filter((f) => {
            const status =
                (f.properties.STATUS ?? f.properties.camera_status ?? "").toUpperCase();
            return status === "TURNED_ON" || status === "ON" || status === "";
        })
        .filter((f) => f.geometry?.coordinates?.length === 2)
        .map((f): CameraFeature => {
            const p = f.properties;
            const id = String(p.CAMERA_ID ?? p.camera_id ?? "");
            const stream =
                (p.SCREENSHOT_ADDRESS as string | undefined) ??
                (p.screenshot_address as string | undefined) ??
                null;
            return {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: f.geometry!.coordinates as [number, number],
                },
                properties: {
                    id: `austin-atd-${id}`,
                    source: "austin",
                    stream,
                    streamType: stream ? "image" : null,
                    name: (p.LOCATION_NAME as string | undefined) ?? id,
                    country: "United States",
                    region: "Texas — Austin",
                    city: "Austin",
                    categories: ["traffic"],
                },
            };
        });
}

function normSocrata(rows: SocrataRow[]): CameraFeature[] {
    return rows
        .filter((r) => {
            const s = (r.camera_status ?? "").toUpperCase();
            return s === "TURNED_ON";
        })
        .map((r): CameraFeature | null => {
            const lon = parseFloat(
                r.longitude ?? r.location?.longitude ?? ""
            );
            const lat = parseFloat(
                r.latitude ?? r.location?.latitude ?? ""
            );
            if (!isFinite(lon) || !isFinite(lat)) return null;
            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [lon, lat] },
                properties: {
                    id: `austin-soc-${r.camera_id ?? ""}`,
                    source: "austin",
                    stream: r.screenshot_address ?? null,
                    streamType: r.screenshot_address ? "image" : null,
                    name: r.location_name ?? r.camera_id ?? "",
                    country: "United States",
                    region: "Texas — Austin",
                    city: "Austin",
                    categories: ["traffic"],
                },
            };
        })
        .filter((f): f is CameraFeature => f !== null);
}

async function fetchAtd(): Promise<CameraFeature[]> {
    const res = await fetch(ATD_URL, {
        headers: { Accept: "application/json", "User-Agent": "WorldWideView/1.0" },
    });
    if (!res.ok) throw new Error(`ATD ${res.status}`);
    const json = await res.json();
    const features: AtdFeature[] = Array.isArray(json)
        ? json
        : (json?.features ?? []);
    return normAtd(features);
}

async function fetchSocrata(): Promise<CameraFeature[]> {
    const res = await fetch(SOCRATA_URL, {
        headers: { Accept: "application/json", "User-Agent": "WorldWideView/1.0" },
    });
    if (!res.ok) throw new Error(`Socrata ${res.status}`);
    const rows: SocrataRow[] = await res.json();
    return normSocrata(rows);
}

export const austinAdapter: CameraAdapter = {
    id: "austin",
    displayName: "Austin ATD (Texas)",
    region: "United States — Texas",
    cacheTtlMs: 15 * 60 * 1000, // 15-minute cache — cameras change status frequently

    fetch: async () => {
        const [atd, socrata] = await Promise.allSettled([fetchAtd(), fetchSocrata()]);

        const atdFeatures = atd.status === "fulfilled" ? atd.value : [];
        const socrataFeatures = socrata.status === "fulfilled" ? socrata.value : [];

        // Deduplicate by id — prefer ATD record when both sources have the same camera
        const seen = new Set<string>();
        const merged: CameraFeature[] = [];
        for (const f of [...atdFeatures, ...socrataFeatures]) {
            const key = f.properties.id ?? `${f.geometry.coordinates[0]},${f.geometry.coordinates[1]}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(f);
            }
        }
        return merged;
    },
};
