import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { isAuthEnabled } from "@/core/edition";
import { cameraProxyLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";
import { safeFetch } from "@/lib/security/ssrf";

export async function GET(req: NextRequest) {
    const rateLimited = cameraProxyLimiter.check(getClientIp(req));
    if (rateLimited) return rateLimited;

    if (isAuthEnabled) {
        const session = await getServerSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
        return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
    }

    try {
        const response = await safeFetch(targetUrl, {
            headers: {
                "User-Agent": "WorldWideView/1.0",
                Accept: "application/json, text/plain, */*",
            },
            maxSize: 5 * 1024 * 1024, // 5MB
            timeout: 10000 // 10s
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
        const status = error.message.includes("SSRF Error") ? 403 : 500;
        return NextResponse.json(
            { error: error.message || "Failed to proxy request" },
            { status },
        );
    }
}

export const runtime = "nodejs";
