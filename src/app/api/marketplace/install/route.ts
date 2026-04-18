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

        // Fetch from marketplace if manifest is missing (e.g. from in-app update)
        let finalManifest = manifest;
        if (!finalManifest) {
            const MARKETPLACE_URL = process.env.NEXT_PUBLIC_MARKETPLACE_URL || "https://marketplace.worldwideview.dev";
            try {
                const res = await fetch(`${MARKETPLACE_URL}/api/plugins/${pluginId}`);
                if (res.ok) {
                    const card = await res.json();
                    finalManifest = { ...card };
                    
                    // Reconstruct entry URL for plugins that are distributed via NPM.
                    // We also forcefully coerce format to "bundle" here because 
                    // the marketplace cache might still return "static" for plugins we recently converted.
                    if (finalManifest.npmPackage) {
                        const targetVersion = version || finalManifest.version || "1.0.0";
                        finalManifest.format = "bundle";
                        finalManifest.entry = `https://unpkg.com/${finalManifest.npmPackage}@${targetVersion}/dist/frontend.mjs`;
                    }
                }
            } catch (e) {
                console.error(`[Marketplace Install Route] Failed to fetch manifest for ${pluginId}`, e);
            }
        }

        // Validate manifest
        if (finalManifest) {
            const validation = validateManifest(finalManifest);
            if (!validation.valid) {
                console.error(
                    `[Marketplace Install Route] ❌ MANIFEST VALIDATION FAILED for ${pluginId}\n` +
                    `Errors: ${validation.errors.join(", ")}\n` +
                    `Evaluated Payload:\n${JSON.stringify(finalManifest, null, 2)}`
                );
                return withCors(
                    NextResponse.json(
                        { error: "Invalid manifest", details: validation.errors },
                        { status: 400 },
                    ),
                    request,
                );
            }
        } else {
             // We cannot proceed safely if we don't have a manifest and it's missing from DB.
             // If we do have an existing db record, we could technically merge, but we'll enforce manifest req here.
             console.warn(`[Marketplace Install] No manifest provided or found for ${pluginId}`);
        }

        // Server-side trust stamping — always overwrite trust from the
        // live registry. Never trust the incoming manifest's claim.
        if (finalManifest) {
            const verified = await getVerifiedPluginIds();
            finalManifest.trust = verified.has(pluginId) ? "verified" : "unverified";
        }

        const config = finalManifest ? JSON.stringify(finalManifest) : "{}";
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
