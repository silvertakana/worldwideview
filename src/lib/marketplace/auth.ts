import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyMarketplaceToken } from "./marketplaceToken";

/**
 * Validate marketplace API access. Accepts (in order):
 *   1. Active Auth.js session (browser redirect flow)
 *   2. Marketplace JWT issued at install time (cross-origin Manage page)
 *   3. Legacy static bearer token (backward compat)
 * Returns null if authorized, or a NextResponse error if not.
 */
export async function validateMarketplaceAuth(
    request: Request,
): Promise<NextResponse | null> {
    // 1. Try session auth first
    const session = await auth();
    if (session?.user) return null;

    // 2. Try marketplace JWT bearer token
    const authHeader = request.headers.get("authorization");
    const bearer = authHeader?.replace("Bearer ", "");
    if (bearer) {
        try {
            await verifyMarketplaceToken(bearer);
            return null;
        } catch {
            // not a valid marketplace JWT — try legacy token next
        }

        // 3. Fall back to legacy static bridge token
        const bridgeToken = process.env.WWV_BRIDGE_TOKEN;
        if (bridgeToken && bearer === bridgeToken) {
            console.warn("[Auth] Legacy WWV_BRIDGE_TOKEN used — migrate to session or marketplace JWT");
            return null;
        }
    }

    return NextResponse.json(
        { error: "Unauthorized — sign in to WWV or provide a valid token" },
        { status: 401 },
    );
}

/** @deprecated Use validateMarketplaceAuth instead */
export function validateBridgeToken(request: Request): NextResponse | null {
    const bridgeToken = process.env.WWV_BRIDGE_TOKEN;
    if (!bridgeToken) {
        return NextResponse.json(
            { error: "Bridge not configured — set WWV_BRIDGE_TOKEN in .env" },
            { status: 503 },
        );
    }
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token !== bridgeToken) {
        return NextResponse.json(
            { error: "Invalid or missing bridge token" },
            { status: 401 },
        );
    }
    return null;
}
