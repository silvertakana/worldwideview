/**
 * GET /api/globe/commands/stream?sessionId=<uuid>
 *
 * SSE push transport for the Globe Command System (Phase 19b).
 * Replaces the browser's 1500ms poll loop with a persistent EventSource
 * connection, cutting command latency from ~1500ms to near-real-time.
 *
 * Auth (R-2 dual-auth, mirrors GET /api/globe/commands):
 *   Primary:  NextAuth session cookie (browser path)
 *   Fallback: Bearer API key (MCP / programmatic path)
 *   userId comes ONLY from the resolved auth result -- never from the URL.
 *
 * Gate order (MUST NOT be reordered):
 *   1. Rate limiter (DoS defense before any IO)
 *   2. Demo edition guard (pre-auth, no DB hit on demo)
 *   3. Dual-auth (session or API key)
 *   4. UUID sessionId guard (scopes the Redis queue key)
 */

import { NextResponse } from "next/server";
import { auth as getSession } from "@/lib/auth";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { drainGlobeCommands } from "@/lib/globeCommandQueue";
import { globeCommandsStreamLimiter, getClientIp } from "@/lib/rateLimiters";
import { resolveEdition } from "@/core/edition";

const SESSION_ID_RE = /^[0-9a-f-]{36}$/i;
const POLL_INTERVAL_MS = 200;
const KEEPALIVE_INTERVAL_MS = 15_000;
const MAX_DURATION_MS = 16_000;

const SSE_HEADERS = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
};

function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request): Promise<Response> {
    // Gate 1: rate limiter -- must be first to protect against DoS before auth IO
    const limited = globeCommandsStreamLimiter.check(getClientIp(request));
    if (limited) return limited as Response;

    // Gate 2: demo edition -- read env at request time so vi.stubEnv works in tests
    const currentEdition = resolveEdition(process.env.NEXT_PUBLIC_WWV_EDITION);
    if (currentEdition === "demo") {
        return NextResponse.json({ error: "Demo mode" }, { status: 403 }) as Response;
    }

    // Gate 3: dual-auth -- session primary, Bearer API key fallback
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
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as Response;
    }

    // Gate 4: UUID sessionId guard -- scopes the Redis queue key
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? "";

    if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
        return NextResponse.json({ error: "invalid sessionId" }, { status: 400 }) as Response;
    }

    // Capture for use inside the ReadableStream closure
    const resolvedUserId = userId;
    const resolvedSessionId = sessionId;

    let cancelled = false;

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            function send(chunk: string): void {
                controller.enqueue(encoder.encode(chunk));
            }

            const startTime = Date.now();
            let lastKeepalive = Date.now();

            try {
                while (Date.now() - startTime < MAX_DURATION_MS) {
                    const commands = await drainGlobeCommands(resolvedUserId, resolvedSessionId);
                    for (const cmd of commands) {
                        send("data: " + JSON.stringify({ commands: [cmd] }) + "\n\n");
                    }

                    if (Date.now() - lastKeepalive >= KEEPALIVE_INTERVAL_MS) {
                        send(":keepalive\n\n");
                        lastKeepalive = Date.now();
                    }

                    await sleep(POLL_INTERVAL_MS);
                    if (cancelled) break;
                }

                controller.close();
            } catch (err) {
                console.error("[globe/commands/stream] stream error:", err);
                controller.error(err);
            }
        },
        cancel() {
            cancelled = true;
        },
    });

    return new Response(stream, { headers: SSE_HEADERS });
}
