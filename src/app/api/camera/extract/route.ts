import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";

export async function GET(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetUrl = req.nextUrl.searchParams.get("url");
    if (!targetUrl) {
        return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
    }

    try {
        // Parse and validate the URL before ANY request is made. The guard is
        // an explicit parsed-hostname comparison (exact match or subdomain
        // suffix), never a raw substring over the whole URL, so arbitrary
        // hosts cannot precede or follow the allowed domain. URL parsing also
        // ignores userinfo; it is stripped below so credentials never reach
        // the network. Kept inline at this server boundary so SAST tooling
        // sees the allowlist guard directly on the fetch path.
        const resolved = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(targetUrl) ? targetUrl : `https://${targetUrl}`;
        const parsedTarget = new URL(resolved);
        // URL.hostname is already lowercase per the URL spec.
        const hostname = parsedTarget.hostname;
        const isAllowedHost =
            hostname === "balticlivecam.com" || hostname.endsWith(".balticlivecam.com");
        const isWebProtocol = parsedTarget.protocol === "http:" || parsedTarget.protocol === "https:";

        if (isAllowedHost && isWebProtocol) {
            parsedTarget.username = "";
            parsedTarget.password = "";
            const extractUrl = parsedTarget.toString();

            const response = await fetch(extractUrl, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
            });
            const html = await response.text();

            const idMatch = html.match(/id:\s*(\d+)/);
            if (!idMatch) {
                return NextResponse.json({ error: "Could not find camera ID on balticlivecam" }, { status: 400 });
            }
            const cameraId = idMatch[1];

            const ajaxUrl = `https://balticlivecam.com/wp-admin/admin-ajax.php?action=auth_token&id=${cameraId}&embed=1&main_referer=`;
            const ajaxRes = await fetch(ajaxUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    Referer: extractUrl
                }
            });
            const ajaxHtml = await ajaxRes.text();

            const streamMatch = ajaxHtml.match(/src:\s*'([^']+m3u8[^']+)'/);
            if (streamMatch && streamMatch[1]) {
                return NextResponse.json({ streamUrl: streamMatch[1] });
            }
                return NextResponse.json({ error: "Could not find m3u8 stream on balticlivecam backend" }, { status: 404 });
        }

        return NextResponse.json({ error: "Unsupported extractor platform" }, { status: 400 });
    } catch (error: any) {
        console.error("[CameraExtractor] Error:", error.message);
        return NextResponse.json({ error: "Failed to extract stream" }, { status: 500 });
    }
}

export const runtime = "nodejs";
