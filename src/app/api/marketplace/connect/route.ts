import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { getServerSession } from "@/lib/ba-session";
import { isDemo, isDemoAdmin } from "@/core/edition";

export async function GET(req: NextRequest) {
    if (isDemo) {
        const session = await getServerSession();
        if (!session?.user || !isDemoAdmin(session)) {
            return NextResponse.json({ error: "Admin access required on Demo edition" }, { status: 403 });
        }
    }

    const state = client.randomState();
    const code_verifier = client.randomPKCECodeVerifier();
    const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);

    const marketplaceUrl = process.env.NEXT_PUBLIC_WWV_MARKETPLACE_URL || "https://marketplace.worldwideview.dev";

    const url = new URL("/oauth/authorize", marketplaceUrl);
    url.searchParams.set("client_id", "local-app");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("code_challenge", code_challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", `${req.nextUrl.origin}/api/marketplace/callback`);
    url.searchParams.set("scope", "plugins:read");

    const res = NextResponse.redirect(url.toString(), 302);

    const isHttps = req.nextUrl.protocol === "https:";
    const cookiePrefix = isHttps ? "__Host-" : "";

    res.cookies.set(`${cookiePrefix}pkce_state`, state, {
        httpOnly: true,
        secure: isHttps,
        sameSite: "lax",
        path: "/", // __Host- prefix requires path="/" per RFC 6265bis
        maxAge: 60 * 10 // 10 minutes
    });

    res.cookies.set(`${cookiePrefix}pkce_verifier`, code_verifier, {
        httpOnly: true,
        secure: isHttps,
        sameSite: "lax",
        path: "/", // __Host- prefix requires path="/" per RFC 6265bis
        maxAge: 60 * 10 // 10 minutes
    });

    return res;
}
