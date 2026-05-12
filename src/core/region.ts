/**
 * Region detection module — orthogonal to NEXT_PUBLIC_WWV_EDITION.
 *
 * NEXT_PUBLIC_WWV_REGION controls default camera aim, bounding boxes,
 * and feed sources without changing auth rules or edition features.
 */

export type Region = "global" | "texas" | "austin";

const VALID_REGIONS: ReadonlySet<string> = new Set<Region>([
    "global",
    "texas",
    "austin",
]);

export function resolveRegion(raw?: string): Region {
    const value = (raw ?? "").trim().toLowerCase();
    if (VALID_REGIONS.has(value)) return value as Region;
    return "texas";
}

export const region: Region = resolveRegion(
    process.env.NEXT_PUBLIC_WWV_REGION,
);

export const isGlobal: boolean = region === "global";
export const isTexas: boolean = region === "texas" || region === "austin";
export const isAustin: boolean = region === "austin";
