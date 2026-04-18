import { NextResponse } from "next/server";
import { validateMarketplaceAuth } from "@/lib/marketplace/auth";
import { getInstalledPlugins } from "@/lib/marketplace/repository";
import { handlePreflight, withCors } from "@/lib/marketplace/cors";
import { BUILT_IN_PLUGIN_IDS } from "@/lib/marketplace/builtinPlugins";
import { marketplaceApiLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";
import { isDemo, isDemoAdmin } from "@/core/edition";
import { auth } from "@/lib/auth";

export async function OPTIONS(request: Request) {
    return handlePreflight(request);
}

export async function GET(request: Request) {
    const rateLimited = marketplaceApiLimiter.check(getClientIp(request));
    if (rateLimited) return withCors(rateLimited, request);

    // In demo mode, the plugin list is public (read-only for non-admins)
    // For local/cloud, we continue to enforce authentication

    if (!isDemo) {
        const authError = await validateMarketplaceAuth(request);
        if (authError) return withCors(authError, request);
    }

    try {
        const dbPlugins = await getInstalledPlugins();
        const dbMap = new Map(dbPlugins.map((p: any) => [p.pluginId, p]));

        // Collect active DB plugins (exclude disabled ones)
        const activeDbPlugins = dbPlugins.filter((p: any) => p.enabled !== false);

        // Add built-in plugins that aren't in the DB at all (default = installed)
        const builtInRecords = BUILT_IN_PLUGIN_IDS
            .filter((id) => !dbMap.has(id))
            .map((id) => ({
                pluginId: id,
                version: "built-in",
                config: "{}",
                installedAt: "",
            }));

        const plugins = [...activeDbPlugins, ...builtInRecords];

        const session = await auth();
        const canManagePlugins = !isDemo || isDemoAdmin(session);

        return withCors(NextResponse.json({ plugins, canManagePlugins }), request);
    } catch (err) {
        console.error("[marketplace/status] Error:", err);
        // Fallback: return built-in plugins when DB is unavailable
        const fallback = BUILT_IN_PLUGIN_IDS.map((id) => ({
            pluginId: id,
            version: "built-in",
            config: "{}",
            installedAt: "",
        }));
        
        const session = await auth();
        const canManagePlugins = !isDemo || isDemoAdmin(session);
        
        return withCors(NextResponse.json({ plugins: fallback, canManagePlugins }), request);
    }
}

