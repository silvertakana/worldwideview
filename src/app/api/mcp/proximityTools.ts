/**
 * MCP Proximity Tool registrar (PR 1).
 *
 * Registers one server-side proximity tool:
 *   find_nearby_entities -- nearest-entity search (coordinate- or entity-based)
 *                           with true Haversine distance sorting and distanceKm
 *                           annotations on every result.
 *
 * Security:
 *   - userId comes ONLY from ctx (verified auth result); never from tool args.
 *   - lat/lon are range-bound by zod; radiusKm/limit are bounded by zod AND
 *     clamped again inside the service. originPluginId/originEntityId resolve
 *     entities only through the data-query service layer (never raw engine
 *     URLs), so plugin/entity ids can never reach the engine path.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { latSchema, lonSchema } from "@/lib/mcp/coordinateSchemas";
import { filterValueSchema } from "@/lib/mcp/filterSchemas";
import { findNearbyEntities } from "@/lib/mcp/proximityService";

type McpTextResult = { content: [{ type: "text"; text: string }] };

function textResult(payload: unknown): McpTextResult {
    return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
    };
}

export function registerProximityTools(server: McpServer, _ctx: { userId: string }): void {
    server.registerTool(
        "find_nearby_entities",
        {
            description:
                "Server-side proximity search for the nearest entities around a center, sorted by true Haversine great-circle distance (nearest first) with distanceKm on every result. " +
                "This is a READ-ONLY data tool -- it does NOT require an active globe session. " +
                "Provide the center either as coordinates (lat + lon) or as an existing entity (originPluginId + originEntityId, resolved server-side). " +
                "radiusKm defaults to 50 (max 1000); entities farther than radiusKm are excluded. " +
                "If targetPluginIds is omitted, every active streaming plugin is searched. " +
                "Optional 'filters' apply inline property filters to candidates (independent of set_filter state). " +
                "Returns emptyReason 'origin_entity_not_found' when the origin entity does not exist. " +
                "Example: find_nearby_entities({ lat: 51.5074, lon: -0.1278, radiusKm: 100, targetPluginIds: ['flights'], limit: 10 }) " +
                "Entity-based example: find_nearby_entities({ originPluginId: 'flights', originEntityId: 'BA123', radiusKm: 250 })",
            inputSchema: {
                lat: latSchema.describe("Center latitude [-90, 90]"),
                lon: lonSchema.describe("Center longitude [-180, 180]"),
                originPluginId: z
                    .string()
                    .optional()
                    .describe("Plugin ID of origin entity to center search around (alternative to lat/lon)"),
                originEntityId: z
                    .string()
                    .optional()
                    .describe("Entity ID of origin entity to center search around (alternative to lat/lon)"),
                radiusKm: z
                    .number()
                    .positive()
                    .max(1000)
                    .optional()
                    .default(50)
                    .describe("Search radius in kilometres (default 50, max 1000)"),
                targetPluginIds: z
                    .array(z.string())
                    .optional()
                    .describe("Optional list of plugin IDs to search within (e.g. ['flights', 'maritime']). If omitted, searches all active plugins."),
                limit: z
                    .number()
                    .int()
                    .positive()
                    .max(100)
                    .optional()
                    .default(20)
                    .describe("Maximum entities to return (default 20, max 100, nearest first)"),
                filters: z
                    .record(z.string(), filterValueSchema)
                    .optional()
                    .describe("Optional property filters applied to candidate entities"),
            },
        },
        async (input) => {
            try {
                const result = await findNearbyEntities({
                    lat: input.lat,
                    lon: input.lon,
                    originPluginId: input.originPluginId,
                    originEntityId: input.originEntityId,
                    radiusKm: input.radiusKm,
                    targetPluginIds: input.targetPluginIds,
                    limit: input.limit,
                    filters: input.filters,
                });
                return textResult(result);
            } catch (err) {
                console.error("[proximityTools] find_nearby_entities failed:", err);
                return textResult({
                    success: false,
                    entities: [],
                    count: 0,
                    error: "Proximity search failed",
                });
            }
        },
    );
}