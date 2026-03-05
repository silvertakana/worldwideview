import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const timeParam = searchParams.get("time");

    if (!timeParam) {
        return NextResponse.json({ error: "Missing time parameter" }, { status: 400 });
    }

    const targetTimeMs = parseInt(timeParam);
    if (isNaN(targetTimeMs)) {
        return NextResponse.json({ error: "Invalid time parameter" }, { status: 400 });
    }

    const targetDate = new Date(targetTimeMs);

    const supabase = getSupabaseClient();
    if (!supabase) {
        return NextResponse.json({ records: [], targetTime: targetTimeMs });
    }

    try {
        // Find the closest timestamp before or exactly at target time
        const { data: timeData, error: timeError } = await supabase
            .from("aviation_history")
            .select("timestamp")
            .lte("timestamp", targetDate.toISOString())
            .order("timestamp", { ascending: false })
            .limit(1) as { data: { timestamp: string }[] | null, error: any };

        if (timeError) {
            console.error("[API/aviation/history] Supabase error:", timeError);
            return NextResponse.json({ records: [], targetTime: targetTimeMs });
        }

        if (!timeData || timeData.length === 0) {
            return NextResponse.json({ records: [], targetTime: targetTimeMs });
        }

        const closestTimestamp = timeData[0].timestamp;

        // Fetch all generic records that match this exact timestamp
        const { data: records, error: recordsError } = await supabase
            .from("aviation_history")
            .select("icao24, timestamp, latitude, longitude, altitude, heading, speed, callsign")
            .eq("timestamp", closestTimestamp);

        if (recordsError) {
            console.error("[API/aviation/history] Supabase records error:", recordsError);
            return NextResponse.json({ records: [], targetTime: targetTimeMs });
        }

        return NextResponse.json({
            records,
            recordTime: new Date(closestTimestamp).getTime()
        });

    } catch (err) {
        console.error("[API/aviation/history] Unexpected error:", err);
        return NextResponse.json({ records: [], targetTime: targetTimeMs });
    }
}
