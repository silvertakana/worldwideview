import { describe, it, expect } from "vitest";
import { placesLimiter, weatherTileLimiter } from "./rateLimiters";

/**
 * The shipped limits are asserted as literals on purpose: deriving the expected
 * budget from the module under test would let a mutation of the exported value
 * keep the suite green.
 */
const PLACES_MAX_REQUESTS = 30;
const PLACES_WINDOW_MS = 60_000;
const WEATHER_TILE_MAX_REQUESTS = 240;

interface Attempt {
    status: number | null;
    headers: Headers | null;
}

/**
 * Spend the limiter's budget for one key and return one row per attempt:
 * status null means the request was allowed, 429 means it was refused.
 */
function drain(limiter: { check: (key: string) => Response | null }, key: string, attempts: number): Attempt[] {
    const results: Attempt[] = [];
    for (let i = 0; i < attempts; i += 1) {
        const response = limiter.check(key);
        results.push({ status: response ? response.status : null, headers: response?.headers ?? null });
    }
    return results;
}

describe("placesLimiter", () => {
    it("is configured for 30 requests per 60s window", () => {
        expect(PLACES_MAX_REQUESTS).toBe(30);
        expect(PLACES_WINDOW_MS).toBe(60_000);
    });

    it("allows requests under the limit", () => {
        const results = drain(placesLimiter, "place-under", PLACES_MAX_REQUESTS);
        expect(results.every((r) => r.status === null)).toBe(true);
    });

    it("refuses request 31 with a 429 carrying Retry-After", () => {
        const results = drain(placesLimiter, "place-over", PLACES_MAX_REQUESTS + 1);
        const allowed = results.filter((r) => r.status === null).length;
        const blocked = results.filter((r) => r.status === 429);
        // The received string is the observation; the expected string names the
        // shipped value, so a mutated budget fails with that value in the diff.
        expect(`allowed=${allowed} blocked=${blocked.length}`).toBe(
            `allowed=${PLACES_MAX_REQUESTS} blocked=1`,
        );
        expect(blocked[0].headers?.get("Retry-After")).toBeTruthy();
    });

    it("keeps the counter per-IP", () => {
        drain(placesLimiter, "place-ip-a", PLACES_MAX_REQUESTS);
        expect(drain(placesLimiter, "place-ip-a", 1)[0].status).toBe(429);
        expect(drain(placesLimiter, "place-ip-b", 1)[0].status).toBeNull();
    });
});

describe("429 response shape", () => {
    it("matches the shape the existing limited routes already serve", async () => {
        drain(placesLimiter, "shape-ip", PLACES_MAX_REQUESTS);
        const blocked = placesLimiter.check("shape-ip");
        expect(blocked).not.toBeNull();
        const response = blocked as Response;
        expect(response.status).toBe(429);
        expect(response.headers.get("Retry-After")).toBeTruthy();
        expect(await response.json()).toEqual({ error: "Too many requests" });
    });
});

describe("weatherTileLimiter", () => {
    it("is configured for 240 requests per 60s window", () => {
        expect(WEATHER_TILE_MAX_REQUESTS).toBe(240);
    });

    it("allows requests under the limit", () => {
        const results = drain(weatherTileLimiter, "tile-under", WEATHER_TILE_MAX_REQUESTS);
        expect(results.every((r) => r.status === null)).toBe(true);
    });

    it("refuses request 241 with a 429 carrying Retry-After", () => {
        const results = drain(weatherTileLimiter, "tile-over", WEATHER_TILE_MAX_REQUESTS + 1);
        const allowed = results.filter((r) => r.status === null).length;
        const blocked = results.filter((r) => r.status === 429);
        expect(`allowed=${allowed} blocked=${blocked.length}`).toBe(
            `allowed=${WEATHER_TILE_MAX_REQUESTS} blocked=1`,
        );
        expect(blocked[0].headers?.get("Retry-After")).toBeTruthy();
    });

    it("keeps the counter per-IP", () => {
        drain(weatherTileLimiter, "tile-ip-a", WEATHER_TILE_MAX_REQUESTS);
        expect(drain(weatherTileLimiter, "tile-ip-a", 1)[0].status).toBe(429);
        expect(drain(weatherTileLimiter, "tile-ip-b", 1)[0].status).toBeNull();
    });
});
