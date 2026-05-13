/**
 * Server-side AgentBus, scoped per user.
 *
 * Holds the set of currently-connected SSE clients keyed by Auth.js user id
 * and broadcasts agent actions (`fly_to`, `layer_toggle`, etc.) published
 * via `/api/agent/publish` only to subscribers belonging to the same user
 * as the publisher. The browser-side subscriber dispatches the received
 * actions onto the existing `dataBus` so the running React + Cesium app
 * picks them up the same way it picks up any other UI event.
 *
 * Per-user scoping: in a multi-tenant WWV deployment, user A's external
 * tool publishing to /api/agent/publish must NOT reach user B's open
 * browser tab. The publish + subscribe routes pass `session.user.id`,
 * the bus routes deliveries to that user's subscriber set only.
 *
 * Process-local in-memory only. Multi-instance deployments would need a
 * Redis pub/sub adapter; a self-hosted single-process WWV is the primary
 * target — extending this is straightforward when needed.
 */

export type AgentAction =
    | { action: "fly_to"; lat: number; lon: number; alt?: number; heading?: number; distance?: number }
    | { action: "face_towards"; lat: number; lon: number; alt?: number }
    | { action: "layer_toggle"; pluginId: string; enabled: boolean }
    | { action: "highlight_layer"; pluginId: string }
    | { action: "select_entity"; pluginId: string; entityId: string }
    | { action: "ping"; ts: number };

interface Subscriber {
    id: string;
    write: (chunk: string) => void;
    close: () => void;
}

class AgentBus {
    /** userId → (connId → Subscriber). Empty inner maps are pruned on unsubscribe. */
    private byUser = new Map<string, Map<string, Subscriber>>();

    subscribe(userId: string, sub: Subscriber): () => void {
        let bucket = this.byUser.get(userId);
        if (!bucket) {
            bucket = new Map();
            this.byUser.set(userId, bucket);
        }
        bucket.set(sub.id, sub);
        return () => {
            const b = this.byUser.get(userId);
            if (!b) return;
            b.delete(sub.id);
            if (b.size === 0) this.byUser.delete(userId);
        };
    }

    /** Broadcast an action only to subscribers belonging to the publisher's user. */
    publish(userId: string, message: AgentAction): { delivered: number } {
        const bucket = this.byUser.get(userId);
        if (!bucket) return { delivered: 0 };
        const payload = `data: ${JSON.stringify(message)}\n\n`;
        let delivered = 0;
        for (const sub of bucket.values()) {
            try {
                sub.write(payload);
                delivered++;
            } catch {
                bucket.delete(sub.id);
            }
        }
        if (bucket.size === 0) this.byUser.delete(userId);
        return { delivered };
    }

    /** Count of currently-subscribed connections for a given user. */
    subscribersFor(userId: string): number {
        return this.byUser.get(userId)?.size ?? 0;
    }

    /** Total connections across all users (for diagnostics). */
    get totalSubscribers(): number {
        let n = 0;
        for (const bucket of this.byUser.values()) n += bucket.size;
        return n;
    }
}

// Module-level singleton. Next.js dev mode hot-reloads modules; using a
// global ensures the SSE state survives editor saves so connected browsers
// don't drop and reconnect on every code change in development.
declare global {
    // eslint-disable-next-line no-var
    var __WWV_AGENT_BUS__: AgentBus | undefined;
}

export const agentBus: AgentBus =
    globalThis.__WWV_AGENT_BUS__ ?? (globalThis.__WWV_AGENT_BUS__ = new AgentBus());
