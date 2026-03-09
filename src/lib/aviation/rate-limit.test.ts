import { describe, it, expect, beforeEach } from "vitest";
import { parseRateLimitHeaders, computeBackoff } from "./rate-limit";
import { globalState, POLL_INTERVAL } from "./state";

/** Helper to create a Headers object from a plain record. */
function makeHeaders(entries: Record<string, string>): Headers {
    return new Headers(entries);
}

describe("Rate Limit", () => {
    beforeEach(() => {
        globalState.creditsRemaining = null;
        globalState.retryAfterSec = null;
        globalState.currentBackoff = POLL_INTERVAL;
    });

    describe("parseRateLimitHeaders", () => {
        it("should extract credits remaining", () => {
            const headers = makeHeaders({ "X-Rate-Limit-Remaining": "3200" });
            parseRateLimitHeaders(headers);
            expect(globalState.creditsRemaining).toBe(3200);
        });

        it("should extract retry-after seconds", () => {
            const headers = makeHeaders({ "X-Rate-Limit-Retry-After-Seconds": "120" });
            parseRateLimitHeaders(headers);
            expect(globalState.retryAfterSec).toBe(120);
        });

        it("should handle missing headers gracefully", () => {
            const headers = makeHeaders({});
            parseRateLimitHeaders(headers);
            expect(globalState.creditsRemaining).toBeNull();
            expect(globalState.retryAfterSec).toBeNull();
        });
    });

    describe("computeBackoff", () => {
        it("should return server retry-after when available", () => {
            globalState.retryAfterSec = 60;
            const result = computeBackoff();
            expect(result).toBe(60_000);
            // Should be consumed (null after use)
            expect(globalState.retryAfterSec).toBeNull();
        });

        it("should cap retry-after at 5 minutes", () => {
            globalState.retryAfterSec = 600; // 10 min
            const result = computeBackoff();
            expect(result).toBe(5 * 60 * 1000);
        });

        it("should return max backoff when credits are very low", () => {
            globalState.creditsRemaining = 100; // 2.5% of 4000
            const result = computeBackoff();
            expect(result).toBe(5 * 60 * 1000);
        });

        it("should double interval when credits are below 50%", () => {
            globalState.currentBackoff = POLL_INTERVAL;
            globalState.creditsRemaining = 1500; // 37.5%
            const result = computeBackoff();
            expect(result).toBe(POLL_INTERVAL * 2);
        });

        it("should return base interval when credits info is unknown", () => {
            globalState.creditsRemaining = null;
            globalState.currentBackoff = POLL_INTERVAL;
            const result = computeBackoff();
            expect(result).toBe(POLL_INTERVAL);
        });

        it("should return base interval when credits are plentiful", () => {
            globalState.creditsRemaining = 3500; // 87.5%
            globalState.currentBackoff = POLL_INTERVAL;
            const result = computeBackoff();
            expect(result).toBe(POLL_INTERVAL);
        });
    });
});
