import { globalState, POLL_INTERVAL } from "./state";
import { getOpenSkyAccessToken } from "./auth";
import { getLatestFromSupabase, recordToSupabase } from "./supabase";
import { updateFileCache } from "./cache";
import { parseRateLimitHeaders, computeBackoff } from "./rate-limit";
import { rotateCredential, getUsableCount } from "./credentials";

export async function pollAviation() {
    if (globalState.isFetching) return;
    globalState.isFetching = true;

    try {
        const now = Date.now();
        const headers: Record<string, string> = {};

        // Get OAuth2 token from the active credential in the pool
        const token = await getOpenSkyAccessToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch("https://opensky-network.org/api/states/all", {
            headers,
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
        });

        // Parse rate-limit headers (updates credits on active credential, may trigger rotation)
        parseRateLimitHeaders(res.headers);

        if (!res.ok) {
            // On any failure, rotate to the next credential immediately
            console.log(`[Aviation Polling] OpenSky ${res.status} — rotating credential (${getUsableCount()} remaining)`);
            rotateCredential();

            globalState.currentBackoff = computeBackoff();
            if (globalState.currentBackoff === POLL_INTERVAL) {
                globalState.currentBackoff = Math.min(
                    (globalState.currentBackoff || POLL_INTERVAL) * 2,
                    5 * 60 * 1000,
                );
            }

            const retryInfo = globalState.retryAfterSec
                ? ` [Server retry-after: ${globalState.retryAfterSec}s]`
                : "";
            console.warn(
                `[Aviation Polling] OpenSky returned ${res.status}: ${res.statusText}${retryInfo} (Backing off to ${globalState.currentBackoff / 1000}s)`,
            );

            if (res.status === 429 && !globalState.aviationData) {
                console.log("[Aviation Polling] Rate limited and no cache. Trying Supabase fallback...");
                const fallbackData = await getLatestFromSupabase();
                if (fallbackData) {
                    console.log(`[Aviation Polling] Fallback OK. Cached ${fallbackData.states.length} states.`);
                    globalState.aviationData = fallbackData;
                    globalState.aviationTimestamp = now;
                    updateFileCache(fallbackData, now);
                }
            }
        } else {
            globalState.currentBackoff = POLL_INTERVAL;

            const data = await res.json();
            data._source = "live";

            console.log(
                `[Aviation Polling] Fetched ${data.states ? data.states.length : 0} states from OpenSky`,
            );
            globalState.aviationData = data;
            globalState.aviationTimestamp = now;
            updateFileCache(data, now);

            if (data.states && Array.isArray(data.states)) {
                if (now - (globalState.lastSupabaseInsert || 0) > 5 * 60 * 1000) {
                    globalState.lastSupabaseInsert = now;
                    recordToSupabase(data.states, data.time || Math.floor(now / 1000)).catch(
                        (err) => console.error("[Aviation Polling] Supabase record error:", err),
                    );
                }
            }
        }
    } catch (err) {
        globalState.currentBackoff = Math.min(
            (globalState.currentBackoff || POLL_INTERVAL) * 2,
            5 * 60 * 1000,
        );

        const error = err as any;
        const isTimeout =
            error?.name === "AbortError" ||
            error?.name === "TimeoutError" ||
            error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
        const errorMessage = isTimeout
            ? "Connection timed out"
            : error?.message || String(error);
        console.error(
            `[Aviation Polling] Error (Backing off to ${globalState.currentBackoff / 1000}s): ${errorMessage}`,
        );

        if (!globalState.aviationData) {
            const fallbackData = await getLatestFromSupabase();
            if (fallbackData) {
                globalState.aviationData = fallbackData;
                globalState.aviationTimestamp = Date.now();
                updateFileCache(fallbackData, globalState.aviationTimestamp);
            }
        }
    } finally {
        globalState.isFetching = false;

        if (globalState.aviationPollingInterval) {
            clearTimeout(globalState.aviationPollingInterval);
        }
        const adaptiveInterval = computeBackoff();
        const jitter = Math.floor(Math.random() * 5000);
        globalState.aviationPollingInterval = setTimeout(
            pollAviation,
            adaptiveInterval + jitter,
        );
    }
}
