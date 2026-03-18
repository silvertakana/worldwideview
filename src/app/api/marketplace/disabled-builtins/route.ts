import { NextResponse } from "next/server";
import { getDisabledBuiltinIds } from "@/lib/marketplace/repository";

/**
 * GET /api/marketplace/disabled-builtins
 * Returns the list of built-in plugin IDs that have been disabled.
 * Called by AppShell at startup to skip loading disabled built-ins.
 * No auth required — this is an internal-only API.
 */
export async function GET() {
    try {
        const disabled = await getDisabledBuiltinIds();
        return NextResponse.json({ disabledIds: [...disabled] });
    } catch (err) {
        console.error("[marketplace/disabled-builtins] Error:", err);
        return NextResponse.json({ disabledIds: [] });
    }
}
