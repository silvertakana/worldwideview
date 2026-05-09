import { fetch511NyCameras } from "../ny511/ny511Fetcher";
import type { CameraAdapter, CameraFeature } from "./types";

export const ny511Adapter: CameraAdapter = {
    id: "ny511",
    displayName: "511NY (New York State)",
    region: "United States — New York",
    fetch: async () => (await fetch511NyCameras()) as CameraFeature[],
};
