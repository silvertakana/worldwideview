import { prisma } from "@/lib/db";

/** Default replay window. Matches the 5-minute timestamp window in verify.ts. */
export const NONCE_TTL_MS = 300_000;

/** Minimum gap between expired-row sweeps. */
const PRUNE_INTERVAL_MS = 60_000;

/**
 * The slice of persistence the nonce store needs.
 *
 * `createNonce` must reject with Prisma's P2002 unique-violation code when the
 * nonce already exists: that rejection is what makes the replay check atomic,
 * so two concurrent requests carrying the same nonce cannot both be accepted.
 */
export interface NonceStoreClient {
    createNonce(nonce: string, expiresAt: Date): Promise<void>;
    deleteExpiredNonces(now: Date): Promise<number>;
}

export interface NonceStore {
    /**
     * Record a nonce and report whether it is fresh.
     *
     * Resolves true the first time a nonce is seen inside the TTL window (the
     * caller may proceed) and false when it has already been recorded (replay).
     */
    checkAndRecord(nonce: string, ttlMs?: number): Promise<boolean>;
}

/** Prisma raises P2002 when a unique constraint is violated. */
function isUniqueViolation(err: unknown): boolean {
    if (typeof err !== "object" || err === null) {
        return false;
    }
    return (err as { code?: unknown }).code === "P2002";
}

/**
 * Process-local guard used only while the database is unreachable.
 *
 * It has exactly the weakness the shared store replaces - it is scoped to one
 * process - but it keeps replay rejection working for a single instance
 * instead of accepting every nonce during a database blip.
 */
export class InProcessNonceStore {
    private readonly store = new Map<string, number>();

    checkAndRecord(nonce: string, ttlMs: number = NONCE_TTL_MS): boolean {
        const now = Date.now();

        for (const [seen, expiry] of this.store) {
            if (expiry <= now) {
                this.store.delete(seen);
            }
        }

        if (this.store.has(nonce)) {
            return false;
        }

        this.store.set(nonce, now + ttlMs);
        return true;
    }

    clear(): void {
        this.store.clear();
    }
}

/**
 * Durable nonce store backed by the `cross_service_nonces` table.
 *
 * Replaces the previous per-process Map, which lost every recorded nonce on
 * restart and could not see nonces recorded by a sibling instance.
 */
export class PrismaNonceStore implements NonceStore {
    private readonly client: NonceStoreClient;
    private readonly fallback: InProcessNonceStore;
    private lastPruneAt = 0;

    constructor(client: NonceStoreClient, fallback: InProcessNonceStore = new InProcessNonceStore()) {
        this.client = client;
        this.fallback = fallback;
    }

    async checkAndRecord(nonce: string, ttlMs: number = NONCE_TTL_MS): Promise<boolean> {
        const now = Date.now();

        try {
            await this.client.createNonce(nonce, new Date(now + ttlMs));
        } catch (err) {
            if (isUniqueViolation(err)) {
                return false;
            }
            // Best-effort posture, matching the other Redis/database-backed
            // guards in this app: replay protection is defence in depth behind
            // the HMAC signature, and every route behind this middleware reads
            // the same database, so an outage already fails the request further
            // down. Degrade instead of turning a database blip into a 401.
            console.warn("[cross-service] nonce store unavailable, using the in-process guard:", err);
            return this.fallback.checkAndRecord(nonce, ttlMs);
        }

        await this.pruneExpired(now);
        return true;
    }

    private async pruneExpired(now: number): Promise<void> {
        if (now - this.lastPruneAt < PRUNE_INTERVAL_MS) {
            return;
        }
        this.lastPruneAt = now;

        try {
            await this.client.deleteExpiredNonces(new Date(now));
        } catch (err) {
            // A failed sweep costs table growth, never correctness, so it must
            // not change the verdict of the request that triggered it.
            console.warn("[cross-service] nonce prune failed:", err);
        }
    }
}

export const nonceCache: NonceStore = new PrismaNonceStore({
    async createNonce(nonce, expiresAt) {
        await prisma.crossServiceNonce.create({ data: { nonce, expiresAt } });
    },
    async deleteExpiredNonces(now) {
        const { count } = await prisma.crossServiceNonce.deleteMany({
            where: { expiresAt: { lt: now } },
        });
        return count;
    },
});
