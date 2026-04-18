import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAuthEnabled } from "@/core/edition";
import { cameraProxyLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";

import dns from "dns/promises";

/**
 * Block requests to private/internal networks to prevent SSRF attacks.
 * Resolves the domain to an IP address first to prevent basic DNS rebinding.
 * Allows any external URL (needed for user-configured custom camera sources).
 */
async function isPrivateUrl(urlStr: string): Promise<boolean> {
    try {
        const parsed = new URL(urlStr);
        const host = parsed.hostname;

        // Block non-HTTP(S) protocols
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;

        // If developer overrides local restrictions, bypass checks
        if (process.env.WWV_PROXY_ALLOW_LOCAL === "true") return false;

        // Block localhost variants upfront
        if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;

        // Block cloud metadata endpoints explicitly
        if (host === "metadata.google.internal") return true;

        // Resolve the host to its IP address to prevent DNS rebinding
        let resolvedIp: string;
        try {
            const lookupResult = await dns.lookup(host);
            resolvedIp = lookupResult.address;
        } catch {
            return true; // DNS resolution failed
        }

        // Block private IPv4 ranges using resolved IP
        const parts = resolvedIp.split(".").map(Number);
        if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
            if (parts[0] === 10) return true;                              // 10.0.0.0/8
            if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
            if (parts[0] === 192 && parts[1] === 168) return true;         // 192.168.0.0/16
            if (parts[0] === 169 && parts[1] === 254) return true;         // link-local
            if (parts[0] === 0) return true;                               // 0.0.0.0/8
            if (parts[0] === 127) return true;                             // 127.0.0.0/8
        }
        
        // Block simple IPv6 private/local ranges
        if (resolvedIp === "::1" || resolvedIp.startsWith("fe80:") || resolvedIp.startsWith("fc") || resolvedIp.startsWith("fd")) {
            return true;
        }

        return false;
    } catch {
        return true; // Invalid URL = blocked
    }
}

export async function GET(req: NextRequest) {
    const rateLimited = cameraProxyLimiter.check(getClientIp(req));
    if (rateLimited) return rateLimited;

    // Require authentication
    if (isAuthEnabled) {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
        return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
    }

    if (await isPrivateUrl(targetUrl)) {
        return NextResponse.json(
            { error: "Requests to private/internal networks are not allowed" },
            { status: 403 },
        );
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent": "WorldWideView/1.0",
                "Accept": "application/json, text/plain, */*",
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch from target URL (Status: ${response.status})` },
                { status: response.status },
            );
        }

        const text = await response.text();

        try {
            const data = JSON.parse(text);
            return NextResponse.json(data);
        } catch {
            return NextResponse.json(
                { error: "Target URL did not return a valid JSON format." },
                { status: 502 },
            );
        }
    } catch (error: any) {
        console.error("[CameraProxy] Error fetching target URL:", error);
        return NextResponse.json(
            { error: "Failed to proxy request" },
            { status: 500 },
        );
    }
}
