import { NextResponse } from "next/server";
import { getDisabledPluginIds } from "@/lib/marketplace/repository";
import { handlePreflight, withCors } from "@/lib/marketplace/cors";
import { marketplaceApiLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";

export async function OPTIONS(request: Request) {
    return handlePreflight(request);
}

/**
 * GET /api/marketplace/disabled-builtins
 * Returns the list of built-in plugin IDs that have been disabled.
 * Called by AppShell at startup to skip loading disabled built-ins.
 */
export async function GET(request: Request) {
    const rateLimited = marketplaceApiLimiter.check(getClientIp(request));
    if (rateLimited) return withCors(rateLimited, request);

    try {
        const disabled = await getDisabledPluginIds();
        return withCors(
            NextResponse.json({ disabledIds: [...disabled] }),
            request,
        );
    } catch (err) {
        console.error("[marketplace/disabled-builtins] Error:", err);
        return withCors(
            NextResponse.json({ disabledIds: [] }),
            request,
        );
    }
}
