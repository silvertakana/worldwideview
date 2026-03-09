import { globalState, POLL_INTERVAL } from "./state";

const MAX_BACKOFF = 5 * 60 * 1000; // 5 minutes
const LOW_CREDIT_THRESHOLD = 0.2; // 20% of daily budget
const DAILY_AUTH_CREDITS = 4000;

/**
 * Parse OpenSky rate-limit headers and store values in globalState.
 * Headers: X-Rate-Limit-Remaining, X-Rate-Limit-Retry-After-Seconds
 */
export function parseRateLimitHeaders(headers: Headers): void {
    const remaining = headers.get("X-Rate-Limit-Remaining");
    if (remaining !== null) {
        globalState.creditsRemaining = parseInt(remaining, 10);
        console.log(`[Aviation RateLimit] Credits remaining: ${globalState.creditsRemaining}`);
    }

    const retryAfter = headers.get("X-Rate-Limit-Retry-After-Seconds");
    if (retryAfter !== null) {
        globalState.retryAfterSec = parseInt(retryAfter, 10);
    }
}

/**
 * Compute the next poll backoff interval (ms) using:
 * 1. Server-requested retry-after (highest priority, from 429)
 * 2. Credit-aware adaptive scaling
 * 3. Base poll interval fallback
 */
export function computeBackoff(): number {
    // If the server told us to wait, honour that
    if (globalState.retryAfterSec && globalState.retryAfterSec > 0) {
        const retryMs = globalState.retryAfterSec * 1000;
        globalState.retryAfterSec = null; // consume once
        return Math.min(retryMs, MAX_BACKOFF);
    }

    const base = globalState.currentBackoff || POLL_INTERVAL;

    // If we have credit info, scale adaptively
    if (globalState.creditsRemaining !== null) {
        const ratio = globalState.creditsRemaining / DAILY_AUTH_CREDITS;

        if (ratio < LOW_CREDIT_THRESHOLD) {
            // Very low on credits — use max backoff
            return MAX_BACKOFF;
        }
        if (ratio < 0.5) {
            // Below half — double the base interval
            return Math.min(base * 2, MAX_BACKOFF);
        }
    }

    return Math.min(base, MAX_BACKOFF);
}
