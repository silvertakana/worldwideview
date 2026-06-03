/**
 * POST /api/mcp/catalog
 *
 * Browser-facing endpoint that accepts a per-session plugin catalog
 * and stores it in Redis scoped to the authenticated user's session.
 *
 * Gate ordering:
 *   1. Rate limit (prevents abuse before any auth work)
 *   2. isDemo 403 (demo edition does not support MCP)
 *   3. Dual-auth: NextAuth session cookie PRIMARY, Bearer apiKey FALLBACK
 *   4. sessionId UUID guard
 *   5. Body shape + size validation
 *   6. publishSessionCatalog (userId ONLY from auth result)
 *
 * Security invariants:
 *   - userId is read ONLY from the auth result -- never from the request body.
 *   - Catalog Redis key is scoped both {userId} and {sessionId}.
 *   - Payload size is capped before write; malformed shapes are rejected.
 *   - isDemo 403 gate runs BEFORE auth (avoids DB layer in demo mode).
 */

import { NextResponse } from "next/server";
import { auth as getSession } from "@/lib/auth";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { publishSessionCatalog, readSessionCatalog } from "@/lib/mcpSessionCatalog";
import type { SessionCatalog } from "@/lib/mcpSessionCatalog";
import { resolveActiveSessionId } from "@/lib/globeCommandQueue";
import { globeCommandsLimiter, getClientIp } from "@/lib/rateLimiters";
import { isDemo } from "@/core/edition";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_ID_RE = /^[0-9a-f-]{36}$/i;

/** Maximum allowed serialized body size in bytes (~64 KB). */
const MAX_BODY_BYTES = 64 * 1024;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
    // Gate 1: Rate limit
    const limited = globeCommandsLimiter.check(getClientIp(request));
    if (limited) return limited as NextResponse;

    // Gate 2: isDemo 403 (BEFORE auth)
    if (isDemo) {
        return NextResponse.json(
            { error: "MCP catalog is not available in demo mode" },
            { status: 403 },
        );
    }

    // Gate 3: Dual-auth -- NextAuth session PRIMARY, Bearer apiKey FALLBACK
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

    // Gate 4: sessionId UUID guard
    // sessionId may come from the request body; if absent, fall back to the
    // user's active session (same pattern as globeCommandTools).
    let rawBody: unknown;
    try {
        const text = await request.text();
        if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
            return NextResponse.json({ error: "Payload too large" }, { status: 413 });
        }
        rawBody = JSON.parse(text);
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!rawBody || typeof rawBody !== "object") {
        return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
    }

    const body = rawBody as Record<string, unknown>;

    // Resolve sessionId
    let sessionId: string | null = null;
    const rawSessionId = body.sessionId;
    if (typeof rawSessionId === "string" && rawSessionId !== "") {
        if (!SESSION_ID_RE.test(rawSessionId)) {
            return NextResponse.json({ error: "invalid sessionId" }, { status: 400 });
        }
        sessionId = rawSessionId;
    } else {
        sessionId = await resolveActiveSessionId(userId);
    }

    if (!sessionId) {
        return NextResponse.json({ error: "No active session" }, { status: 400 });
    }

    // Gate 5: Body shape validation
    if (!Array.isArray(body.tools)) {
        return NextResponse.json({ error: "body.tools must be an array" }, { status: 400 });
    }
    if (!Array.isArray(body.capabilities)) {
        return NextResponse.json({ error: "body.capabilities must be an array" }, { status: 400 });
    }

    // Validate each tool entry: namespacedName format, description, inputSchema.
    const NAMESPACED_NAME_RE = /^[a-zA-Z0-9_-]+__[a-zA-Z0-9_-]+$/;
    const MAX_NAMESPACED_NAME_LENGTH = 128;
    for (const entry of body.tools) {
        if (!entry || typeof entry !== "object") {
            return NextResponse.json({ error: "invalid tool entry" }, { status: 400 });
        }
        const e = entry as Record<string, unknown>;
        if (
            typeof e.namespacedName !== "string" ||
            e.namespacedName.length > MAX_NAMESPACED_NAME_LENGTH ||
            !NAMESPACED_NAME_RE.test(e.namespacedName)
        ) {
            return NextResponse.json({ error: "invalid tool entry" }, { status: 400 });
        }
        if (typeof e.description !== "string") {
            return NextResponse.json({ error: "invalid tool entry" }, { status: 400 });
        }
        if (
            !e.inputSchema ||
            typeof e.inputSchema !== "object" ||
            Array.isArray(e.inputSchema)
        ) {
            return NextResponse.json({ error: "invalid tool entry" }, { status: 400 });
        }
    }

    const catalog: SessionCatalog = {
        tools: body.tools as SessionCatalog["tools"],
        capabilities: body.capabilities as string[],
    };

    // Gate 6: Store -- userId ONLY from auth result (NEVER from body)
    await publishSessionCatalog(userId, sessionId, catalog);

    return NextResponse.json({ ok: true });
}

// Export readSessionCatalog for use by the MCP route (re-export avoids extra import path)
export { readSessionCatalog };
