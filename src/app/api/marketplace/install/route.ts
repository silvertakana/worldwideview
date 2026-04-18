import { NextResponse } from "next/server";
import { validateMarketplaceAuth } from "@/lib/marketplace/auth";
import { upsertPlugin } from "@/lib/marketplace/repository";
import { handlePreflight, withCors } from "@/lib/marketplace/cors";
import { validateManifest } from "@/core/plugins/validateManifest";
import { marketplaceApiLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";
import { isPluginInstallEnabled, isDemo, isDemoAdmin } from "@/core/edition";
import { getVerifiedPluginIds } from "@/lib/marketplace/registryClient";
import { auth } from "@/lib/auth";

export async function OPTIONS(request: Request) {
    return handlePreflight(request);
}

export async function POST(request: Request) {
    if (!isPluginInstallEnabled) {
        return withCors(
            NextResponse.json({ error: "Plugin installation is disabled on this instance" }, { status: 403 }),
            request,
        );
    }



    const rateLimited = marketplaceApiLimiter.check(getClientIp(request));
    if (rateLimited) return withCors(rateLimited, request);

    const authError = await validateMarketplaceAuth(request);
    if (authError) return withCors(authError, request);

    try {
        const body = await request.json();
        const { pluginId, version, manifest } = body;
        console.log(`[Marketplace Install Route] Installing plugin: ${pluginId} v${version || "1.0.0"}`);

        if (!pluginId || typeof pluginId !== "string") {
            return withCors(
                NextResponse.json(
                    { error: "Missing required field: pluginId" },
                    { status: 400 },
                ),
                request,
            );
        }

        // Validate manifest if provided
        if (manifest) {
            const validation = validateManifest(manifest);
            if (!validation.valid) {
                return withCors(
                    NextResponse.json(
                        { error: "Invalid manifest", details: validation.errors },
                        { status: 400 },
                    ),
                    request,
                );
            }
        }

        // Server-side trust stamping — always overwrite trust from the
        // live registry. Never trust the incoming manifest's claim.
        if (manifest) {
            const verified = await getVerifiedPluginIds();
            manifest.trust = verified.has(pluginId) ? "verified" : "unverified";
        }

        const config = manifest ? JSON.stringify(manifest) : "{}";
        const record = await upsertPlugin(pluginId, version || "1.0.0", config);

        return withCors(
            NextResponse.json({
                status: "installed",
                pluginId: record.pluginId,
                version: record.version,
                installedAt: record.installedAt,
            }),
            request,
        );
    } catch (err) {
        console.error("[Bridge/install] Error:", err);
        return withCors(
            NextResponse.json(
                { error: "Install failed" },
                { status: 500 },
            ),
            request,
        );
    }
}
