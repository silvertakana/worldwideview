/**
 * MCP discovery registrar (Phase 29 -- 29-01; v2 AX overhaul, 2026-09-25).
 *
 * Registers five tools:
 *   orient                  -- THE FRONT DOOR: feed health, session state, what to call next
 *   describe_tool           -- full semantics for any tool; carries the detail the v2
 *                              server instructions block deliberately no longer restates
 *   investigate_area        -- the default for "what is happening in or around X"
 *   list_available_plugins  -- LEGACY, superseded by orient
 *   get_globe_context       -- LEGACY, superseded by orient
 *
 * Descriptions live in ./discoveryToolDescriptions so this file stays a thin
 * wiring layer. Every handler answers in the v2 envelope: one `ok` field to
 * branch on, an EMPTY result carrying a reason instead of being flattened into
 * "no data", and vocabulary failures returning the valid values.
 *
 * Security: userId comes ONLY from ctx (the verified auth result), never from
 * tool args. place_name is passed exclusively via URLSearchParams inside
 * fetchGeocode -- never concatenated into a URL. entity_type is matched only
 * against the in-memory streaming plugin set, never embedded in an engine URL
 * (T-29-01, T-29-02, T-29-03).
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getEntitiesInRegion } from "@/lib/data-query/service";
import type { EmptyReason } from "@/lib/data-query/types";
import { fetchGeocode, normalizeNominatimResult } from "@/lib/nominatim";
import { enqueueGlobeCommand } from "@/lib/globeCommandQueue";
import type { GlobeCommand } from "@/core/globe/types/GlobeCommand";
import { MCP_SERVER_VERSION } from "@/lib/mcp/server";
import {
    mcpCatch,
    mcpEmpty,
    mcpFail,
    mcpOk,
    resolveEmptyReason,
} from "@/lib/mcp/responseEnvelope";
import { allKnownToolNames, findTool } from "@/lib/mcp/toolCatalog";
import { toolGuides } from "@/lib/mcp/toolDetails";
import {
    buildInvestigateProse,
    composeGlobeContext,
    listStreamingPlugins,
    radiusKmToBbox,
    resolveActiveSessionId,
} from "./discoveryHelpers";
import { escalateWithVocabulary } from "@/lib/mcp/outageResponse";
import { NO_ACTIVE_PLUGINS_HINT, composeOrient, mapEngineReason } from "./orientHelpers";
import {
    DESCRIBE_TOOL_DESCRIPTION,
    GLOBE_CONTEXT_DESCRIPTION,
    INVESTIGATE_AREA_DESCRIPTION,
    LIST_AVAILABLE_PLUGINS_DESCRIPTION,
    ORIENT_DESCRIPTION,
} from "./discoveryToolDescriptions";

/** Default investigation radius when the caller does not specify one. */
const DEFAULT_RADIUS_KM = 50;

/** Altitude (metres) used for camera pan commands from investigate_area. */
const INVESTIGATE_PAN_ALT = 300_000;

/** Maximum total entities returned across all plugins by investigate_area (TOOL-04). */
const INVESTIGATE_AREA_CAP = 200;

/** Shared trailing note for the two legacy tools. */
const LEGACY_NOTE = "This tool is kept for backward compatibility; call orient instead, which reports feed health, session state, and next-step guidance together.";

export function registerDiscoveryTools(
    server: McpServer,
    ctx: { userId: string },
): void {
    const { userId } = ctx;

    // ------------------------------------------------------------------
    // orient -- the front door
    // ------------------------------------------------------------------
    server.registerTool(
        "orient",
        { description: ORIENT_DESCRIPTION, inputSchema: {} },
        async () => {
            try {
                const { payload, emptyReason } = await composeOrient(userId, MCP_SERVER_VERSION);
                if (emptyReason === undefined) return mcpOk(payload, { count: payload.feeds.count });
                return mcpEmpty(payload, emptyReason, {
                    count: 0,
                    ...(emptyReason === "plugin_not_streaming" && { hint: NO_ACTIVE_PLUGINS_HINT }),
                });
            } catch (err) {
                return mcpCatch("internal_error", "orient could not read the server state.", err, {
                    hint: "Retry shortly. If it keeps failing, the engine or the session store is degraded.",
                });
            }
        },
    );

    // ------------------------------------------------------------------
    // describe_tool -- the detail the trimmed instructions block dropped
    // ------------------------------------------------------------------
    server.registerTool(
        "describe_tool",
        {
            description: DESCRIBE_TOOL_DESCRIPTION,
            inputSchema: {
                name: z.string().min(1).describe("Exact tool name, e.g. 'investigate_area' or 'query_entities'"),
            },
        },
        async (args) => {
            const entry = findTool(args.name);
            const guide = toolGuides[args.name];
            if (entry === undefined || guide === undefined) {
                return mcpFail("not_found", "describe_tool does not know the tool " + args.name + ".", {
                    hint: "Retry with one of validValues. Call orient to see the whole surface this server exposes.",
                    validValues: allKnownToolNames(),
                });
            }
            return mcpOk({
                name: entry.name,
                category: entry.category,
                requiresSession: entry.requiresSession,
                purpose: entry.purpose,
                whenToUse: guide.useWhen,
                whenNotToUse: guide.avoidWhen,
                parameters: entry.parameters,
                returns: guide.returns,
                example: guide.example,
                ...(entry.sessionNote !== undefined && { sessionNote: entry.sessionNote }),
            });
        },
    );

    // ------------------------------------------------------------------
    // TOOL-01 (legacy): list_available_plugins
    // ------------------------------------------------------------------
    server.registerTool(
        "list_available_plugins",
        { description: LIST_AVAILABLE_PLUGINS_DESCRIPTION, inputSchema: {} },
        async () => {
            try {
                const { plugins, reason } = await listStreamingPlugins();
                if (plugins.length === 0) {
                    const emptyReason = mapEngineReason(reason);
                    return mcpEmpty({ plugins: [] }, emptyReason, {
                        count: 0,
                        ...(emptyReason === "plugin_not_streaming" && { hint: NO_ACTIVE_PLUGINS_HINT }),
                    });
                }
                return mcpOk({ plugins }, { count: plugins.length });
            } catch (err) {
                return mcpCatch("engine_unreachable", "Could not read the streaming plugin list.", err, {
                    hint: "The data engine may be unreachable. Retry shortly. " + LEGACY_NOTE,
                });
            }
        },
    );

    // ------------------------------------------------------------------
    // TOOL-02 (legacy): get_globe_context
    // ------------------------------------------------------------------
    server.registerTool(
        "get_globe_context",
        { description: GLOBE_CONTEXT_DESCRIPTION, inputSchema: {} },
        async () => {
            try {
                const { plugins, reason, ...context } = await composeGlobeContext(userId);
                const data = { ...context, plugins };
                if (plugins.length === 0) {
                    const emptyReason = mapEngineReason(reason);
                    return mcpEmpty(data, emptyReason, {
                        count: 0,
                        ...(emptyReason === "plugin_not_streaming" && { hint: NO_ACTIVE_PLUGINS_HINT }),
                    });
                }
                return mcpOk(data, { count: plugins.length });
            } catch (err) {
                return mcpCatch("engine_unreachable", "Could not read the globe context.", err, {
                    hint: "The engine or the session store may be unreachable. Retry shortly. " + LEGACY_NOTE,
                });
            }
        },
    );

    // ------------------------------------------------------------------
    // TOOL-03: investigate_area -- the default question answerer
    // ------------------------------------------------------------------
    server.registerTool(
        "investigate_area",
        {
            description: INVESTIGATE_AREA_DESCRIPTION,
            inputSchema: {
                place_name: z.string().min(1).describe("Place name to geocode (free-text, e.g. 'Auckland', 'Tokyo Bay')"),
                entity_type: z.string().min(1).describe("Entity type to look for -- case-insensitive substring matched against streaming plugin ids/names"),
                radius_km: z.number().positive().optional().describe("Search radius in kilometres around the geocoded centre (default 50)"),
            },
        },
        async (args) => {
            const { place_name, entity_type, radius_km } = args;
            const radius = radius_km ?? DEFAULT_RADIUS_KM;

            try {
                // Step 1: geocode the place name (single best match).
                const rawItems = await fetchGeocode({ query: place_name, limit: 1 });
                if (rawItems.length === 0) {
                    return mcpFail("not_found", "Could not geocode " + place_name + ".", {
                        hint: "Retry with a more specific or differently spelled place name, or call geocode_location to see candidate matches.",
                        details: { place_name },
                    });
                }
                const geo = normalizeNominatimResult(rawItems[0]);

                // Step 2: match streaming plugins by case-insensitive substring.
                // The whole vocabulary is kept, not just the plugin list: its reason
                // is what tells an outage apart from "these layers are simply not
                // streaming" when nothing matches below.
                const vocabulary = await listStreamingPlugins();
                const { plugins } = vocabulary;
                const lower = entity_type.toLowerCase();
                const matched = plugins.filter(
                    (p) =>
                        p.pluginId.toLowerCase().includes(lower) ||
                        p.pluginName.toLowerCase().includes(lower),
                );

                if (matched.length === 0) {
                    return escalateWithVocabulary(
                        mcpEmpty(
                            {
                                entities: [],
                                availablePlugins: plugins.map((p) => p.pluginId),
                                summary: buildInvestigateProse({
                                    displayName: geo.display_name,
                                    entityType: entity_type,
                                    matchedPlugin: null,
                                    entityCount: 0,
                                    sessionPresent: false,
                                }),
                            },
                            "plugin_not_streaming",
                            {
                                count: 0,
                                hint:
                                    "No streaming plugin matches entity_type " + entity_type + ". Call orient to see which layers are live, then retry with one of data.availablePlugins.",
                            },
                        ),
                        "The data engine is unreachable, so nothing could be scanned around " + place_name + ".",
                        vocabulary,
                    );
                }

                // Step 3: query every matched plugin inside the radius bbox.
                const bbox = radiusKmToBbox(geo.lat, geo.lng, radius);
                type SearchResult = { id: string; pluginId: string; name?: string; latitude: number; longitude: number };
                const allEntities: SearchResult[] = [];
                let lastEmptyReason: EmptyReason | undefined;
                for (const plugin of matched) {
                    const result = await getEntitiesInRegion({ ...bbox, pluginId: plugin.pluginId });
                    allEntities.push(...result.entities);
                    if (result.emptyReason) lastEmptyReason = result.emptyReason;
                }

                // Step 4: pan the camera when a tab is live. Its absence is NOT a
                // failure: the entities are the answer, the pan is a bonus.
                const sessionId = await resolveActiveSessionId(userId);
                const sessionPresent = sessionId !== null;
                if (sessionId !== null) {
                    const cmd: GlobeCommand = { type: "pan", lat: geo.lat, lon: geo.lng, alt: INVESTIGATE_PAN_ALT };
                    await enqueueGlobeCommand(userId, sessionId, cmd);
                }

                // Step 5: apply the global cap. totalMatched is the sum of per-plugin
                // results BEFORE the cap -- a lower bound, since each plugin was itself
                // queried with its own entity limit.
                const totalMatched = allEntities.length;
                const truncated = totalMatched > INVESTIGATE_AREA_CAP;
                const entities = truncated ? allEntities.slice(0, INVESTIGATE_AREA_CAP) : allEntities;

                // Step 6: deterministic prose, first match as representative.
                const summary = buildInvestigateProse({
                    displayName: geo.display_name,
                    entityType: entity_type,
                    matchedPlugin: matched[0].pluginId,
                    entityCount: entities.length,
                    sessionPresent,
                    emptyReason: lastEmptyReason,
                });

                if (entities.length === 0) {
                    return mcpEmpty({ entities, summary }, resolveEmptyReason(lastEmptyReason), { count: 0 });
                }

                return mcpOk(
                    { entities, summary },
                    { count: entities.length, ...(truncated && { truncated: true, totalMatched }) },
                );
            } catch (err) {
                return mcpCatch("internal_error", "investigate_area failed for the requested place.", err, {
                    hint: "Retry shortly. Call orient to check whether the engine is healthy before retrying.",
                    details: { place_name, entity_type },
                });
            }
        },
    );
}
