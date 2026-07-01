import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { isDemo, isDemoAdmin } from "@/core/edition";
import { verifyMarketplaceToken } from "./marketplaceToken";

/**
 * Validate marketplace API access. Accepts (in order):
 *   1. Active Better Auth session (browser redirect flow)
 *   2. Marketplace JWT issued at install time (cross-origin Manage page)
 * Returns null if authorized, or a NextResponse error if not.
 */
export async function validateMarketplaceAuth(
    request: Request,
): Promise<NextResponse | null> {
    // 1. Try session auth first
    const session = await getServerSession();
    if (session?.user) {
        if (isDemo && !isDemoAdmin(session)) {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }
        return null;
    }

    // 2. Try marketplace JWT bearer token
    const authHeader = request.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (bearer) {
        try {
            await verifyMarketplaceToken(bearer);
            return null;
        } catch {
            // not a valid marketplace JWT — fall through to 401
        }
    }

    return NextResponse.json(
        { error: "Unauthorized — sign in to WWV or provide a valid token" },
        { status: 401 },
    );
}
