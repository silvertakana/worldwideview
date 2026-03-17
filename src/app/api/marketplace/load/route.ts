import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handlePreflight, withCors } from "@/lib/marketplace/cors";
import { validateManifest } from "@/core/plugins/validateManifest";
import { validateMarketplaceAuth } from "@/lib/marketplace/auth";
import type { PluginManifest } from "@/core/plugins/PluginManifest";

export async function OPTIONS(request: Request) {
    return handlePreflight(request);
}

/**
 * Returns manifests of all installed marketplace plugins that are valid
 * and need dynamic loading (i.e. not built-in plugins already in AppShell).
 * Called by the client at startup to load installed plugins.
 */
export async function GET(request: Request) {
    const authError = await validateMarketplaceAuth(request);
    if (authError) return withCors(authError, request);

    try {
        const records = await prisma.installedPlugin.findMany();

        const manifests = records
            .map((r): PluginManifest | null => {
                try {
                    const manifest = JSON.parse(r.config);
                    if (!manifest.id) manifest.id = r.pluginId;
                    return manifest as PluginManifest;
                } catch {
                    return null;
                }
            })
            .filter((m): m is PluginManifest => {
                if (!m) return false;
                // Skip built-in plugins — already registered by AppShell
                if (m.trust === "built-in") return false;
                // Skip records with no usable manifest (e.g. old empty-config installs)
                const { valid } = validateManifest(m);
                return valid;
            });

        return withCors(NextResponse.json({ manifests }), request);
    } catch (err) {
        console.error("[Marketplace/load] Error:", err);
        return withCors(NextResponse.json({ manifests: [] }), request);
    }
}
