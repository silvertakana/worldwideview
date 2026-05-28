import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAuthEnabled } from "@/core/edition";
import { cameraProxyLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";
import { safeFetch } from "@/lib/security/ssrf";

const MAX_STREAM_DURATION_MS = 5 * 60 * 1000; // 5 minutes

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

    try {
        const upstream = await safeFetch(targetUrl, {
            headers: { "User-Agent": "WorldWideView/1.0" },
            timeout: MAX_STREAM_DURATION_MS,
            streaming: true,
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

        const contentType = upstream.headers.get("content-type") || "application/octet-stream";

        return new Response(upstream.body as ReadableStream, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[StreamProxy] Error:", message);
        const status = message.includes("SSRF Error") ? 403 : 502;
        return NextResponse.json(
            { error: message || "Failed to proxy stream" },
            { status },
        );
    }
}

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    });
}
