/* eslint-disable no-console */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDemo } from "@/core/edition";
import { hasBetterAuthCookie } from "@/lib/proxy-auth";

const workspaceCache = new Map<string, { status: string; expiresAt: number }>();
const CACHE_TTL = 60_000; // 60 seconds

// Anchored static-asset allowlist. Only requests ending in a real asset
// extension bypass the auth gate. This replaces the former `path.includes(".")`
// check, which let ANY dotted path (e.g. `/secret.page`, `/globe.config`)
// skip authentication entirely.
const STATIC_ASSET_RE = /\.(?:js|mjs|cjs|css|map|json|txt|xml|webmanifest|ico|png|jpe?g|gif|svg|webp|avif|bmp|woff2?|ttf|otf|eot|wasm|mp4|webm|glb|gltf)$/i;

// API routes that must stay reachable WITHOUT a logged-in session cookie.
// Everything else under /api is deny-by-default (requires a valid session JWT).
//  - auth/internal/health/billing-webhook: pre-login, server-to-server, infra, or external callers.
//  - mcp/globe/v1-entities: dual-auth routes that self-guard via Bearer API key
//    (programmatic clients send no session cookie, so the gate must not block them).
//  - marketplace/*: every marketplace route self-guards. validateMarketplaceAuth
//    accepts a cross-origin Bearer marketplace JWT (callers send no session cookie),
//    auth() guards the same-origin routes, and sideload is NODE_ENV-gated to dev.
//    Gating the prefix here would 401 those cross-origin Bearer/preflight requests
//    before their own auth runs, breaking install/manage from the marketplace origin.
//  - glitchtip-tunnel/build/dev: telemetry/diagnostics (dev/* is NODE_ENV-gated to 403 in prod).
const PUBLIC_API_PREFIXES = [
    "/api/auth",
    "/api/ba",
    "/api/internal/workspace",
    "/api/health",
    "/api/billing/webhook",
    "/api/mcp",
    "/api/globe",
    "/api/v1/entities",
    "/api/places",
    "/api/marketplace",
    "/api/glitchtip-tunnel",
    "/api/build",
    "/api/dev",
];

function isPublicApiPath(path: string): boolean {
    return PUBLIC_API_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

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

    // API routes: DENY BY DEFAULT. Evaluated BEFORE the static-asset allowlist so
    // that no `/api/...` path ending in an asset-like extension (e.g. a catch-all
    // segment such as `/api/x/y.json`) can match the static fast-path and skip the
    // gate. Public/self-guarded routes pass through; every other /api route requires
    // a valid session JWT (else 401 JSON). This closes the former blanket `/api`
    // pass-through that left unauthenticated data proxies (places/*, camera/test,
    // earthquake, iss*, weather*, ...) open and burning server-held upstream keys.
    if (path.startsWith("/api")) {
        const res = NextResponse.next();
        // Always drop a client-supplied tenant header; only the server-resolved
        // value may be forwarded (H2: tenant-header spoof prevention).
        res.headers.delete("x-tenant-subdomain");

        // CORS preflight is credential-less by design (no cookie, no Authorization
        // header), so gating it would 401 the preflight and break every cross-origin
        // API route before its real request is ever sent. Let OPTIONS through; the
        // route's own OPTIONS/CORS handler answers it (no body, nothing to leak).
        if (req.method === "OPTIONS") return res;

        if (isPublicApiPath(path)) {
            if (tenantSubdomain) res.headers.set("x-tenant-subdomain", tenantSubdomain);
            return res;
        }

        // Auth gate: Better Auth session cookie
        if (hasBetterAuthCookie(req)) {
            if (tenantSubdomain) res.headers.set("x-tenant-subdomain", tenantSubdomain);
            return res;
        }
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
        );
    }

    // Static assets and internal data dirs always pass through (no auth).
    // Static files match an explicit extension allowlist instead of the old,
    // bypass-prone `path.includes(".")` (which let any dotted path skip the gate).
    if (
        path.startsWith("/_next")
        || path.startsWith("/data")
        || path.startsWith("/cesium")
        || STATIC_ASSET_RE.test(path)
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

    // Auth pages: always accessible
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

    // Auth gate: Better Auth session cookie presence
    if (hasBetterAuthCookie(req)) {
        // User has a Better Auth session cookie, allow through
        const res = NextResponse.next();
        if (tenantSubdomain) res.headers.set("x-tenant-subdomain", tenantSubdomain);
        return res;
    }

    // Not logged in: check if first-run (no users)
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
