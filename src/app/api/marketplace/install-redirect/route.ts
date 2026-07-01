import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { getSupabaseUser } from "@/lib/supabase/server";
import { isCloud, isPluginInstallEnabled, isDemo, isDemoAdmin } from "@/core/edition";
import { upsertPlugin } from "@/lib/marketplace/repository";
import { issueMarketplaceToken } from "@/lib/marketplace/marketplaceToken";
import type { MarketplaceSessionToken } from "@worldwideview/wwv-plugin-sdk";
import type { PluginManifest } from "@/core/plugins/PluginManifest";
import { validateManifest } from "@/core/plugins/validateManifest";
import { installLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";
import { getVerifiedPluginIds } from "@/lib/marketplace/registryClient";
import { getRequestOrigin } from "@/lib/origin";

const ALLOWED_REDIRECT_HOSTS = new Set([
    "localhost",
    "127.0.0.1",
    "worldwideview.dev",
]);

if (process.env.ALLOWED_DEV_ORIGIN) {
    ALLOWED_REDIRECT_HOSTS.add(process.env.ALLOWED_DEV_ORIGIN);
}

// Derive additional allowed redirect hosts from the configured marketplace URLs
// so that custom deployment hostnames (e.g. marketplace.wwv.local) are accepted
// without being hardcoded. A bad env value is skipped rather than crashing the module.
for (const envUrl of [
    process.env.NEXT_PUBLIC_MARKETPLACE_URL,
    process.env.NEXT_PUBLIC_WWV_MARKETPLACE_URL,
    process.env.MARKETPLACE_URL,
]) {
    if (!envUrl) continue;
    try {
        ALLOWED_REDIRECT_HOSTS.add(new URL(envUrl).hostname);
    } catch {
        // Ignore unparsable env values; they simply don't contribute a host.
    }
}

function isSafeRedirect(url: string): boolean {
    try {
        const parsed = new URL(url);
        const {hostname} = parsed;
        return ALLOWED_REDIRECT_HOSTS.has(hostname) || hostname.endsWith(".worldwideview.dev");
    } catch {
        return false;
    }
}

/**
 * GET /api/marketplace/install-redirect
 * Validates the user's WWV session, installs the plugin, then redirects back.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const redirectTo = searchParams.get("redirectTo") ?? "";

    try {
        if (!isPluginInstallEnabled) {
            return NextResponse.json(
                { error: "Plugin installation is disabled on this instance" },
                { status: 403 },
            );
        }

        const rateLimited = installLimiter.check(getClientIp(request));
        if (rateLimited) return rateLimited;

        // Auth: cloud edition uses Supabase session; local/demo uses NextAuth.
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const isDummyUrl = !supabaseUrl || supabaseUrl.includes("dummy") || supabaseUrl.includes("xyz.supabase.co");
        const useSupabaseAuth = isCloud && !isDummyUrl;

        let userId: string;
        if (useSupabaseAuth) {
            const supabaseUser = await getSupabaseUser();
            if (!supabaseUser) {
                const origin = getRequestOrigin(request);
                const loginUrl = new URL("/login", origin);
                const nextPath = request.nextUrl.pathname + request.nextUrl.search;
                loginUrl.searchParams.set("next", nextPath);
                return NextResponse.redirect(loginUrl);
            }
            userId = supabaseUser.id;
        } else {
            const session = await getServerSession();
            if (!session?.user) {
                const origin = getRequestOrigin(request);
                const loginUrl = new URL("/login", origin);
                const nextPath = request.nextUrl.pathname + request.nextUrl.search;
                loginUrl.searchParams.set("next", nextPath);
                return NextResponse.redirect(loginUrl);
            }
            if (isDemo && !isDemoAdmin(session)) {
                return NextResponse.json(
                    { error: "Admin access required on Demo edition" },
                    { status: 403 }
                );
            }
            userId = session.user.id ?? "";
        }

        const pluginId = searchParams.get("pluginId");
        const manifestB64 = searchParams.get("manifest");
        const version = searchParams.get("version") ?? "1.0.0";

        if (!pluginId || !manifestB64 || !redirectTo) {
            return NextResponse.json({ error: "Missing required params" }, { status: 400 });
        }

        if (!isSafeRedirect(redirectTo)) {
            return NextResponse.json({ error: "Invalid redirectTo domain" }, { status: 400 });
        }

        let manifest: PluginManifest;
        try {
            const decoded = Buffer.from(manifestB64, "base64").toString("utf8");
            manifest = JSON.parse(decoded);
        } catch {
            return NextResponse.json({ error: "Invalid manifest encoding" }, { status: 400 });
        }

        const validation = validateManifest(manifest);
        if (!validation.valid) {
            return NextResponse.json(
                { error: "Invalid manifest", details: validation.errors },
                { status: 400 },
            );
        }

        // Server-side trust stamping — never trust the incoming manifest's claim
        const verified = await getVerifiedPluginIds();
        manifest.trust = verified.has(pluginId) ? "verified" : "unverified";

        try {
            await upsertPlugin(pluginId, version, JSON.stringify(manifest));
        } catch (err) {
            console.error("[install-redirect] upsertPlugin failed:", err);
            if (isSafeRedirect(redirectTo)) {
                const errorUrl = new URL(redirectTo);
                errorUrl.searchParams.set("install_error", pluginId);
                return NextResponse.redirect(errorUrl);
            }
            return NextResponse.json({ error: "Install failed" }, { status: 500 });
        }

        const token: MarketplaceSessionToken = await issueMarketplaceToken(userId);
        const successUrl = new URL(redirectTo);

        // Unverified plugins need user confirmation on the WWV client side
        // before they're fully "installed" — signal "pending" to the marketplace.
        if (manifest.trust === "unverified") {
            successUrl.searchParams.set("pending", pluginId);
        } else {
            successUrl.searchParams.set("installed", pluginId);
        }

        // Token in fragment — never sent to server in logs/referer
        return NextResponse.redirect(`${successUrl.toString()}#token=${token}`);
    } catch (err) {
        // Top-level catch: log and redirect to marketplace with error, don't expose raw 500
        console.error("[install-redirect] Unexpected error:", err);
        if (isSafeRedirect(redirectTo)) {
            const errorUrl = new URL(redirectTo);
            errorUrl.searchParams.set("install_error", "unexpected");
            return NextResponse.redirect(errorUrl);
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export const runtime = "nodejs";
