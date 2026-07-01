/**
 * GET /api/globe/commands?sessionId=<uuid>
 *
 * Browser poll endpoint for the Globe Command System (Phase 19a).
 * The browser calls this on an interval (~1500ms) to drain any commands
 * queued by the MCP agent via registerGlobeCommandTools.
 *
 * Auth (R-2 dual-auth, mirrors POST /api/globe/state):
 *   Primary:  Better Auth session cookie (browser path)
 *   Fallback: Bearer API key (MCP / programmatic path)
 *   userId comes ONLY from the resolved auth result -- never from the query string.
 *
 * sessionId comes from the ?sessionId query param (scopes the tab, not identity).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { drainGlobeCommands } from "@/lib/globeCommandQueue";
import { globeCommandsLimiter, getClientIp } from "@/lib/rateLimiters";
import { resolveEdition } from "@/core/edition";

const SESSION_ID_RE = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request): Promise<NextResponse> {
    const limited = globeCommandsLimiter.check(getClientIp(request));
    if (limited) return limited as NextResponse;

    const currentEdition = resolveEdition(process.env.NEXT_PUBLIC_WWV_EDITION);
    if (currentEdition === "demo") {
        return NextResponse.json({ error: "Demo mode" }, { status: 403 });
    }

    // R-2: Better Auth session PRIMARY, Bearer API key FALLBACK.
    // userId is resolved exclusively from the auth result -- never from the URL.
    let userId: string | null = null;

    const session = await getServerSession();
    if (session?.user?.id) {
        userId = session.user.id;
    } else {
        const apiKeyAuth = await authenticateApiKey(request);
        if (apiKeyAuth) {
            userId = apiKeyAuth.userId;
        }
    }

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? "";

    if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
        return NextResponse.json({ error: "invalid sessionId" }, { status: 400 });
    }

    const commands = await drainGlobeCommands(userId, sessionId);

    return NextResponse.json({ commands });
}

export const runtime = "nodejs";
