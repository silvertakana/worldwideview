import { getServerSession } from "@/lib/ba-session";
import { agentBus } from "@/lib/agent/bus";

/**
 * GET /api/agent/stream
 *
 * Server-Sent Events channel that the browser subscribes to. Each connected
 * client receives every action `/api/agent/publish` broadcasts *for the
 * same authenticated user*. Multi-tenant safe: user A's stream never sees
 * user B's publishes.
 *
 * Auth-gated via Auth.js session.
 */
export async function GET() {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
    }
    const userId = session.user.id;

    let unsubscribe = () => {};
    const id = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();

            // Initial comment + retry hint so EventSource has something to ack
            // immediately and reconnects fast if the connection drops.
            controller.enqueue(encoder.encode(":connected\nretry: 3000\n\n"));

            unsubscribe = agentBus.subscribe(userId, {
                id,
                write: (chunk) => controller.enqueue(encoder.encode(chunk)),
                close: () => {
                    try { controller.close(); } catch { /* already closed */ }
                },
            });

            // Heartbeat every 25s so intermediaries (Caddy, nginx, CDNs) don't
            // tear down a "stalled" connection. SSE-aware proxies typically
            // need a comment line every <30s to keep the channel alive.
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`:hb ${Date.now()}\n\n`));
                } catch {
                    clearInterval(heartbeat);
                }
            }, 25_000);

            (controller as any)._cleanup = () => {
                clearInterval(heartbeat);
                unsubscribe();
            };
        },
        cancel() {
            unsubscribe();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}

export const runtime = "nodejs";
