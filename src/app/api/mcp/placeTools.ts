/**
 * MCP Places Tool registrar.
 *
 * Registers one MCP tool:
 *   search_places: free-text place search via Google Places (New), returning
 *                  coordinates, name, formatted address and types.
 *
 * The key is read from the instance environment only (never from tool
 * arguments), and a key that is absent or too short degrades to a plain
 * "not configured" result instead of an upstream failure.
 *
 * Places calls are billed, and this path does not go through /api/places/*, so the
 * tool spends the SAME per-IP Places budget as the browser routes before any
 * upstream call: otherwise agent traffic bypasses the only throttle on spend.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MAX_PLACES_QUERY_LENGTH, PlacesError, textSearchPlaces } from "@/lib/places/googlePlaces";
import type { PlaceSearchResult } from "@/lib/places/googlePlaces";
import { placesLimiter } from "@/lib/rateLimiters";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type McpTextResult = { content: [{ type: "text"; text: string }] };

function textResult(text: string): McpTextResult {
    return { content: [{ type: "text", text }] };
}

function errorResult(text: string): McpTextResult & { isError: true } {
    return { isError: true, content: [{ type: "text", text }] };
}

/** Same floor as resolvePlacesKey: a real Google header key is 39 chars. */
const MIN_KEY_LENGTH = 20;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/** The instance key, trimmed; null when absent or too short to be a key. */
function resolveInstanceKey(): string | null {
    const key = (
        process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    )?.trim();
    if (!key || key.length < MIN_KEY_LENGTH) return null;
    return key;
}

// ---------------------------------------------------------------------------
// Public registrar
// ---------------------------------------------------------------------------

export function registerPlaceTools(
    server: McpServer,
    ctx: { userId: string; clientIp: string },
): void {
    // The budget is keyed by client IP exactly as the Places routes key it, so an
    // agent cannot outspend the interactive search budget for its own address.
    const { clientIp } = ctx;

    server.registerTool(
        "search_places",
        {
            description:
                "Search for places, establishments, landmarks, or addresses using Google Places (New), returning coordinates, name, formatted address, and types.",
            inputSchema: {
                query: z
                    .string()
                    .min(1)
                    .max(MAX_PLACES_QUERY_LENGTH)
                    .describe(
                        "Location name, establishment, address, or point of interest to search for",
                    ),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(MAX_LIMIT)
                    .optional()
                    .describe("Max results (1-20, default 5)"),
            },
        },
        async (args) => {
            if (placesLimiter.check(clientIp)) {
                return errorResult("Places rate limit exceeded. Retry shortly.");
            }

            const key = resolveInstanceKey();
            if (key === null) {
                return errorResult("Google place search is not configured on this instance.");
            }

            try {
                const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
                const results: PlaceSearchResult[] = await textSearchPlaces(args.query, key, limit);
                if (results.length === 0) return textResult("no places found");
                return textResult(JSON.stringify(results));
            } catch (err) {
                if (err instanceof PlacesError) {
                    return errorResult(
                        `Google Places error (${err.googleStatus}): ${err.message}`,
                    );
                }
                console.error("[placeTools] search_places failed:", err);
                return errorResult("Internal error searching places");
            }
        },
    );
}
