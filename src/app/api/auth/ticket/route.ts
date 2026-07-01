import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { isAuthEnabled } from "@/core/edition";
import { getTicket } from "@/lib/auth/ticketClient";

/**
 * GET /api/auth/ticket?pluginId=<id>
 * Returns a short-lived PluginTicket for the given plugin.
 * Used by WsClient (browser) to obtain auth tokens without DB access.
 */
export async function GET(req: NextRequest) {
    if (isAuthEnabled) {
        const session = await getServerSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const pluginId = req.nextUrl.searchParams.get("pluginId");
    if (!pluginId) {
        return NextResponse.json({ error: "Missing pluginId" }, { status: 400 });
    }

    try {
        const token = await getTicket(pluginId);
        return NextResponse.json({ token });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[ticket-route]", message);
        if (message.includes("No marketplace credential found")) {
            return NextResponse.json({ noCredential: true });
        }
        if (message.includes("rejected (401)")) {
            return NextResponse.json(
                { error: "Credential rejected by marketplace", errorCode: "credential_rejected" },
                { status: 502 }
            );
        }
        return NextResponse.json({ error: "Failed to obtain plugin ticket" }, { status: 500 });
    }
}

export const runtime = "nodejs";
