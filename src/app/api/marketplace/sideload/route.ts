import { NextResponse } from "next/server";
import { validateManifest } from "@/core/plugins/validateManifest";
import type { PluginManifest } from "@/core/plugins/PluginManifest";

/**
 * POST /api/marketplace/sideload
 *
 * Development-only endpoint: accepts a raw manifest JSON body and
 * returns it as a validated, trust-stamped manifest for local testing.
 * No auth required — gated behind NODE_ENV === "development".
 */
export async function POST(request: Request) {
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json(
            { error: "Sideloading is only available in development mode" },
            { status: 403 },
        );
    }

    try {
        const manifest: PluginManifest = await request.json();

        const validation = validateManifest(manifest);
        if (!validation.valid) {
            return NextResponse.json(
                { error: "Invalid manifest", details: validation.errors },
                { status: 400 },
            );
        }

        // Force trust to unverified for sideloaded plugins
        manifest.trust = "unverified";

        return NextResponse.json({ status: "sideloaded", manifest });
    } catch (err) {
        console.error("[Sideload] Error:", err);
        return NextResponse.json(
            { error: "Sideload failed" },
            { status: 500 },
        );
    }
}
