import { NextResponse } from "next/server";
import { validateMarketplaceAuth } from "@/lib/marketplace/auth";
import { uninstallPlugin, disablePlugin } from "@/lib/marketplace/repository";
import { handlePreflight, withCors } from "@/lib/marketplace/cors";
import { marketplaceApiLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";
import { isPluginInstallEnabled, isDemo, isDemoAdmin } from "@/core/edition";
import { auth } from "@/lib/auth";

export async function OPTIONS(request: Request) {
    return handlePreflight(request);
}

export async function POST(request: Request) {
    if (!isPluginInstallEnabled) {
        return withCors(
            NextResponse.json({ error: "Plugin management is disabled on this instance" }, { status: 403 }),
            request,
        );
    }



    const rateLimited = marketplaceApiLimiter.check(getClientIp(request));
    if (rateLimited) return withCors(rateLimited, request);

    const authError = await validateMarketplaceAuth(request);
    if (authError) return withCors(authError, request);

    try {
        const body = await request.json();
        const { pluginId } = body;

        if (!pluginId || typeof pluginId !== "string") {
            return withCors(
                NextResponse.json({ error: "Missing required field: pluginId" }, { status: 400 }),
                request,
            );
        }

        const deleted = await uninstallPlugin(pluginId);

        if (deleted === 0) {
            return withCors(
                NextResponse.json(
                    { error: `Plugin "${pluginId}" is not installed`, pluginId },
                    { status: 404 },
                ),
                request,
            );
        }

        return withCors(NextResponse.json({ status: "uninstalled", pluginId }), request);
    } catch (err) {
        console.error("[marketplace/uninstall] Error:", err);
        return withCors(
            NextResponse.json({ error: "Uninstall failed" }, { status: 500 }),
            request,
        );
    }
}

