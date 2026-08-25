import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { isHostAllowlisted } from "@/lib/security/hostAllowlist";

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
        // Match on the parsed hostname, never a raw substring over the URL,
        // so arbitrary hosts cannot precede or follow the allowed domain.
        // Userinfo is stripped before fetching so credentials never reach the
        // network and the URL still satisfies the hostname check.
        if (isHostAllowlisted(targetUrl, ["balticlivecam.com"])) {
            const resolved = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(targetUrl) ? targetUrl : `https://${targetUrl}`;
            const parsedTarget = new URL(resolved);
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
