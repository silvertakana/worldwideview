/* eslint-disable no-console */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDemo } from "@/core/edition";

const workspaceCache = new Map<string, { status: string; expiresAt: number }>();
const CACHE_TTL = 60_000; // 60 seconds

async function resolveWorkspace(subdomain: string) {
    const cached = workspaceCache.get(subdomain);
    if (cached && Date.now() < cached.expiresAt) return cached;

    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || "3000"}`;
        const url = new URL(`/api/internal/workspace/${subdomain}`, appUrl);
        const res = await fetch(url.toString(), {
            headers: { "User-Agent": "WorldWideView-Middleware" }
        });

        if (res.ok) {
            const data = await res.json();
            workspaceCache.set(subdomain, { ...data, expiresAt: Date.now() + CACHE_TTL });
            return data;
        }
        return null;
    } catch (e) {
        console.error("[proxy.ts] Workspace resolution failed:", e);
        return null;
    }
}

/**
 * Route protection proxy.
 * - /setup, /login, /api/* → public
 * - Everything else → requires valid JWT session
 * - If no users exist → redirect to /setup
 * - Demo edition → everything is public (no login required)
 */
export default async function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // Extract subdomain if on cloud
    const hostname = req.headers.get("host") || "";
    let tenantSubdomain = null;
    const isCloudDeploy = process.env.NEXT_PUBLIC_WWV_EDITION === "cloud";

    if (isCloudDeploy) {
        const isApp = hostname.includes(".app.worldwideview.dev") || hostname.includes(".localhost");
        if (isApp) {
            const subdomain = hostname.replace(".app.worldwideview.dev", "").replace(".localhost", "").split(":")[0];
            if (subdomain && subdomain !== "app" && subdomain !== "localhost") {
                tenantSubdomain = subdomain;
            }
        }
    }

    // Demo edition: fully public, no auth required
    if (isDemo) {
        const res = NextResponse.next();
        if (tenantSubdomain) res.headers.set("x-tenant-subdomain", tenantSubdomain);
        return res;
    }

    // Static assets, API routes, data files — always pass through.
    // Strip any client-supplied x-tenant-subdomain on /api/* before forwarding,
    // then re-inject only the server-resolved value (H2: tenant-header spoof prevention).
    // A forged header must never reach the Prisma tenant extension.
    if (
        path.startsWith("/_next")
        || path.startsWith("/api")
        || path.startsWith("/data")
        || path.startsWith("/cesium")
        || path.includes(".")
    ) {
        const res = NextResponse.next();
        res.headers.delete("x-tenant-subdomain");
        if (tenantSubdomain) res.headers.set("x-tenant-subdomain", tenantSubdomain);
        return res;
    }

    // Tenant validation
    if (isCloudDeploy && tenantSubdomain) {
        const workspaceInfo = await resolveWorkspace(tenantSubdomain);
        if (!workspaceInfo) {
            // Workspace not found
            return new NextResponse("Workspace not found", { status: 404 });
        }
        if (workspaceInfo.status === "suspended" && !path.startsWith("/suspended")) {
            return NextResponse.redirect(new URL("/suspended", req.url));
        }
    }

    // Auth pages — always accessible
    if (path.startsWith("/setup") || path.startsWith("/login")) {
        const res = NextResponse.next();
        if (tenantSubdomain) res.headers.set("x-tenant-subdomain", tenantSubdomain);
        return res;
    }

    // Root Domain (Control Plane) Routing
    if (isCloudDeploy && !tenantSubdomain) {
        // Redirect apex app domain to the external marketing/hub site
        if (path === "/" || path === "/register" || path === "/dashboard" || path === "/create-workspace") {
            return NextResponse.redirect("https://worldwideview.dev/hub");
        }
    }

    // Check JWT session from Auth.js cookie.
    // Behind a TLS-terminating reverse proxy, the cookie was set with the
    // `__Secure-` prefix (because the public URL is https), but the request
    // reaching us is plain http, so getToken's auto-detection looks for the
    // unprefixed name and misses it. Detect via X-Forwarded-Proto / AUTH_URL.
    const xfProto = req.headers.get("x-forwarded-proto");
    const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
    const isSecure = xfProto === "https"
        || authUrl.startsWith("https://")
        || req.nextUrl.protocol === "https:";
    const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET,
        secureCookie: isSecure,
    });

    if (token) {
        // User is logged in — allow through
        const res = NextResponse.next();
        if (tenantSubdomain) res.headers.set("x-tenant-subdomain", tenantSubdomain);
        return res;
    }

    // Not logged in — check if first-run (no users)
    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || "3000"}`;
        const url = new URL("/api/auth/setup-status", appUrl);
        const res = await fetch(url.toString(), {
            headers: {
                "User-Agent": "WorldWideView-Middleware",
            }
        });
        const data = await res.json();
        if (data.needsSetup) {
            return NextResponse.redirect(new URL("/setup", req.nextUrl)); // NextResponse.redirect correctly bounds redirect to client
        }
    } catch (e) {
        // Fall through to login redirect
        console.error("[proxy.ts] Failed to fetch setup status:", e);
    }

    return NextResponse.redirect(new URL("/login", req.nextUrl));
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
