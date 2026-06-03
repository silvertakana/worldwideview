/**
 * @file mcpSessionCatalog.ts
 * @description Per-session MCP plugin catalog store (Phase 21 Wave 2).
 *
 * The browser tab POSTs its loaded plugins' mcpTools + mcpCapabilities to
 * a Redis key scoped {userId}:{sessionId} with a TTL. The stateless MCP
 * route reads this catalog to compose tools/list dynamically.
 *
 * Design:
 *   - publishSessionCatalog: redis.set(..., "EX", TTL) -- single atomic write.
 *   - readSessionCatalog: redis.get + JSON.parse -- returns null on miss/error.
 *   - Key includes BOTH userId and sessionId; cross-session isolation is enforced
 *     by key scoping alone (no user-supplied identity accepted at read time).
 *   - Payload size is capped before write; oversized payloads are rejected silently.
 */

import { redis } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** TTL in seconds for a catalog entry. Re-published periodically by the browser hook. */
const CATALOG_TTL_SECONDS = 120;

/** Maximum allowed serialized payload size in bytes (~64 KB). */
const MAX_CATALOG_BYTES = 64 * 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single namespaced plugin tool entry in the per-session catalog. */
export interface CatalogTool {
    namespacedName: string;
    pluginId: string;
    description: string;
    inputSchema: Record<string, unknown>;
    mcpCapabilities?: string[];
}

/** The catalog payload published by the browser and read by the server. */
export interface SessionCatalog {
    tools: CatalogTool[];
    capabilities: string[];
}

// ---------------------------------------------------------------------------
// Key helper
// ---------------------------------------------------------------------------

function catalogKey(userId: string, sessionId: string): string {
    return `mcp:catalog:${userId}:${sessionId}`;
}

// ---------------------------------------------------------------------------
// publishSessionCatalog (CAT-01, CAT-02, CAT-05)
// ---------------------------------------------------------------------------

/**
 * Stores the browser-published plugin catalog under a Redis key scoped to
 * both userId and sessionId, with a TTL.
 *
 * userId MUST come from the server-side auth result -- never from the request body.
 * Oversized payloads are silently dropped (caller should validate before calling).
 */
export async function publishSessionCatalog(
    userId: string,
    sessionId: string,
    catalog: SessionCatalog,
): Promise<void> {
    const json = JSON.stringify(catalog);

    if (Buffer.byteLength(json, "utf8") > MAX_CATALOG_BYTES) {
        console.error(
            "[mcpSessionCatalog] publishSessionCatalog rejected oversized payload for",
            userId,
        );
        return;
    }

    const key = catalogKey(userId, sessionId);
    try {
        await redis.set(key, json, "EX", CATALOG_TTL_SECONDS);
    } catch (err) {
        console.error("[mcpSessionCatalog] publishSessionCatalog failed:", err);
    }
}

// ---------------------------------------------------------------------------
// readSessionCatalog (CAT-03, CAT-04, CAT-06)
// ---------------------------------------------------------------------------

/**
 * Returns the stored catalog for a specific user+session, or null if not found.
 *
 * The key includes both userId and sessionId, so reading a different sessionId
 * for the same user returns null -- cross-session isolation enforced by key shape.
 */
export async function readSessionCatalog(
    userId: string,
    sessionId: string,
): Promise<SessionCatalog | null> {
    const key = catalogKey(userId, sessionId);
    try {
        const raw = await redis.get(key);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (isSessionCatalog(parsed)) {
            return parsed;
        }
        return null;
    } catch (err) {
        console.error("[mcpSessionCatalog] readSessionCatalog failed:", err);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isSessionCatalog(value: unknown): value is SessionCatalog {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return Array.isArray(v.tools) && Array.isArray(v.capabilities);
}
