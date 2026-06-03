import { NextResponse } from "next/server";
import { auth as getSession } from "@/lib/auth";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { writeGlobeState } from "@/lib/globeStateStore";
import { mcpLimiter, getClientIp } from "@/lib/rateLimiters";
import { isDemo } from "@/core/edition";
import type { GlobeStateSnapshot } from "@/lib/globeState";

export async function POST(request: Request) {
    const limited = mcpLimiter.check(getClientIp(request));
    if (limited) return limited;

    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    // R-2: browser write path authenticates via NextAuth session cookie (primary),
    // falling back to Bearer API key for programmatic/MCP clients.
    let userId: string | null = null;

    const session = await getSession();
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

    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { sessionId, snapshot } = body;

    if (typeof sessionId !== "string" || sessionId.length === 0) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        return NextResponse.json({ error: "snapshot is required" }, { status: 400 });
    }

    void writeGlobeState(userId, sessionId, snapshot as GlobeStateSnapshot);

    return NextResponse.json({ ok: true });
}
