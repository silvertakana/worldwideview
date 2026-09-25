/**
 * @file regionalAnalyticsTools.ts
 * @description MCP Tool registrar for regional spatial analytics and density clustering (Gap 2 / Tier 2).
 *
 * v2 envelope: success is { ok: true, data }, an empty region is a SUCCESS with
 * meta.emptyReason (+ the hint that explains how to read it), and a throw is a
 * failure envelope. An empty reason the service did not state resolves to
 * "unknown" -- never to no_data_matches.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { latSchema, lonSchema } from "@/lib/mcp/coordinateSchemas";
import { getRegionalAnalytics } from "@/lib/mcp/regionalAnalyticsService";
import { escalateEngineOutage } from "@/lib/mcp/outageResponse";
import {
    mcpCatch,
    mcpEmpty,
    mcpOk,
    resolveEmptyReason,
} from "@/lib/mcp/responseEnvelope";

export function registerRegionalAnalyticsTools(
    server: McpServer,
    _ctx: { userId: string },
): void {
    server.registerTool(
        "get_regional_analytics",
        {
            description:
                "Compute aggregated geospatial statistics, category/type distributions, and density clusters within a bounding box. " +
                "Use this instead of query_entities when you want COUNTS and shape rather than the entities themselves -- it returns totalCount, per-plugin counts, an optional property breakdown (groupBy) and density clusters without dumping raw entity lists. " +
                "This is a READ-ONLY data tool -- it does not require an active browser session. " +
                "On an empty result meta.emptyReason says why: 'plugin_not_streaming' means the layers are not streaming (nothing was countable -- check tools/list or call orient), 'no_data_matches' means they are live and the box is genuinely empty. " +
                "Example: get_regional_analytics({ north: 55, south: 50, east: 5, west: -5, groupBy: 'type', clusterResolution: 4 })",
            inputSchema: {
                north: latSchema.describe("Northern latitude bound (-90 to 90)"),
                south: latSchema.describe("Southern latitude bound (-90 to 90)"),
                east: lonSchema.describe("Eastern longitude bound (-180 to 180)"),
                west: lonSchema.describe("Western longitude bound (-180 to 180)"),
                pluginId: z.string().optional().describe("Restrict analysis to a single plugin (e.g. 'aviation')"),
                pluginIds: z.array(z.string()).optional().describe("Restrict analysis to specific plugin IDs"),
                groupBy: z.string().optional().describe("Entity property or field to group counts by (e.g. 'type', 'status', 'country', 'operator', 'plugin')"),
                clusterResolution: z.number().min(1).max(10).optional().describe("Grid clustering resolution (1 to 10 divisions per axis, default 4)"),
                topN: z.number().min(1).max(50).optional().describe("Maximum top categories returned in groupBy breakdown before grouping remainder into 'other' (default 10)"),
            },
        },
        async (input) => {
            try {
                const result = await getRegionalAnalytics({
                    north: input.north,
                    south: input.south,
                    east: input.east,
                    west: input.west,
                    pluginId: input.pluginId,
                    pluginIds: input.pluginIds,
                    groupBy: input.groupBy,
                    clusterResolution: input.clusterResolution,
                    topN: input.topN,
                });

                // emptyReason belongs in meta, not in the payload.
                const { emptyReason, ...payload } = result;
                if (result.totalCount === 0) {
                    // Nothing countable can mean "these layers are not streaming" or
                    // "the engine is down"; the vocabulary tells them apart.
                    return escalateEngineOutage(
                        mcpEmpty(payload, resolveEmptyReason(emptyReason)),
                        "The data engine is unreachable, so nothing could be counted in this box.",
                    );
                }
                return mcpOk(payload);
            } catch (err) {
                return mcpCatch("internal_error", "get_regional_analytics failed", err, {
                    hint: "Check that north/south/east/west describe a real box (north above south), then retry once.",
                });
            }
        },
    );
}
