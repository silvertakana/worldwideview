import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAuthEnabled } from "@/core/edition";
import { cameraProxyLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "::1", "metadata.google.internal"];
const MAX_STREAM_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function isPrivateUrl(urlStr: string): boolean {
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
        const host = parsed.hostname;
        
        // If developer overrides local restrictions, bypass checks
        if (process.env.WWV_PROXY_ALLOW_LOCAL === "true") return false;

        if (BLOCKED_HOSTS.includes(host)) return true;

        const parts = host.split(".").map(Number);
        if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
            if (parts[0] === 10) return true;
            if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
            if (parts[0] === 192 && parts[1] === 168) return true;
            if (parts[0] === 169 && parts[1] === 254) return true;
            if (parts[0] === 0) return true;
        }
        return false;
    } catch {
        return true;
    }
}

/**
 * Binary/stream proxy – pipes raw bytes from an HTTP source (e.g. MJPEG)
 * so the browser receives them over HTTPS, avoiding mixed-content blocks.
 */
export async function GET(req: NextRequest) {
    const rateLimited = cameraProxyLimiter.check(getClientIp(req));
    if (rateLimited) return rateLimited;

    if (isAuthEnabled) {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const targetUrl = new URL(req.url).searchParams.get("url");
    if (!targetUrl) {
        return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
    }

    if (isPrivateUrl(targetUrl)) {
        return NextResponse.json(
            { error: "Requests to private/internal networks are not allowed" },
            { status: 403 },
        );
    }

    try {
        const upstream = await fetch(targetUrl, {
            headers: { "User-Agent": "WorldWideView/1.0" },
            signal: AbortSignal.timeout(MAX_STREAM_DURATION_MS),
        });

        if (!upstream.ok) {
            return NextResponse.json(
                { error: `Upstream returned ${upstream.status}` },
                { status: upstream.status },
            );
        }

        if (!upstream.body) {
            return NextResponse.json(
                { error: "Upstream returned no body" },
                { status: 502 },
            );
        }

        const contentType =
            upstream.headers.get("content-type") || "application/octet-stream";

        return new Response(upstream.body as ReadableStream, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[StreamProxy] Error:", message);
        return NextResponse.json(
            { error: "Failed to proxy stream" },
            { status: 502 },
        );
    }
}
