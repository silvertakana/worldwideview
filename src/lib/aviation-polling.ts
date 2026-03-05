import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Local file fallback for Next.js isolated process environments (like API routes vs instrumentation)
const CACHE_FILE = path.join(process.cwd(), ".next", "aviation-cache.json");// Global state to survive HMR in Next.js development
const globalState = globalThis as unknown as {
    aviationData: any;
    aviationTimestamp: number;
    aviationPollingStarted: boolean;
    aviationPollingInterval: NodeJS.Timeout | null;
    accessToken: string | null;
    tokenExpiry: number;
    isFetching: boolean;
    lastSupabaseInsert: number;
    currentBackoff: number;
};

if (globalState.aviationPollingStarted === undefined) {
    globalState.aviationData = null;
    globalState.aviationTimestamp = 0;
    globalState.aviationPollingStarted = false;
    globalState.aviationPollingInterval = null;
    globalState.accessToken = null;
    globalState.tokenExpiry = 0;
    globalState.isFetching = false;
    globalState.lastSupabaseInsert = 0;
    globalState.currentBackoff = 5000;
}

const POLL_INTERVAL = 5000; // 5 seconds

export function getCachedAviationData() {
    // If we have it in memory (same process), return it
    if (globalState.aviationData) {
        return {
            data: globalState.aviationData,
            timestamp: globalState.aviationTimestamp,
        };
    }

    // Otherwise try to load from the shared file cache (for API routes)
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const fileData = fs.readFileSync(CACHE_FILE, "utf-8");
            const parsed = JSON.parse(fileData);
            return {
                data: parsed.data,
                timestamp: parsed.timestamp,
            };
        }
    } catch (e) {
        // Ignore file read errors
        console.error("[Aviation Polling] Error reading file cache:", e);
    }

    return {
        data: null,
        timestamp: 0,
    };
}

export function startAviationPolling() {
    if (globalState.aviationPollingStarted) {
        return;
    }

    globalState.aviationPollingStarted = true;
    globalState.currentBackoff = POLL_INTERVAL;
    console.log(`[Aviation Polling] Starting background polling with initial interval ${POLL_INTERVAL}ms`);

    // Run immediately, the next poll will be scheduled in the finally block
    pollAviation();
}

async function pollAviation() {
    if (globalState.isFetching) return;
    globalState.isFetching = true;

    try {
        const now = Date.now();
        const username = process.env.OPENSKY_CLIENTID;
        const password = process.env.OPENSKY_CLIENTSECRET;
        const headers: Record<string, string> = {};

        // Try OAuth2 token first (for new accounts created after March 2025)
        const token = await getOpenSkyAccessToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        } else if (username && password) {
            // Fallback to Basic Auth (for legacy accounts)
            headers["Authorization"] =
                "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
        }

        const res = await fetch("https://opensky-network.org/api/states/all", {
            headers,
            // Don't cache via Next.js fetch cache, we manage our own manual interval
            cache: "no-store"
        });

        if (!res.ok) {
            // Apply exponential backoff: double the interval up to 5 minutes
            globalState.currentBackoff = Math.min((globalState.currentBackoff || POLL_INTERVAL) * 2, 5 * 60 * 1000);

            const retryAfter = res.headers.get("Retry-After");
            const retryInfo = retryAfter ? ` [Retry after: ${retryAfter}s]` : "";

            console.warn(`[Aviation Polling] OpenSky returned ${res.status}: ${res.statusText}${retryInfo} (Backing off to ${globalState.currentBackoff / 1000}s)`);

            // If rate limited and we have NO cache, we might want to try fallback. 
            // We'll update the cache with fallback data if needed.
            if (res.status === 429 && !globalState.aviationData) {
                console.log("[Aviation Polling] Rate limited by OpenSky and no cache. Attempting fallback to Supabase history...");
                const fallbackData = await getLatestFromSupabase();
                if (fallbackData) {
                    console.log(`[Aviation Polling] Fallback successful. Cached ${fallbackData.states.length} historical states.`);
                    globalState.aviationData = fallbackData;
                    globalState.aviationTimestamp = now;
                    updateFileCache(fallbackData, now);
                }
            }
        } else {
            // Reset backoff on success
            globalState.currentBackoff = POLL_INTERVAL;

            const data = await res.json();
            data._source = "live";

            console.log(`[Aviation Polling] Successfully fetched ${data.states ? data.states.length : 0} states from OpenSky`);
            globalState.aviationData = data;
            globalState.aviationTimestamp = now;
            updateFileCache(data, now);

            // Asynchronously save to Supabase to build history (do not block)
            // Throttle to once every 5 minutes to save Supabase CPU and prevent connection timeouts
            if (data.states && Array.isArray(data.states)) {
                if (now - (globalState.lastSupabaseInsert || 0) > 5 * 60 * 1000) {
                    globalState.lastSupabaseInsert = now;
                    recordToSupabase(data.states, data.time || Math.floor(now / 1000)).catch(err => {
                        console.error("[Aviation Polling] Supabase record error:", err);
                    });
                }
            }
        }
    } catch (err) {
        // Exponential backoff on error as well
        globalState.currentBackoff = Math.min((globalState.currentBackoff || POLL_INTERVAL) * 2, 5 * 60 * 1000);
        console.error(`[Aviation Polling] Error during poll (Backing off to ${globalState.currentBackoff / 1000}s):`, err);
        // On unexpected error, try fallback if we have no cache
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

        // Schedule next poll using currentBackoff
        if (globalState.aviationPollingInterval) {
            clearTimeout(globalState.aviationPollingInterval);
        }
        globalState.aviationPollingInterval = setTimeout(pollAviation, globalState.currentBackoff || POLL_INTERVAL);
    }
}

async function getOpenSkyAccessToken() {
    const now = Date.now();
    if (globalState.accessToken && now < globalState.tokenExpiry) {
        return globalState.accessToken;
    }

    const clientId = process.env.OPENSKY_CLIENTID;
    const clientSecret = process.env.OPENSKY_CLIENTSECRET;

    if (!clientId || !clientSecret) return null;

    if (!clientId.includes("@") && !clientId.endsWith("-api-client")) {
        return null;
    }

    try {
        const response = await fetch("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret,
            }),
            cache: "no-store"
        });

        if (!response.ok) {
            console.error(`[Aviation Polling] OAuth token error (${response.status}):`, await response.text());
            return null;
        }

        const data = await response.json();
        globalState.accessToken = data.access_token;
        globalState.tokenExpiry = now + (data.expires_in * 1000) - 30000;

        console.log("[Aviation Polling] Successfully acquired new OpenSky OAuth token");
        return globalState.accessToken;
    } catch (error) {
        console.error("[Aviation Polling] OAuth token request failed:", error);
        return null;
    }
}

export async function getLatestFromSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const withTimeout = async <T>(promiseLike: PromiseLike<T>, ms = 10000): Promise<T> => {
        let timeoutId: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`Supabase request timed out after ${ms / 1000}s`)), ms);
        });

        try {
            return await Promise.race([
                Promise.resolve(promiseLike),
                timeoutPromise
            ]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    };

    try {
        console.log("[Aviation Polling] Fetching latest timestamp from Supabase...");
        const { data: latestTS, error: tsError } = await withTimeout(
            supabase.from("aviation_history").select("timestamp").order("timestamp", { ascending: false }).limit(1)
        ) as { data: any, error: any };

        if (tsError) {
            console.error("[Aviation Polling] Supabase timestamp fetch error:", tsError.message);
            return null;
        }
        if (!latestTS || latestTS.length === 0) {
            console.log("[Aviation Polling] No historical data found in Supabase.");
            return null;
        }

        const timestamp = latestTS[0].timestamp;
        console.log(`[Aviation Polling] Found latest data from ${timestamp}. Fetching record batch...`);

        const { data: records, error: recError } = await withTimeout(
            supabase.from("aviation_history").select("*").eq("timestamp", timestamp)
        ) as { data: any, error: any };

        if (recError) {
            console.error("[Aviation Polling] Supabase records batch fetch error:", recError.message);
            return null;
        }
        if (!records) return null;

        console.log(`[Aviation Polling] Success! Retrieved ${records.length} historical states.`);

        const states = records.map((r: any) => [
            r.icao24, r.callsign, null, Math.floor(new Date(r.timestamp).getTime() / 1000), Math.floor(new Date(r.timestamp).getTime() / 1000), r.longitude, r.latitude, r.altitude, r.altitude === null || r.altitude <= 0, r.speed, r.heading, null, null, r.altitude, null, false, 0
        ]);

        return {
            states,
            time: Math.floor(new Date(timestamp).getTime() / 1000),
            _source: "supabase",
            _isFallback: true
        };
    } catch (e) {
        console.error("[Aviation Polling] Fallback error:", e);
        return null;
    }
}

async function recordToSupabase(states: any[], timeSecs: number) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const timestamp = new Date(timeSecs * 1000).toISOString();

    const records = states
        .filter(s => s[5] !== null && s[6] !== null)
        .map(s => ({
            timestamp,
            icao24: s[0],
            callsign: s[1]?.trim() || null,
            longitude: s[5],
            latitude: s[6],
            altitude: s[7],
            speed: s[9],
            heading: s[10],
        }));

    if (records.length === 0) return;

    const CHUNK_SIZE = 500;
    let successCount = 0;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("aviation_history").insert(chunk);

        if (error) {
            const errorMsg = error.message;
            if (errorMsg && errorMsg.includes("<!DOCTYPE html>")) {
                console.error(`[Aviation Polling] Failed to insert chunk: Supabase Host returned HTML error (likely Cloudflare 522/502). Instance might be paused.`);
                break; // Stop further chunk inserts if host is down
            } else {
                console.error(`[Aviation Polling] Failed to insert chunk:`, error.message);
            }
        } else {
            successCount += chunk.length;
        }
    }

    console.log(`[Aviation Polling] Recorded ${successCount}/${records.length} states to Supabase.`);
}

function updateFileCache(data: any, timestamp: number) {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CACHE_FILE, JSON.stringify({ data, timestamp }));
    } catch (err) {
        console.error("[Aviation Polling] Failed to write file cache:", err);
    }
}
