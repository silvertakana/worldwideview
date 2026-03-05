import { NextResponse } from "next/server";
import { getCachedAviationData, getLatestFromSupabase } from "../../../lib/aviation-polling";

export async function GET() {
    // 1. Try to get cached data from our background polling service
    const cache = getCachedAviationData();

    if (cache && cache.data) {
        return NextResponse.json(cache.data);
    }

    // 2. Clearer logging for the fallback chain
    const cacheReason = cache.timestamp === 0 ? "Memory & Disk cache empty" : "Cache potentially stagnant";
    console.log(`[API/aviation] ${cacheReason}. Attempting 10s timeout fallback to Supabase history...`);

    const fallbackData = await getLatestFromSupabase();
    if (fallbackData) {
        console.log(`[API/aviation] Fallback successful: Returning ${fallbackData.states?.length || 0} historical states.`);
        return NextResponse.json(fallbackData);
    }

    // 3. Complete fallback empty state
    console.warn("[API/aviation] All caches were empty and Supabase fallback failed (likely timeout). Returning empty state.");
    return NextResponse.json(
        { states: [], time: Math.floor(Date.now() / 1000) },
        { status: 200 }
    );
}
