import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDemo } from "@/core/edition";

/**
 * Route protection proxy.
 * - /setup, /login, /api/* → public
 * - Everything else → requires valid JWT session
 * - If no users exist → redirect to /setup
 * - Demo edition → everything is public (no login required)
 */
export default async function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // Demo edition: fully public, no auth required
    if (isDemo) {
        return NextResponse.next();
    }

    // Static assets, API routes, data files — always pass through
    if (
        path.startsWith("/_next") ||
        path.startsWith("/api") ||
        path.startsWith("/data") ||
        path.startsWith("/cesium") ||
        path.includes(".")
    ) {
        return NextResponse.next();
    }

    // Auth pages — always accessible
    if (path.startsWith("/setup") || path.startsWith("/login")) {
        return NextResponse.next();
    }

    // Check JWT session from Auth.js cookie
    const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET,
    });

    if (token) {
        // User is logged in — allow through
        return NextResponse.next();
    }

    // Not logged in — check if first-run (no users)
    try {
        const url = new URL("/api/auth/setup-status", req.nextUrl.origin);
        const res = await fetch(url);
        const data = await res.json();
        if (data.needsSetup) {
            return NextResponse.redirect(new URL("/setup", req.nextUrl));
        }
    } catch {
        // Fall through to login redirect
    }

    return NextResponse.redirect(new URL("/login", req.nextUrl));
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

