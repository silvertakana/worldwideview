import type { GdotCameraFeature } from "@/app/api/camera/gdot/gdotFetcher";

export interface TestResult {
    feature: GdotCameraFeature;
    status: "pending" | "testing" | "ok" | "error" | "timeout";
    httpStatus?: number | string;
    contentType?: string | null;
    latencyMs?: number;
    errorMsg?: string;
    testStartTime?: number;
}
