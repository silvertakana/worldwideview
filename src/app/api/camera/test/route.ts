import { NextRequest, NextResponse } from "next/server";

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "::1", "metadata.google.internal"];
const TIMEOUT_MS = 30000;

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

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) {
        return NextResponse.json({ status: "error", error: "Missing url parameter" }, { status: 400 });
    }

    if (isPrivateUrl(url)) {
        return NextResponse.json({ status: "error", error: "Private URL not allowed" }, { status: 403 });
    }

    const startTime = Date.now();
    try {
        let response;
        try {
            response = await fetch(url, {
                method: "HEAD",
                headers: { "User-Agent": "WorldWideView/1.0" },
                signal: AbortSignal.timeout(TIMEOUT_MS)
            });
        } catch (headError: any) {
            // Primitive IP camera servers (like Insecam sources) often aggressively drop the TCP connection 
            // instead of returning 405 when they see an unsupported HTTP method like HEAD. 
            // If the socket was closed unexpectedly, retry with GET.
            if (headError.cause?.code === 'UND_ERR_SOCKET' || headError.message?.includes('fetch failed')) {
                response = await fetch(url, {
                    method: "GET",
                    headers: { "User-Agent": "WorldWideView/1.0" },
                    signal: AbortSignal.timeout(TIMEOUT_MS)
                });
            } else {
                throw headError;
            }
        }

        // If HEAD completes but with 405 (Method Not Allowed) or 403, try GET but abort body
        if (response.status === 405 || response.status === 403) {
            const getRes = await fetch(url, {
                method: "GET",
                headers: { "User-Agent": "WorldWideView/1.0" },
                signal: AbortSignal.timeout(TIMEOUT_MS)
            });
            return NextResponse.json({
                status: getRes.status,
                contentType: getRes.headers.get("content-type"),
                latencyMs: Date.now() - startTime
            });
        }

        return NextResponse.json({
            status: response.status,
            contentType: response.headers.get("content-type"),
            latencyMs: Date.now() - startTime
        });
    } catch (error: any) {
        const realError = error.cause || error;
        const code = realError?.code || error?.code || realError?.name || error?.name;

        let displayError = error?.message || "Unknown error";
        if (code && code !== 'TypeError' && code !== 'Error') {
            displayError = `[${code}] ${realError?.message || error?.message || ""}`;
        }

        // Make sure we don't accidentally categorize a malformed HTTP response as a timeout
        if (code === "ERR_INVALID_HTTP_RESPONSE" || code === "HPE_INVALID_CONSTANT") {
            return NextResponse.json({ status: "error", error: displayError, latencyMs: Date.now() - startTime });
        }

        if (error?.name === "TimeoutError" || displayError.includes("timeout") || code === "UND_ERR_CONNECT_TIMEOUT") {
            return NextResponse.json({ status: "timeout", error: "Connection timed out", latencyMs: Date.now() - startTime });
        }

        return NextResponse.json({ status: "error", error: displayError, latencyMs: Date.now() - startTime });
    }
}
