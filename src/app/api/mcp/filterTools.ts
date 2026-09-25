/**
 * MCP Filter Tool registrar (Phase 23 Wave 2 -- 23-02).
 *
 * Registers three MCP tools that let an AI agent filter the live globe:
 *
 *   set_filter          -- push filter values to a plugin layer (FILT-01)
 *   clear_filter        -- clear one plugin's filters, or all filters (FILT-02)
 *   get_plugin_filters  -- read a plugin's declared filterable fields (FILT-03)
 *
 * set_filter / clear_filter enqueue a GlobeCommand via enqueueGlobeCommand; the
 * browser drains the queue over the SSE bridge and applies them to filterSlice.
 * get_plugin_filters reads the browser-published session catalog (D-05).
 *
 * Security: userId comes ONLY from ctx (the verified auth result). It is never
 * read from tool arguments. sessionId may come from args (scopes the tab) or is
 * resolved from the user's active ZSET entry.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { enqueueGlobeCommand, resolveActiveSessionId } from "@/lib/globeCommandQueue";
import { readSessionCatalog } from "@/lib/mcpSessionCatalog";
import { filterValueSchema } from "@/lib/mcp/filterSchemas";
import type { GlobeCommand } from "@/core/globe/types/GlobeCommand";
import { pluginIdSchema } from "@/lib/mcp/identifierSchemas";
import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";
import { mcpCatch, mcpFail, mcpOk } from "@/lib/mcp/responseEnvelope";
import { noActiveSessionResult } from "@/app/api/mcp/globeCommandTools";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const SESSION_ID_DESCRIPTION =
    "Target globe session id; omit for your most-recently-active tab.";

const ENQUEUE_HINT =
    "The command could not be enqueued. Retry, and check that Redis is reachable if it keeps failing.";

/**
 * Resolves the session to use: explicit arg takes precedence, falling back to
 * the most-recently-active session for this user. Returns null if none is live.
 */
async function resolveSession(
    userId: string,
    argSessionId: string | undefined,
): Promise<string | null> {
    if (argSessionId !== undefined && argSessionId !== "") return argSessionId;
    return resolveActiveSessionId(userId);
}

/** The plugin ids this server knows about: the validity set and validValues. */
async function knownPluginIds(): Promise<string[]> {
    const { plugins } = await listStreamingPlugins();
    return plugins.map((p) => p.pluginId);
}

// ---------------------------------------------------------------------------
// Public registrar
// ---------------------------------------------------------------------------

export function registerFilterTools(
    server: McpServer,
    ctx: { userId: string },
): void {
    const { userId } = ctx;

    // TOOL: set_filter (FILT-01)
    server.registerTool(
        "set_filter",
        {
            description:
                "Apply one or more filters to a plugin's live globe layer (no page reload). " +
                "Use after get_plugin_filters to discover valid filter ids; affects the live globe layer, not the data-query tools. " +
                "Requires an active globe session (globe://sessions); without a live tab this fails with error no_active_session. " +
                "Limits: filter ids are plugin-specific; an unrecognized pluginId fails with error unknown_plugin plus validValues. " +
                "Parameters: pluginId (string, required); filters (object, required) -- filterId -> { type: 'text', value } | { type: 'select', values } | { type: 'range', min, max } | { type: 'boolean', value }; sessionId (optional). " +
                "Example: set_filter({ pluginId: 'flights', filters: { status: { type: 'select', values: ['airborne'] } } }).",
            inputSchema: {
                pluginId: pluginIdSchema.describe("Plugin whose layer to filter, e.g. 'flights'"),
                filters: z
                    .record(z.string(), filterValueSchema)
                    .describe("Map of filterId -> filter value. Discover valid filter ids via get_plugin_filters."),
                sessionId: z.string().optional().describe(SESSION_ID_DESCRIPTION),
            },
        },
        async (args) => {
            try {
                const sessionId = await resolveSession(userId, args.sessionId);
                if (sessionId === null) return await noActiveSessionResult(userId);

                // Validate the pluginId against the plugins this server knows about.
                const validPluginIds = await knownPluginIds();
                if (validPluginIds.length > 0 && !validPluginIds.includes(args.pluginId)) {
                    return mcpFail("unknown_plugin", `Unknown pluginId "${args.pluginId}".`, {
                        hint: "Retry with one of validValues. Call list_available_plugins to see which plugins are live.",
                        validValues: validPluginIds,
                    });
                }

                const cmd: GlobeCommand = {
                    type: "setFilter",
                    pluginId: args.pluginId,
                    filters: args.filters,
                };
                await enqueueGlobeCommand(userId, sessionId, cmd);
                return mcpOk({
                    command: cmd.type,
                    sessionId,
                    pluginId: args.pluginId,
                    filterCount: Object.keys(args.filters).length,
                });
            } catch (err) {
                return mcpCatch("internal_error", "set_filter command failed.", err, { hint: ENQUEUE_HINT });
            }
        },
    );

    // TOOL: clear_filter (FILT-02)
    server.registerTool(
        "clear_filter",
        {
            description:
                "Clear active filters on the live globe. Omit pluginId to clear ALL filters across every plugin at once. " +
                "Use when the user wants to reset the view rather than re-set filters to empty values. " +
                "Requires an active globe session (globe://sessions); without a live tab this fails with error no_active_session. " +
                "Limits: clears only the targeted tab's live filter state; nothing is persisted. " +
                "Parameters: pluginId (string, optional) -- omit to clear all plugins; sessionId (optional). " +
                "Example: clear_filter({ pluginId: 'flights' }) or clear_filter({}).",
            inputSchema: {
                pluginId: pluginIdSchema.optional().describe("Plugin whose filters to clear. Omit to clear ALL filters on the globe."),
                sessionId: z.string().optional().describe(SESSION_ID_DESCRIPTION),
            },
        },
        async (args) => {
            try {
                const sessionId = await resolveSession(userId, args.sessionId);
                if (sessionId === null) return await noActiveSessionResult(userId);

                const cmd: GlobeCommand = {
                    type: "clearFilter",
                    ...(args.pluginId !== undefined && { pluginId: args.pluginId }),
                };
                await enqueueGlobeCommand(userId, sessionId, cmd);
                return mcpOk({
                    command: cmd.type,
                    sessionId,
                    cleared: args.pluginId ?? "all",
                });
            } catch (err) {
                return mcpCatch("internal_error", "clear_filter command failed.", err, { hint: ENQUEUE_HINT });
            }
        },
    );

    // TOOL: get_plugin_filters (FILT-03)
    server.registerTool(
        "get_plugin_filters",
        {
            description:
                "Read-only discovery: list the filterable fields a plugin has declared, so you can build a valid set_filter call. " +
                "Use before set_filter to confirm filter ids and value types for a plugin. " +
                "Limits: needs an active globe session (globe://sessions) because the catalog is browser-published; without a live tab this fails with error no_active_session. " +
                "Parameters: pluginId (string, required) -- the plugin to inspect. " +
                "Output: { ok: true, data: { pluginId, available: true, filters: FilterDefinition[] } } where each FilterDefinition is { id, label, type: 'text'|'select'|'range'|'boolean', propertyKey, options?, range? }; when the plugin has published no catalog entry, data.available is false with a reason. " +
                "Example: get_plugin_filters({ pluginId: 'flights' }) -> data: { available: true, filters: [{ id: 'status', label: 'Status', type: 'select', options: [...] }] }.",
            inputSchema: {
                pluginId: pluginIdSchema.describe("Plugin to inspect for declared filterable fields"),
            },
        },
        async (args) => {
            try {
                const sessionId = await resolveActiveSessionId(userId);
                if (!sessionId) return await noActiveSessionResult(userId);

                const catalog = await readSessionCatalog(userId, sessionId);
                const filterDefs = catalog?.filterDefinitions;
                if (!filterDefs || !(args.pluginId in filterDefs)) {
                    return mcpOk({
                        pluginId: args.pluginId,
                        available: false,
                        reason: "plugin_catalog_not_published",
                    });
                }
                return mcpOk({
                    pluginId: args.pluginId,
                    available: true,
                    filters: filterDefs[args.pluginId],
                });
            } catch (err) {
                return mcpCatch("internal_error", "get_plugin_filters failed.", err, {
                    hint: "The browser-published session catalog could not be read. Retry, and confirm the globe tab is still open.",
                });
            }
        },
    );
}
