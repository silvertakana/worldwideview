import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { encryptCredential } from "@/lib/auth/encryption";
import { prisma as db } from "@/lib/db";

function redirectWith(query: Record<string, string>, req: NextRequest) {
    const params = new URLSearchParams(query);
    const res = NextResponse.redirect(new URL(`/?${params.toString()}`, req.nextUrl.origin), 302);

    const isHttps = req.nextUrl.protocol === "https:";
    const cookiePrefix = isHttps ? "__Host-" : "";

    res.cookies.set(`${cookiePrefix}pkce_state`, "", {
        httpOnly: true, secure: isHttps, sameSite: "lax", path: "/", maxAge: 0,
    });
    res.cookies.set(`${cookiePrefix}pkce_verifier`, "", {
        httpOnly: true, secure: isHttps, sameSite: "lax", path: "/", maxAge: 0,
    });

    return res;
}

export async function GET(req: NextRequest) {
    const isHttps = req.nextUrl.protocol === "https:";
    const cookiePrefix = isHttps ? "__Host-" : "";

    const stateCookie = req.cookies.get(`${cookiePrefix}pkce_state`)?.value;
    const verifierCookie = req.cookies.get(`${cookiePrefix}pkce_verifier`)?.value;
    const urlState = req.nextUrl.searchParams.get("state");

    if (!stateCookie || urlState !== stateCookie) {
        return redirectWith({ error: "state_mismatch" }, req);
    }

    if (!verifierCookie) {
        return redirectWith({ error: "missing_verifier" }, req);
    }

    const mpUrl = process.env.NEXT_PUBLIC_WWV_MARKETPLACE_URL || "https://app.worldwideview.dev";
    const issuer = new URL(mpUrl);

    try {
        const config = new client.Configuration(
            {
                issuer: issuer.toString(),
                authorization_endpoint: new URL("/oauth/authorize", issuer).toString(),
                token_endpoint: new URL("/api/oauth/token", issuer).toString(),
            },
            "local-app",
        );

        const tokens = await client.authorizationCodeGrant(
            config,
            new URL(req.url),
            { expectedState: stateCookie, pkceCodeVerifier: verifierCookie },
        );

        if (tokens.access_token) {
            const encrypted = await encryptCredential(tokens.access_token);
            await db.marketplaceCredential.upsert({
                where: { tenantId: "local" },
                update: {
                    version: encrypted.version,
                    salt: encrypted.salt,
                    nonce: encrypted.nonce,
                    ciphertext: encrypted.ciphertext,
                },
                create: {
                    tenantId: "local",
                    version: encrypted.version,
                    salt: encrypted.salt,
                    nonce: encrypted.nonce,
                    ciphertext: encrypted.ciphertext,
                },
            });
        }

        return redirectWith({ connected: "true" }, req);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[PKCE] Exchange failed:", message);

        if (message.includes("ENCRYPTION_MASTER_KEY")) {
            return redirectWith({ error: "encryption_failed" }, req);
        }

        return redirectWith({ error: "token_exchange_failed" }, req);
    }
}
