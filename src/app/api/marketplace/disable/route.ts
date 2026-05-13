import { NextResponse } from "next/server";
import { validateMarketplaceAuth } from "@/lib/marketplace/auth";
import { disablePlugin } from "@/lib/marketplace/repository";
import { handlePreflight, withCors } from "@/lib/marketplace/cors";
import { marketplaceApiLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";
import { isPluginInstallEnabled } from "@/core/edition";

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

        await disablePlugin(pluginId);
        return withCors(NextResponse.json({ status: "disabled", pluginId }), request);
    } catch (err) {
        console.error("[marketplace/disable] Error:", err);
        return withCors(
            NextResponse.json({ error: "Disable failed" }, { status: 500 }),
            request,
        );
    }
}
