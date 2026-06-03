/**
 * POST /api/mcp/results
 *
 * Browser-facing endpoint for posting tool execution results back to the server
 * (Phase 21 Wave 3 -- PLUG-03). The browser bridge calls plugin.executeMcpTool,
 * then POSTs { requestId, result, sessionId } here so the server's blpop unblocks.
 *
 * Auth (dual-auth, mirrors GET /api/globe/commands):
 *   Primary:  NextAuth session cookie (browser path)
 *   Fallback: Bearer API key (programmatic path)
 *   userId comes ONLY from the resolved auth result -- never from the request body.
 *
 * Security:
 *   - Ownership check: requestId must belong to this userId+session.
 *   - Result size is capped inside postToolResult.
 *   - sessionId from the request body (not auth), but userId always from auth.
 */

import { NextResponse } from "next/server";
import { auth as getSession } from "@/lib/auth";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { postToolResult } from "@/lib/mcpRelay";
import { mcpResultsLimiter, getClientIp } from "@/lib/rateLimiters";
import { isDemo } from "@/core/edition";

const SESSION_ID_RE = /^[0-9a-f-]{36}$/i;
const REQUEST_ID_RE = /^[0-9a-f-]{36}$/i;

/** Pre-parse body size cap (1 MB). The post-parse cap inside postToolResult is 512 KB. */
const MAX_BODY_BYTES = 1 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
    // Rate limit before any auth or DB work.
    const limited = mcpResultsLimiter.check(getClientIp(request));
    if (limited) return limited as NextResponse;

    if (isDemo) {
        return NextResponse.json({ error: "MCP is not available in demo mode" }, { status: 403 });
    }

    // Dual-auth: NextAuth session PRIMARY, Bearer API key FALLBACK.
    // userId is resolved exclusively from the auth result -- never from the body.
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

    let body: unknown;
    try {
        const text = await request.text();
        if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
            return NextResponse.json({ error: "Payload too large" }, { status: 413 });
        }
        body = JSON.parse(text);
    } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "invalid request body" }, { status: 400 });
    }

    const { sessionId, requestId, result } = body as Record<string, unknown>;

    if (typeof sessionId !== "string" || !SESSION_ID_RE.test(sessionId)) {
        return NextResponse.json({ error: "invalid sessionId" }, { status: 400 });
    }

    if (typeof requestId !== "string" || !REQUEST_ID_RE.test(requestId)) {
        return NextResponse.json({ error: "invalid requestId" }, { status: 400 });
    }

    // Delegate to postToolResult which enforces ownership and size caps.
    const opResult = await postToolResult(userId, sessionId, requestId, result);

    if (opResult.rejected) {
        return NextResponse.json(
            { error: opResult.reason ?? "rejected" },
            { status: 403 },
        );
    }

    return NextResponse.json({ ok: true });
}
