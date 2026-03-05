import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET() {
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

        return NextResponse.json({ availability: ranges });
    } catch (err) {
        console.error("[API/aviation/availability] Error:", err);
        return NextResponse.json({ availability: [] });
    }
}
