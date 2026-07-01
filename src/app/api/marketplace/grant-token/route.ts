import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { issueMarketplaceToken } from "@/lib/marketplace/marketplaceToken";
import type { MarketplaceSessionToken } from "@worldwideview/wwv-plugin-sdk";
import { grantTokenLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";
import { isPluginInstallEnabled, isDemo, isDemoAdmin } from "@/core/edition";
import { getRequestOrigin } from "@/lib/origin";

const ALLOWED_REDIRECT_HOSTS = new Set([
    "localhost",
    "127.0.0.1",
    "worldwideview.dev",
]);

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
        // Ignore unparsable env values — they simply don't contribute a host.
    }
}

function isSafeRedirect(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            ALLOWED_REDIRECT_HOSTS.has(parsed.hostname)
            || parsed.hostname.endsWith(".worldwideview.dev")
        );
    } catch {
        return false;
    }
}

/**
 * GET /api/marketplace/grant-token
 * Issues a marketplace JWT for an authenticated user without requiring an install.
 * Used by the Manage page when the user configures their instance URL directly.
 *
 * Query params:
 *   redirectTo - URL to redirect to with ?token=<jwt> appended (must be allowlisted)
 */
export async function GET(request: NextRequest) {
    if (!isPluginInstallEnabled) {
        return NextResponse.json(
            { error: "Marketplace tokens are not available on this instance" },
            { status: 403 },
        );
    }

    const rateLimited = grantTokenLimiter.check(getClientIp(request));
    if (rateLimited) return rateLimited;

    const { searchParams } = request.nextUrl;
    const redirectTo = searchParams.get("redirectTo") ?? "";

    try {
        const session = await getServerSession();

        if (!session?.user) {
            const origin = getRequestOrigin(request);
            const loginUrl = new URL("/login", origin);

            // Construct a relative path for `next` to ensure it redirects back to the identical host
            const nextPath = request.nextUrl.pathname + request.nextUrl.search;
            loginUrl.searchParams.set("next", nextPath);
            return NextResponse.redirect(loginUrl);
        }

        if (isDemo && !isDemoAdmin(session)) {
            return NextResponse.json({ error: "Admin access required on Demo edition" }, { status: 403 });
        }

        if (!redirectTo || !isSafeRedirect(redirectTo)) {
            return NextResponse.json({ error: "Invalid or missing redirectTo" }, { status: 400 });
        }

        const token: MarketplaceSessionToken = await issueMarketplaceToken(session.user.id ?? "");
        const dest = new URL(redirectTo);
        // Token in fragment — never sent to server in logs/referer
        return NextResponse.redirect(`${dest.toString()}#token=${token}`);
    } catch (err) {
        console.error("[grant-token] Unexpected error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export const runtime = "nodejs";
