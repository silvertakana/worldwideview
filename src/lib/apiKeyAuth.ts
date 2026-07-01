import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { edition } from "@/core/edition";
import { isSigningKeyValid } from "@/lib/signingKeyConfig";

// ---------------------------------------------------------------------------
// Signing key for HMAC-SHA256 hashing of API key secrets.
// API_KEY_HMAC_SECRET is the preferred dedicated variable.
// Falls back to BETTER_AUTH_SECRET in local edition only, so dev works without a
// separate .env entry.
//
// Lazy enforcement (not a bare module-level throw): Next.js evaluates module
// code at build time and during edge prerender. A top-level throw would break
// `next build` in environments where these env vars are not yet populated.
// Throwing inside the function means the check fires only on the first real
// auth call, where a missing/shared key is an actual runtime problem.
// ---------------------------------------------------------------------------

function getSigningKey(): string {
    const dedicated = process.env.API_KEY_HMAC_SECRET;
    const fallback = process.env.BETTER_AUTH_SECRET;

    if (edition === "cloud" || edition === "demo") {
        if (!isSigningKeyValid()) {
            throw new Error(
                `API_KEY_HMAC_SECRET must be set and distinct from BETTER_AUTH_SECRET in ${edition} edition`,
            );
        }
        // isSigningKeyValid() returning true guarantees dedicated is set and
        // distinct from BETTER_AUTH_SECRET for cloud/demo editions.
        return dedicated as string;
    }

    // local edition: allow BETTER_AUTH_SECRET fallback for convenience
    const key = dedicated ?? fallback;
    if (!key) throw new Error("API_KEY_HMAC_SECRET (or BETTER_AUTH_SECRET) must be set");
    return key;
}

function hmacHex(secret: string): string {
    return createHmac("sha256", getSigningKey()).update(secret).digest("hex");
}

// ---------------------------------------------------------------------------
// lastUsedAt throttle: at most one DB write per key per 60 seconds.
// TTL-evict entries after 2x the window so this Map cannot grow unbounded.
// Note: per-replica — at scale, move eviction to Redis.
// ---------------------------------------------------------------------------

const lastUsedAtThrottle = new Map<string, number>();
const LAST_USED_THROTTLE_MS = 60_000;
const THROTTLE_TTL_MS = LAST_USED_THROTTLE_MS * 2;

function recordLastUsed(id: string): void {
    const now = Date.now();
    const lastWrite = lastUsedAtThrottle.get(id) ?? 0;

    if (now - lastWrite <= LAST_USED_THROTTLE_MS) return;

    lastUsedAtThrottle.set(id, now);

    // Evict entries older than TTL to prevent unbounded growth
    for (const [key, ts] of lastUsedAtThrottle) {
        if (now - ts > THROTTLE_TTL_MS) lastUsedAtThrottle.delete(key);
    }

    void prisma.userApiKey.update({
        where: { id },
        data: { lastUsedAt: new Date() },
    }).catch(() => { /* intentional — never block the request */ });
}

// ---------------------------------------------------------------------------
// Interfaces (exported for consumers — API-01)
// ---------------------------------------------------------------------------

export interface GeneratedKey {
    /** e.g. "wwv_KpKF4LhL" — stored plaintext in DB as lookup handle */
    prefix: string;
    /** 32-byte base64url — shown to user ONCE, never stored */
    secret: string;
    /** HMAC-SHA256(signingKey, secret) hex — stored in DB */
    hashedSecret: string;
    /** "wwv_KpKF4LhL.3EqV...1k0" — the full bearer token, shown once */
    fullToken: string;
}

export interface AuthenticatedKey {
    userId: string;
    keyId: string;
}

// ---------------------------------------------------------------------------
// generateApiKey — KEY-01, KEY-02
// ---------------------------------------------------------------------------

/**
 * Generates a new API key pair.
 * - prefix: "wwv_" + 8 url-safe chars (stored plaintext; used as DB lookup key)
 * - secret: 43 url-safe chars from 32 random bytes (returned ONCE, never stored)
 * - hashedSecret: HMAC-SHA256(signingKey, secret) hex — what gets persisted
 * - fullToken: combined bearer value shown to the user exactly once
 */
export function generateApiKey(): GeneratedKey {
    // randomBytes(6) -> 8 base64url chars (no padding)
    const prefix = "wwv_" + randomBytes(6).toString("base64url");
    // randomBytes(32) -> 43 base64url chars
    const secret = randomBytes(32).toString("base64url");
    const hashedSecret = hmacHex(secret);
    return {
        prefix,
        secret,
        hashedSecret,
        fullToken: `${prefix}.${secret}`,
    };
}

// ---------------------------------------------------------------------------
// authenticateApiKey — API-01, KEY-02
// ---------------------------------------------------------------------------

/**
 * Resolves an "Authorization: Bearer wwv_<prefix>.<secret>" header to the
 * owning user. Returns null (never throws) on any failure path.
 *
 * Timing-oracle defense (T-16-01): timingSafeEqual always executes even
 * when the prefix is not found in the DB, using a dummy digest so the miss
 * path and the wrong-secret path are indistinguishable by latency.
 */
export async function authenticateApiKey(
    request: Request,
): Promise<AuthenticatedKey | null> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.slice(7).trim();
    const dotIdx = token.indexOf(".");
    if (dotIdx === -1) return null;

    const prefix = token.substring(0, dotIdx);
    const secret = token.substring(dotIdx + 1);

    // DB outage guard (TRANS-02): a rejected Prisma call is treated as a miss
    // so the caller receives null (-> 401) rather than an unhandled rejection.
    let row: { id: string; userId: string; hashedSecret: string } | null;
    try {
        row = await prisma.userApiKey.findUnique({
            where: { prefix },
            select: { id: true, userId: true, hashedSecret: true },
        });
    } catch (err) {
        console.warn("[apiKeyAuth] DB error during key lookup:", err instanceof Error ? err.name : "unknown");
        return null;
    }

    // Compute HMAC of the supplied secret, then compare with timingSafeEqual.
    // On a prefix miss we compare against a dummy digest — constant-work on
    // both paths defeats timing-oracle attacks (T-16-01).
    const supplied = Buffer.from(hmacHex(secret), "hex");
    const stored = Buffer.from(row?.hashedSecret ?? hmacHex("__wwv_dummy__"), "hex");
    const isValid = timingSafeEqual(supplied, stored);

    if (!row || !isValid) return null;

    recordLastUsed(row.id);

    return { userId: row.userId, keyId: row.id };
}
