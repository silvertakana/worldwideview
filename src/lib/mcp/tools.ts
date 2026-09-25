/**
 * MCP Data Query Tool registrar (v2 AX overhaul, 2026-09-25).
 *
 * v1 registered four tools here (search_entities, get_entities_in_region,
 * get_entity_details, get_plugin_data) and a fifth finder lived in a separate
 * registrar. Five overlapping ways to "find entities", none of which named
 * another or said when to prefer it: an agent guessed, guessed wrong, retried.
 * v2 registers exactly three, with one finder:
 *
 *   query_entities     -- bbox | near | query, multi-layer, projected  (routes via ./entityQuery.ts)
 *   get_entity_details -- one entity by id, projected
 *   get_plugin_data    -- one whole layer snapshot, projected, cap 200
 *
 * search_entities, get_entities_in_region and find_nearby_entities are DELETED,
 * not aliased. That is a deliberate v2 break.
 *
 * Envelope discipline (./responseEnvelope.ts, frozen): success -> mcpOk,
 * empty -> mcpEmpty + resolveEmptyReason, throw -> mcpCatch. Nothing here can
 * return a bare { error } or { success: false }, and a source that states no
 * empty reason resolves to "unknown" -- NEVER to no_data_matches, so an outage
 * can never be reported as an empty result.
 *
 * These tools are server-side and never consult a browser session, so
 * no_session_active is structurally impossible here (the v1 TOOL-01 invariant).
 *
 * Tool definitions live in ./dataQueryToolSchemas.ts and the query routing in
 * ./entityQuery.ts, to keep every file inside the repo's ~300-line limit.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";
import { getEntityDetails, getPluginData } from "@/lib/data-query/service";
import type { EmptyReason } from "@/lib/data-query/types";
import { runQueryEntities } from "@/lib/mcp/entityQuery";
import { clampLimit } from "@/lib/mcp/entityResponse";
import { applyFields } from "@/lib/mcp/fieldProjection";
import { engineOutageFailure, escalateEngineOutage } from "@/lib/mcp/outageResponse";
import {
    mcpCatch,
    mcpEmpty,
    mcpFail,
    mcpOk,
    resolveEmptyReason,
    unknownPluginError,
    type McpMeta,
    type McpTextResult,
} from "@/lib/mcp/responseEnvelope";
import {
    GET_ENTITY_DETAILS_TOOL,
    GET_PLUGIN_DATA_TOOL,
    QUERY_ENTITIES_TOOL,
} from "./dataQueryToolSchemas";

/** Hard cap on entities returned by get_plugin_data (v1's cap, kept). */
const GET_PLUGIN_DATA_CAP = 200;

// Outage wording + detection live in ./outageResponse.ts so every data tool
// says it the same way. The vocabulary is read on the EMPTY path only, so a
// successful lookup never pays for a full plugin sweep.

/**
 * Empty path shared by the two id-addressed tools.
 *
 * The layer vocabulary is read ONLY here, on the failure path, so a successful
 * lookup never pays for a full plugin sweep. Three outcomes are told apart,
 * which is the point of the v2 envelope:
 *   engine unreachable -> an outage, returned as a FAILURE;
 *   unknown pluginId   -> the caller's vocabulary was wrong, failure + validValues;
 *   anything else      -> an honest empty success carrying the service's reason.
 */
async function emptyLookupResult(
    pluginId: string,
    serviceReason: EmptyReason | undefined,
    data: Record<string, unknown>,
    meta: McpMeta = {},
): Promise<McpTextResult> {
    const vocabulary = await listStreamingPlugins();
    if (vocabulary.reason === "engine_unreachable") {
        return engineOutageFailure(`The data engine is unreachable, so layer "${pluginId}" could not be read.`);
    }

    const validPlugins = vocabulary.plugins.map((plugin) => plugin.pluginId);
    if (!validPlugins.includes(pluginId)) {
        return unknownPluginError(pluginId, validPlugins);
    }
    return mcpEmpty(data, resolveEmptyReason(serviceReason), meta);
}

export function registerDataQueryTools(server: McpServer, _ctx: { userId: string }): void {
    server.registerTool("query_entities", QUERY_ENTITIES_TOOL, async (input) => {
        try {
            return await escalateEngineOutage(
                await runQueryEntities(input),
                "The data engine is unreachable, so this query could not run.",
            );
        } catch (err) {
            return mcpCatch("internal_error", "query_entities failed", err, {
                hint: "Retry once; if it fails again the data source is unhealthy. Call orient to check engine and plugin health.",
            });
        }
    });

    server.registerTool("get_entity_details", GET_ENTITY_DETAILS_TOOL, async (input) => {
        try {
            const result = await getEntityDetails(input.pluginId, input.entityId);
            if (result.data === null) {
                return await emptyLookupResult(input.pluginId, result.emptyReason, { entity: null });
            }

            const projected = applyFields([{ ...result.data }], input.fields);
            return mcpOk(
                { entity: projected.items[0] },
                {
                    count: 1,
                    ...(projected.unknownFields.length > 0 && { unknownFields: projected.unknownFields }),
                },
            );
        } catch (err) {
            return mcpCatch("internal_error", "get_entity_details failed", err, {
                hint: "Check that pluginId and entityId are exactly as returned by query_entities, then retry once.",
            });
        }
    });

    server.registerTool("get_plugin_data", GET_PLUGIN_DATA_TOOL, async (input) => {
        try {
            const result = await getPluginData(input.pluginId);
            const snapshot = result.data;

            if (snapshot === null) {
                return await emptyLookupResult(input.pluginId, result.emptyReason, {
                    pluginId: input.pluginId,
                    entities: [],
                });
            }

            const capturedAt = snapshot.timestamp.toISOString();
            const limit = clampLimit(input.limit, GET_PLUGIN_DATA_CAP);

            if (snapshot.entities.length === 0) {
                return await emptyLookupResult(
                    input.pluginId,
                    result.emptyReason,
                    { pluginId: input.pluginId, entities: [] },
                    { capturedAt },
                );
            }

            const truncated = snapshot.entities.length > limit;
            const page = truncated ? snapshot.entities.slice(0, limit) : snapshot.entities;
            const projected = applyFields(page.map((entity) => ({ ...entity })), input.fields);

            return mcpOk(
                { pluginId: input.pluginId, entities: projected.items },
                {
                    count: projected.items.length,
                    capturedAt,
                    ...(truncated && { truncated: true, totalMatched: snapshot.entities.length }),
                    ...(projected.unknownFields.length > 0 && { unknownFields: projected.unknownFields }),
                },
            );
        } catch (err) {
            return mcpCatch("internal_error", "get_plugin_data failed", err, {
                hint: "Verify the pluginId with tools/list or orient, then retry once.",
            });
        }
    });
}
