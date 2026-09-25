/**
 * MCP Geocoding Tool registrar (Phase 22 Wave 2, 22-02).
 *
 * Registers one MCP tool:
 *   geocode_location: resolve a place name/address to coordinates via Nominatim
 *                     (GEO-01), with a per-user rate limit + 24h Redis cache (GEO-03)
 *
 * Answers on the v2 envelope. A miss is a REAL not_found failure, never an
 * empty success, and a rate limit or upstream outage is reported as its own
 * failure code -- "the place does not exist" and "we could not ask" are
 * different answers and an agent must be able to tell them apart.
 *
 * Camera movement lives in globeCommandTools.ts: pan_globe takes the lat/lon or
 * bbox a geocode result produces.
 *
 * Security: userId comes ONLY from ctx (verified auth result), never from tool
 * arguments. The Nominatim URL is hardcoded; the user query is injected via
 * URLSearchParams inside fetchGeocode (no string concatenation).
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchGeocode, normalizeNominatimResult } from "@/lib/nominatim";
import type { NominatimResult } from "@/lib/nominatim";
import { checkRateLimit } from "@/lib/geocodingRateLimit";
import { redis } from "@/lib/redis";
import { mcpCatch, mcpFail, mcpOk } from "@/lib/mcp/responseEnvelope";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const CACHE_TTL_SECONDS = 86_400; // 24h

/** Cache payload: the normalized results plus when the upstream gave them. */
interface GeocodeCacheEntry {
    capturedAt: string;
    results: NominatimResult[];
}

/** Best-effort cache read: a Redis outage or a stale shape degrades to a miss. */
async function cacheGet(key: string): Promise<GeocodeCacheEntry | null> {
    try {
        const raw = await redis.get(key);
        if (raw === null) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return null;
        const entry = parsed as Partial<GeocodeCacheEntry>;
        return Array.isArray(entry.results) && typeof entry.capturedAt === "string"
            ? { capturedAt: entry.capturedAt, results: entry.results }
            : null;
    } catch (err) {
        console.warn("[geocodingTools] cache read failed (degrading to miss):", err);
        return null;
    }
}

/** Best-effort cache write: a Redis outage is logged and ignored. */
async function cacheSet(key: string, entry: GeocodeCacheEntry): Promise<void> {
    try {
        await redis.set(key, JSON.stringify(entry), "EX", CACHE_TTL_SECONDS);
    } catch (err) {
        console.warn("[geocodingTools] cache write failed (ignored):", err);
    }
}

/** The geocode result payload: the best match first, then any alternatives. */
function geocodeData(query: string, results: NominatimResult[]): Record<string, unknown> {
    const [best, ...alternatives] = results;
    return {
        query,
        lat: best.lat,
        lng: best.lng,
        displayName: best.display_name,
        name: best.name,
        nameEn: best.name_en,
        type: best.type,
        addresstype: best.addresstype,
        country: best.country,
        bbox: best.bbox,
        importance: best.importance,
        ...(alternatives.length > 0 && { alternatives }),
    };
}

// ---------------------------------------------------------------------------
// Public registrar
// ---------------------------------------------------------------------------

export function registerGeocodingTools(
    server: McpServer,
    ctx: { userId: string },
): void {
    const { userId } = ctx;

    // GEO-01 + GEO-03: geocode_location
    server.registerTool(
        "geocode_location",
        {
            description:
                "Resolve a place name or address to coordinates and a bounding box via OpenStreetMap Nominatim. " +
                "Use before pan_globe to obtain lat/lon from a name; do not guess coordinates. " +
                "Limitations: Nominatim is rate-limited to 1 request/sec per user (results are cached 24h, so a repeat query is free); a query that matches nothing fails with error not_found, which is NOT an outage. " +
                "Parameters: query (string, required) - place name or address; limit (integer 1-20, optional, default 5). " +
                "Output: { ok: true, data: { query, lat, lng, displayName, name, nameEn, type, addresstype, country, bbox: [west,south,east,north], importance, alternatives? } }. " +
                "Example: geocode_location({ query: 'Paris', limit: 3 }) -> data: { lat: 48.85, lng: 2.35, displayName: 'Paris, France', bbox: [...] }.",
            inputSchema: {
                query: z.string().min(1).describe("Location name or address to geocode"),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(MAX_LIMIT)
                    .optional()
                    .describe("Max matches to return (default 5, max 20); the best match is the top-level result"),
            },
        },
        async (args) => {
            const query = args.query;
            try {
                const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
                const cacheKey = `geocode:${query.toLowerCase().trim()}:${limit}`;

                const cached = await cacheGet(cacheKey);
                if (cached !== null) {
                    return mcpOk(geocodeData(query, cached.results), {
                        count: cached.results.length,
                        capturedAt: cached.capturedAt,
                    });
                }

                const rateLimit = await checkRateLimit(userId);
                if (rateLimit) {
                    return mcpFail("rate_limited", "Nominatim allows 1 geocode request per second per user.", {
                        hint: `Wait about ${rateLimit.retryAfterMs} ms, then retry the same query. Repeating a query you already asked is free -- results are cached 24h.`,
                        details: { retryAfterMs: rateLimit.retryAfterMs, query },
                    });
                }

                const raw = await fetchGeocode({ query, limit });
                if (raw.length === 0) {
                    return mcpFail("not_found", `Could not resolve "${query}" to a place.`, {
                        hint: "Try a less ambiguous query, or add a country/region. If you already have coordinates, skip geocoding and use query_entities({near}) or pan_globe.",
                        details: { query },
                    });
                }

                const producedAt = new Date().toISOString();
                const results = raw.map(normalizeNominatimResult);
                await cacheSet(cacheKey, { capturedAt: producedAt, results });
                return mcpOk(geocodeData(query, results), {
                    count: results.length,
                    capturedAt: producedAt,
                });
            } catch (err) {
                return mcpCatch("engine_unreachable", "Geocoding upstream (Nominatim) is unreachable.", err, {
                    hint: "This is an OUTAGE, NOT a missing place -- do not report the location as nonexistent. Retry shortly, or tell the user geocoding is temporarily down.",
                    details: { query },
                });
            }
        },
    );
}
