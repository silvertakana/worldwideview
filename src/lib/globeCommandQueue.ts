import { redis } from "@/lib/redis";
import { isValidGlobeCommand } from "@/core/globe/types/GlobeCommand";
import type { GlobeCommand } from "@/core/globe/types/GlobeCommand";

const COMMAND_QUEUE_TTL_SECONDS = 60;
const STALE_THRESHOLD_MS = 45_000;

function queueKey(userId: string, sessionId: string): string {
    return `globe:commandqueue:${userId}:${sessionId}`;
}

export async function enqueueGlobeCommand(
    userId: string,
    sessionId: string,
    cmd: GlobeCommand,
): Promise<void> {
    const key = queueKey(userId, sessionId);
    try {
        await redis.multi().rpush(key, JSON.stringify(cmd)).expire(key, COMMAND_QUEUE_TTL_SECONDS).exec();
    } catch (err) {
        console.error("[globeCommandQueue] enqueueGlobeCommand failed:", err);
    }
}

export async function drainGlobeCommands(
    userId: string,
    sessionId: string,
): Promise<GlobeCommand[]> {
    const key = queueKey(userId, sessionId);
    try {
        const results = await redis.multi().lrange(key, 0, -1).del(key).exec();

        // results[0] is the lrange reply: [error | null, string[]]
        const lrangeReply = results[0];
        if (!lrangeReply || lrangeReply[0] !== null) {
            return [];
        }

        const raw = lrangeReply[1];
        if (!Array.isArray(raw)) {
            return [];
        }

        const commands: GlobeCommand[] = [];
        for (const entry of raw) {
            if (typeof entry !== "string") continue;
            try {
                const parsed: unknown = JSON.parse(entry);
                if (isValidGlobeCommand(parsed)) {
                    commands.push(parsed);
                }
            } catch {
                // Drop unparseable entries silently
            }
        }

        return commands;
    } catch (err) {
        console.error("[globeCommandQueue] drainGlobeCommands failed:", err);
        return [];
    }
}

export async function resolveActiveSessionId(userId: string): Promise<string | null> {
    try {
        // ioredis WITHSCORES returns flat interleaved [member, score, member, score, ...]
        const flat = await redis.zrange(`globe:sessions:${userId}`, 0, -1, "WITHSCORES");
        const now = Date.now();

        let bestMember: string | null = null;
        let bestScore = -Infinity;

        for (let i = 0; i < flat.length; i += 2) {
            const member = flat[i];
            const score = Number(flat[i + 1]);
            if (now - score < STALE_THRESHOLD_MS && score > bestScore) {
                bestScore = score;
                bestMember = member;
            }
        }

        return bestMember;
    } catch (err) {
        console.error("[globeCommandQueue] resolveActiveSessionId failed:", err);
        return null;
    }
}
