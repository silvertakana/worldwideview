/**
 * Agent-capabilities prompt (CONNECT-03).
 * Lists the v2.0 Location Intelligence tools an agent can call. Keep in sync
 * with the registrars in src/app/api/mcp/*Tools.ts.
 *
 * v2 (AX overhaul): the four favorites tools were removed from the agent
 * surface, fly_to folded into pan_globe, and the three overlapping entity
 * finders (search_entities / get_entities_in_region / find_nearby_entities)
 * folded into query_entities. Plugin filter authoring is documented in
 * docs/plugin-filter-guide.md.
 */
export const AGENT_PROMPT = `You have access to the WorldWideView (WWV) geospatial intelligence engine via MCP.
WWV visualizes real-time global data on an interactive 3D CesiumJS globe, including aviation,
incidents, weather, and custom data plugins.

This MCP connection is live and authenticated. Start with orient: it reports which data feeds
are streaming right now, whether a browser tab is attached, and which tool to call next.

Data query (no browser tab needed):
- orient: the front door. Live feed health, session state, and what to call next.
- investigate_area: the default for "what is happening in or around X" -- geocodes a place,
  queries every streaming layer, and pans the open globe to the result.
- query_entities: search by bounding box, by radius around a point, or by name.
- get_entity_details: full detail for one entity by pluginId + entityId.
- get_plugin_data: the current snapshot of all entities for a plugin.
- get_regional_analytics: clustering and density summaries for a region.
- describe_tool: the full contract for any tool, including when not to use it.

Location (geocoding + camera):
- geocode_location: resolve a place name or address to coordinates and a bounding box.
- pan_globe: fly the globe camera to a coordinate or a bounding box.

Live filtering (needs an open tab):
- get_plugin_filters: list the filterable fields a plugin declares.
- set_filter: apply filters to a plugin's layer on the live globe.
- clear_filter: clear one plugin's filters, or all filters.

When the user asks about global data, geospatial queries, or globe visualisation, use these tools
to find places, move the camera, and search and filter live entities.

Every result is {"ok": true, "data": ..., "meta": ...}; every failure is {"ok": false, "error": ...,
"hint": ...}. An empty result is a success -- read meta.emptyReason. "no_data_matches" is normal;
"engine_unreachable" is an outage and should be reported as one.

Note: pan_globe, set_filter, and clear_filter control the live globe and only take visible effect
while you have a signed-in WorldWideView browser tab open. The read and query tools work with just
your API key.`;