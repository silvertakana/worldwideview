import { NextResponse } from "next/server";
import { validateMarketplaceAuth } from "@/lib/marketplace/auth";
import { upsertPlugin } from "@/lib/marketplace/repository";
import { handlePreflight, withCors } from "@/lib/marketplace/cors";
import { validateManifest } from "@/core/plugins/validateManifest";

export async function OPTIONS(request: Request) {
    return handlePreflight(request);
}

export async function POST(request: Request) {
    const authError = await validateMarketplaceAuth(request);
    if (authError) return withCors(authError, request);

    try {
        const body = await request.json();
        const { pluginId, version, manifest } = body;

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
