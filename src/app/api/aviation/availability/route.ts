import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

// Cache the availability response for 5 minutes — this metadata changes slowly
let cachedAvailability: { data: unknown; expiresAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
    // Return cached response if still fresh
    if (cachedAvailability && Date.now() < cachedAvailability.expiresAt) {
        return NextResponse.json(cachedAvailability.data);
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return NextResponse.json({ availability: [] });
    }

    try {
        // For a true gap analysis without RPC, it's expensive.
        // We'll approximate by finding the absolute min and absolute max.
        // If there are large gaps, an RPC would be required to break this up.
        const { data: minData } = await supabase
            .from("aviation_history")
            .select("timestamp")
            .order("timestamp", { ascending: true })
            .limit(1);

        const { data: maxData } = await supabase
            .from("aviation_history")
            .select("timestamp")
            .order("timestamp", { ascending: false })
            .limit(1);

        const ranges = [];

        if (minData && minData.length > 0 && maxData && maxData.length > 0) {
            ranges.push({
                start: new Date((minData[0] as any).timestamp).getTime(),
                end: new Date((maxData[0] as any).timestamp).getTime(),
            });
        }

        const result = { availability: ranges };
        cachedAvailability = { data: result, expiresAt: Date.now() + TTL_MS };
        return NextResponse.json(result);
    } catch (err) {
        console.error("[API/aviation/availability] Error:", err);
        return NextResponse.json({ availability: [] });
    }
}
