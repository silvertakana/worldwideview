import { NextResponse } from "next/server";
import { getCachedMilitaryData } from "../../../lib/military/cache";

export async function GET() {
    const cache = getCachedMilitaryData();

    if (cache.data) {
        return NextResponse.json(cache.data);
    }

    console.warn(
        "[API/military] Cache empty. Returning empty state.",
    );
    return NextResponse.json(
        { ac: [], total: 0, now: Date.now() },
        { status: 200 },
    );
}
