import { fetchWsdotCameras } from "../wsdot/wsdotFetcher";
import type { CameraAdapter, CameraFeature } from "./types";

export const wsdotAdapter: CameraAdapter = {
    id: "wsdot",
    displayName: "WSDOT (Washington State)",
    region: "United States — Washington",
    requiresKey: {
        envVar: "WSDOT_API_KEY",
        signupUrl: "https://wsdot.wa.gov/traffic/api/",
    },
    fetch: async () => (await fetchWsdotCameras()) as CameraFeature[],
};
