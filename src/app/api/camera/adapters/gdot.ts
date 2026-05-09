import { fetchGdotCameras } from "../gdot/gdotFetcher";
import type { CameraAdapter, CameraFeature } from "./types";

// GDOT's snapshot infrastructure (navigator-c2c.dot.ga.gov, vss5live.dot.ga.gov)
// has been retired upstream as of 2026 — both hosts NXDOMAIN. The metadata
// API still returns those URLs, so strip them so the client doesn't trigger
// DNS errors on click. Drop these entries from the filter list once GDOT
// publishes a working snapshot endpoint.
const DEAD_STREAM_HOSTS = [
    "navigator-c2c.dot.ga.gov",
    "vss5live.dot.ga.gov",
];

function isDeadHost(url: string | null | undefined): boolean {
    if (!url) return false;
    return DEAD_STREAM_HOSTS.some((h) => url.includes(h));
}

export const gdotAdapter: CameraAdapter = {
    id: "gdot",
    displayName: "GDOT (Georgia)",
    region: "United States — Georgia",
    fetch: async () => {
        const features = (await fetchGdotCameras()) as CameraFeature[];
        return features.map((f) => {
            const p = f.properties;
            const stream = isDeadHost(p.stream) ? null : (p.stream ?? null);
            const hls = isDeadHost(p.hls) ? null : (p.hls ?? null);
            return {
                ...f,
                properties: { ...p, stream, hls },
            };
        });
    },
};
