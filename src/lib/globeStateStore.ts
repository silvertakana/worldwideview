import { redis } from "@/lib/redis";
import type { GlobeStateSnapshot } from "@/lib/globeState";

const STATE_TTL_SECONDS = 30;
const STALE_THRESHOLD_MS = 45_000;

export function globeStateKey(userId: string, sessionId: string): string {
    return `globe:state:${userId}:${sessionId}`;
}

export function globeSessionsKey(userId: string): string {
    return `globe:sessions:${userId}`;
}

export async function writeGlobeState(
    userId: string,
    sessionId: string,
    snapshot: GlobeStateSnapshot,
): Promise<void> {
    try {
        await redis.set(globeStateKey(userId, sessionId), JSON.stringify(snapshot), "EX", STATE_TTL_SECONDS);
        await redis.zadd(globeSessionsKey(userId), Date.now(), sessionId);
    } catch (err) {
        console.warn("[globeStateStore] writeGlobeState failed:", err);
    }
}

export async function readGlobeState(
    userId: string,
    sessionId: string,
): Promise<GlobeStateSnapshot | null> {
    try {
        const raw = await redis.get(globeStateKey(userId, sessionId));
        if (raw === null) return null;
        return JSON.parse(raw) as GlobeStateSnapshot;
    } catch {
        return null;
    }
}

export async function readActiveSessions(
    userId: string,
): Promise<Array<{ sessionId: string; lastSeen: number }>> {
    try {
        // ioredis WITHSCORES returns flat interleaved [member, score, member, score, ...]
        const flat = await redis.zrange(globeSessionsKey(userId), 0, -1, "WITHSCORES");
        const now = Date.now();
        const active: Array<{ sessionId: string; lastSeen: number }> = [];
        const stale: string[] = [];

        for (let i = 0; i < flat.length; i += 2) {
            const member = flat[i];
            const score = Number(flat[i + 1]);
            if (now - score < STALE_THRESHOLD_MS) {
                active.push({ sessionId: member, lastSeen: score });
            } else {
                stale.push(member);
            }
        }

        // Best-effort stale cleanup — never blocks or throws
        if (stale.length > 0) {
            redis.zrem(globeSessionsKey(userId), ...stale).catch(() => undefined);
        }

        return active;
    } catch {
        return [];
    }
}
