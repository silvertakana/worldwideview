import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { corsHeaders, handlePreflight } from "@/lib/marketplace/cors";
import { edition, isDemo, isPluginInstallEnabled } from "@/core/edition";

/** Lightweight endpoint for middleware to check if first-run setup is needed. */
export async function OPTIONS(request: Request) {
    return handlePreflight(request);
}

export async function GET(request: Request) {
    try {
        // Demo edition skips the DB query — it's pre-configured, no setup needed.
        const needsSetup = isDemo ? false : (await prisma.betterAuthUser.count()) === 0;
        const res = NextResponse.json({
            needsSetup,
            edition,
            pluginManagementEnabled: isPluginInstallEnabled,
        });
        const headers = corsHeaders(request);
        for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
        return res;
    } catch (err) {
        console.error("[setup-status] Database error:", err);
        const res = NextResponse.json(
            { error: "database_unavailable", edition },
            { status: 503 },
        );
        const headers = corsHeaders(request);
        for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
        return res;
    }
}
