/**
 * @file regionalAnalyticsTools.ts
 * @description MCP Tool registrar for regional spatial analytics and density clustering (Gap 2 / Tier 2).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { latSchema, lonSchema } from "@/lib/mcp/coordinateSchemas";
import { getRegionalAnalytics } from "@/lib/mcp/regionalAnalyticsService";

export function registerRegionalAnalyticsTools(
    server: McpServer,
    _ctx: { userId: string },
): void {
    server.registerTool(
        "get_regional_analytics",
        {
            description:
                "Compute aggregated geospatial statistics, category/type distributions, and density clusters within a bounding box. " +
                "Returns totalCount, per-plugin entity counts, optional property breakdown (groupBy), and spatial density clusters without dumping raw entity lists. " +
                "This is a READ-ONLY data tool -- it does not require an active browser session. " +
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

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify({
                                success: true,
                                ...result,
                            }),
                        },
                    ],
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to compute regional analytics";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify({ error: message }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );
}
