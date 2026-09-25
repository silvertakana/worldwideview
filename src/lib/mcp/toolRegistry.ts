/**
 * @file toolRegistry.ts
 * @description The static MCP tool surface this instance advertises, as data.
 *
 * WHY THIS EXISTS
 * "Connect your agent" used to print a hand-written prompt naming whichever
 * tools someone remembered. It had drifted badly: it described 12 of the 22
 * tools this server registers, and nothing failed when it did. This registry is
 * the one description the generated agent brief is built from, so the panel can
 * only ever name tools the server actually exposes.
 *
 * WHY IT MIRRORS THE REGISTRARS INSTEAD OF READING THEM
 * The live registry is the set of `server.registerTool(...)` calls in
 * src/lib/mcp/tools.ts and src/app/api/mcp/*Tools.ts. Importing those from the
 * panel would pull Prisma and Redis into the browser bundle, so the surface is
 * described here instead -- and toolRegistry.test.ts drives the real registrars
 * against a capturing server and fails on any name that is missing, extra,
 * duplicated, or mis-flagged for session requirement. That test, not this
 * comment, is what keeps the two in step.
 *
 * Adding a tool: register it in its registrar, add it here, then run
 * `pnpm exec vitest run src/lib/mcp/toolRegistry.test.ts`.
 */

/** One tool this server registers, as the connect brief describes it. */
export interface McpToolDescriptor {
    /** Exact tool name, as passed to server.registerTool. */
    readonly name: string;
    /** One-line capability, shown in the generated brief. */
    readonly summary: string;
    /**
     * True when the tool only has a visible effect while a signed-in
     * WorldWideView tab is open. Derived from SESSION_REQUIRED_PREAMBLE in the
     * real description -- see toolRegistry.test.ts.
     */
    readonly requiresSession: boolean;
}

/**
 * Every tool registered on a fresh WorldWideView MCP server, in the order the
 * registrars add them. Plugin tools (`<pluginId>__<toolName>`) are NOT here:
 * they are per-session and published by the browser at runtime.
 */
export const MCP_TOOLS: readonly McpToolDescriptor[] = [
    // -- data query (server-side; the API key is enough) --------------------
    {
        name: "search_entities",
        summary: "search entities by name across active plugins",
        requiresSession: false,
    },
    {
        name: "get_entities_in_region",
        summary: "entities inside a lat/lng bounding box",
        requiresSession: false,
    },
    {
        name: "get_entity_details",
        summary: "full details for one entity",
        requiresSession: false,
    },
    {
        name: "get_plugin_data",
        summary: "current entity snapshot for one plugin",
        requiresSession: false,
    },
    {
        name: "find_nearby_entities",
        summary: "nearest entities around a point or entity, by distance",
        requiresSession: false,
    },
    {
        name: "get_regional_analytics",
        summary: "counts, property breakdowns and density clusters for a box",
        requiresSession: false,
    },
    // -- discovery ----------------------------------------------------------
    {
        name: "list_available_plugins",
        summary: "plugins streaming live data right now, and their status",
        requiresSession: false,
    },
    {
        name: "get_globe_context",
        summary: "sessions, camera, layers and plugins in one call",
        requiresSession: false,
    },
    {
        name: "investigate_area",
        summary: "geocode a place, find its plugin, return what is there",
        requiresSession: false,
    },
    // -- geocoding ----------------------------------------------------------
    {
        name: "geocode_location",
        summary: "resolve a place name or address to coordinates",
        requiresSession: false,
    },
    {
        name: "fly_to",
        summary: "fly the camera to a geocoded place or bounding box",
        requiresSession: true,
    },
    // -- globe control ------------------------------------------------------
    {
        name: "pan_globe",
        summary: "fly the camera to a coordinate",
        requiresSession: true,
    },
    {
        name: "focus_entity",
        summary: "centre the camera on a known entity",
        requiresSession: true,
    },
    {
        name: "toggle_layer",
        summary: "enable or disable a plugin data layer",
        requiresSession: true,
    },
    {
        name: "set_timeline",
        summary: "set playback time, window or mode",
        requiresSession: true,
    },
    // -- live filtering -----------------------------------------------------
    {
        name: "set_filter",
        summary: "apply filters to a plugin's live layer",
        requiresSession: true,
    },
    {
        name: "clear_filter",
        summary: "clear filters on one or on every plugin",
        requiresSession: true,
    },
    {
        name: "get_plugin_filters",
        summary: "the filterable fields a plugin declares",
        requiresSession: false,
    },
    // -- favorites ----------------------------------------------------------
    {
        name: "save_favorite",
        summary: "bookmark an entity",
        requiresSession: false,
    },
    {
        name: "list_favorites",
        summary: "your bookmarks, each with a live or stale status",
        requiresSession: false,
    },
    {
        name: "update_favorite",
        summary: "rename or annotate a bookmark",
        requiresSession: false,
    },
    {
        name: "remove_favorite",
        summary: "delete a bookmark",
        requiresSession: false,
    },
];

/** The registered names, in registry order. */
export function mcpToolNames(tools: readonly McpToolDescriptor[] = MCP_TOOLS): string[] {
    return tools.map((tool) => tool.name);
}

/** The two capability tiers the connect brief reports. */
export interface McpToolGroups {
    /** Tools that answer correctly with the API key alone. */
    readonly keyOnly: readonly McpToolDescriptor[];
    /** Tools whose only visible effect needs a live, signed-in globe tab. */
    readonly sessionRequired: readonly McpToolDescriptor[];
}

/** Splits a tool list into the two tiers, preserving registry order. */
export function groupToolsBySession(
    tools: readonly McpToolDescriptor[] = MCP_TOOLS,
): McpToolGroups {
    return {
        keyOnly: tools.filter((tool) => !tool.requiresSession),
        sessionRequired: tools.filter((tool) => tool.requiresSession),
    };
}
