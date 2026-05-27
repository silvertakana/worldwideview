import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAuthEnabled } from "@/core/edition";
import { cameraProxyLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";
import { safeFetch } from "@/lib/security/ssrf";

const MAX_IFRAME_DURATION_MS = 10 * 1000; // 10 seconds timeout for HTML

/**
 * Proxy for iframe HTML pages.
 * Fetches the target HTML, strips X-Frame-Options and CSP, and injects a <base href="...">
 * so that relative scripts/styles load correctly from the original origin.
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
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
            maxSize: 5 * 1024 * 1024,
            timeout: MAX_IFRAME_DURATION_MS,
        });

        if (!upstream.ok) {
            return NextResponse.json(
                { error: `Upstream returned ${upstream.status}` },
                { status: upstream.status },
            );
        }

        const contentType = upstream.headers.get("content-type") || "text/html";

        // If it's not HTML, just proxy the stream directly (fallback)
        if (!contentType.includes("text/html")) {
            return new Response(upstream.body as ReadableStream, {
                status: 200,
                headers: {
                    "Content-Type": contentType,
                    "Cache-Control": "no-store",
                },
            });
        }

        let html = await upstream.text();

        // Inject <base href="..."> right after <head> or at the very beginning of the document
        const baseTag = `<base href="${targetUrl}">\n`;
        if (html.includes("<head>")) {
            html = html.replace("<head>", `<head>\n${baseTag}`);
        } else if (html.includes("<HEAD>")) {
            html = html.replace("<HEAD>", `<HEAD>\n${baseTag}`);
        } else {
            html = baseTag + html;
        }

        return new Response(html, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[IframeProxy] Error:", message);
        return NextResponse.json(
            { error: "Failed to proxy iframe" },
            { status: 502 },
        );
    }
}
