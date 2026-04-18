import { NextResponse } from "next/server";
import { getInstalledPlugins } from "@/lib/marketplace/repository";
import { getClientIp } from "@/lib/rateLimit";
import { marketplaceApiLimiter } from "@/lib/rateLimiters";

const MARKETPLACE_URL = process.env.NEXT_PUBLIC_MARKETPLACE_URL || "https://marketplace.worldwideview.dev";

export async function GET(request: Request) {
    const rateLimited = marketplaceApiLimiter.check(getClientIp(request));
    if (rateLimited) return rateLimited;

    try {
        // Fetch currently installed plugins from local SQLite
        const installedPlugins = await getInstalledPlugins();
        
        // Exclude built-in versions, only check genuine semver strings or unverified records.
        const updatablePlugins = installedPlugins.filter(p => p.version !== "built-in");

        if (updatablePlugins.length === 0) {
            return NextResponse.json({ updates: {} });
        }

        // Fetch master plugin list from marketplace
        const res = await fetch(`${MARKETPLACE_URL}/api/plugins`, {
            next: { revalidate: 60 } // Cache for 60 seconds
        });
        
        if (!res.ok) {
            throw new Error(`Marketplace returned ${res.status}`);
        }

        const marketplacePlugins = await res.json();
        
        // Build a lookup map of Market versions
        const marketVersions = new Map();
        for (const p of marketplacePlugins) {
            marketVersions.set(p.id, p.version);
        }

        const updates: Record<string, string> = {};

        // Compare and flag updates
        for (const localPlugin of updatablePlugins) {
            const marketVersion = marketVersions.get(localPlugin.pluginId);
            
            // Only suggest an update if marketplace version exists and differs
            if (marketVersion && marketVersion !== "0.0.0" && marketVersion !== localPlugin.version) {
                 updates[localPlugin.pluginId] = marketVersion;
            }
        }

        return NextResponse.json({ updates });
    } catch (err) {
        console.error("[marketplace/check-updates] Error:", err);
        return NextResponse.json(
            { error: "Failed to check for updates" },
            { status: 500 }
        );
    }
}
