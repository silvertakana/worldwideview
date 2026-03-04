import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// In-memory cache
let cachedData: unknown = null;
let cacheTimestamp = 0;
const CACHE_TTL = 15000; // 15 seconds

export async function GET() {
    const now = Date.now();

    // Return cached data if fresh
    if (cachedData && now - cacheTimestamp < CACHE_TTL) {
        console.log(`[API/aviation] Returning cached data (${now - cacheTimestamp}ms old)`);
        return NextResponse.json(cachedData);
    }

    try {
        const username = process.env.OPENSKY_USERNAME;
        const password = process.env.OPENSKY_PASSWORD;

        const headers: Record<string, string> = {};
        if (username && password) {
            headers["Authorization"] =
                "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
        }

        const res = await fetch("https://opensky-network.org/api/states/all", {
            headers,
            next: { revalidate: 15 },
        });

        if (!res.ok) {
            console.warn(`[API/aviation] OpenSky returned ${res.status}: ${res.statusText}`);

            // If we have cached data, return it even if it's slightly stale, 
            // especially on 429 (Rate Limit) to keep the UI functional.
            if (cachedData) {
                console.log("[API/aviation] Returning in-memory cached data due to OpenSky error/rate-limit");
                return NextResponse.json(cachedData);
            }

            // FALLBACK: If we are rate limited and have no in-memory cache, 
            // try to fetch the most recent data from Supabase history.
            if (res.status === 429) {
                console.log("[API/aviation] Rate limited by OpenSky. Attempting fallback to Supabase history...");
                const fallbackData = await getLatestFromSupabase();
                if (fallbackData) {
                    console.log(`[API/aviation] Fallback successful. Returning ${fallbackData.states.length} historical states.`);
                    return NextResponse.json(fallbackData);
                }
            }

            return NextResponse.json(
                { states: [], time: Math.floor(now / 1000), error: `OpenSky returned ${res.status}: ${res.statusText}`, isRateLimited: res.status === 429 },
                { status: res.status === 429 ? 200 : res.status }
            );
        }

        const data = await res.json();
        // Add source metadata for frontend awareness
        data._source = "live";

        console.log(`[API/aviation] Successfully fetched ${data.states ? data.states.length : 0} states from OpenSky`);
        cachedData = data;
        cacheTimestamp = now;

        // Asynchronously save to Supabase to build history (do not block the response)
        if (data.states && Array.isArray(data.states)) {
            recordToSupabase(data.states, data.time || Math.floor(now / 1000)).catch(err => {
                console.error("[API/aviation] Supabase record error:", err);
            });
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error("[API/aviation] Error:", err);
        if (cachedData) return NextResponse.json(cachedData);

        // Final attempt at fallback on unexpected error
        const fallbackData = await getLatestFromSupabase();
        if (fallbackData) return NextResponse.json(fallbackData);

        return NextResponse.json(
            { states: [], time: Math.floor(now / 1000) },
            { status: 200 }
        );
    }
}

// Helper to fetch the latest global snapshot from history
async function getLatestFromSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Find the latest timestamp
        const { data: latestTS, error: tsError } = await supabase
            .from("aviation_history")
            .select("timestamp")
            .order("timestamp", { ascending: false })
            .limit(1);

        if (tsError || !latestTS || latestTS.length === 0) return null;

        const timestamp = latestTS[0].timestamp;

        // 2. Get all states for that timestamp
        const { data: records, error: recError } = await supabase
            .from("aviation_history")
            .select("*")
            .eq("timestamp", timestamp);

        if (recError || !records) return null;

        // 3. Map back to OpenSky "states" format:
        // [icao24, callsign, origin_country, time_position, last_contact, longitude, latitude, baro_altitude, on_ground, velocity, true_track, vertical_rate, sensors, geo_altitude, squawk, spi, position_source]
        const states = records.map(r => [
            r.icao24,
            r.callsign,
            null, // origin_country unknown
            Math.floor(new Date(r.timestamp).getTime() / 1000), // time_position
            Math.floor(new Date(r.timestamp).getTime() / 1000), // last_contact
            r.longitude,
            r.latitude,
            r.altitude,
            r.altitude === null || r.altitude <= 0, // on_ground
            r.speed,
            r.heading,
            null, // vertical_rate
            null, // sensors
            r.altitude, // geo_altitude
            null, // squawk
            false, // spi
            0 // position_source
        ]);

        return {
            states,
            time: Math.floor(new Date(timestamp).getTime() / 1000),
            _source: "supabase",
            _isFallback: true
        };
    } catch (e) {
        console.error("[API/aviation] Fallback error:", e);
        return null;
    }
}

// Fire-and-forget helper to save states to Supabase
async function recordToSupabase(states: any[], timeSecs: number) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return; // Supabase not configured, skip recording
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const timestamp = new Date(timeSecs * 1000).toISOString();

    // Map the OpenSky states array to our database schema
    // OpenSky array format:
    // [icao24, callsign, origin_country, time_position, last_contact, longitude, latitude, baro_altitude, on_ground, velocity, true_track, vertical_rate, sensors, geo_altitude, squawk, spi, position_source]
    const records = states
        .filter(s => s[5] !== null && s[6] !== null) // must have valid lon/lat
        .map(s => ({
            timestamp,
            icao24: s[0],
            callsign: s[1]?.trim() || null,
            longitude: s[5],
            latitude: s[6],
            altitude: s[7], // baro_altitude (meters)
            speed: s[9],    // velocity (m/s)
            heading: s[10], // true_track
        }));

    if (records.length === 0) return;

    // Supabase allows bulk inserts, but a single payload with 5000+ planes can hit PostgREST limits (400 Bad Request)
    // We chunk the inserts into smaller batches.
    const CHUNK_SIZE = 2000;
    let successCount = 0;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("aviation_history").insert(chunk);

        if (error) {
            console.error(`[API/aviation] Failed to insert chunk into Supabase:`, error.message);
        } else {
            successCount += chunk.length;
        }
    }

    console.log(`[API/aviation] Recorded ${successCount}/${records.length} states to Supabase history.`);
}
