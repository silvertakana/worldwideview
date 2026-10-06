/**
 * Guards for the Places search route.
 *
 * The route is billed, so two things must hold before any upstream call: the per-IP
 * Places budget (which this branch's merge brought over from the rate-limit work) and
 * the query cap. Both are asserted here because dropping either would otherwise leave
 * CI green.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "./route";
import { placesLimiter } from "@/lib/rateLimiters";
import { autocompletePlaces } from "@/lib/places/googlePlaces";

vi.mock("@/lib/places/googlePlaces", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/places/googlePlaces")>();
    return { ...actual, autocompletePlaces: vi.fn() };
});

vi.mock("@/lib/rateLimit", () => ({
    getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/rateLimiters", () => ({
    placesLimiter: { check: vi.fn() },
}));

// Literal on purpose: deriving the cap from the module under test would let a
// mutated cap keep this suite green.
const QUERY_MAX = 256;

function search(query: string): Promise<Response> {
    return GET(new Request(`http://localhost/api/places/search?input=${encodeURIComponent(query)}`));
}

describe("GET /api/places/search", () => {
    beforeEach(() => {
        vi.mocked(placesLimiter.check).mockReturnValue(null);
        vi.mocked(autocompletePlaces).mockResolvedValue([]);
        process.env.GOOGLE_MAPS_API_KEY = "A".repeat(39);
    });

    it("answers 429 without calling Google when the per-IP budget is spent", async () => {
        vi.mocked(placesLimiter.check).mockReturnValue(
            NextResponse.json({ error: "Too many requests" }, { status: 429 }),
        );

        const response = await search("Berlin");

        expect(response.status).toBe(429);
        expect(vi.mocked(autocompletePlaces)).not.toHaveBeenCalled();
    });

    it("rejects a query longer than the cap and never calls Google", async () => {
        const response = await search("a".repeat(QUERY_MAX + 1));

        expect(response.status).toBe(400);
        expect(vi.mocked(autocompletePlaces)).not.toHaveBeenCalled();
    });

    it("accepts a query exactly at the cap", async () => {
        const response = await search("a".repeat(QUERY_MAX));

        expect(response.status).toBe(200);
        expect(vi.mocked(autocompletePlaces)).toHaveBeenCalledTimes(1);
    });
});
