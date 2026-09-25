/**
 * Agent-facing descriptions for the five discovery tools.
 *
 * WHY THIS FILE EXISTS: these descriptions are the first text an agent reads,
 * and together they are the longest strings in the MCP server. They live beside
 * the registrar rather than inline so the registrar stays a thin wiring layer
 * (repo convention: ~300 lines per file) and a wording change is one reviewable
 * diff.
 *
 * Each one states what the tool does, when to use it, when NOT to (naming the
 * alternative), what it returns, and one example. orient and describe_tool carry
 * the orientation burden: the v2 server instructions block was trimmed BECAUSE
 * these descriptions are complete.
 */

/** orient -- the front door. */
export const ORIENT_DESCRIPTION =
    "THE FRONT DOOR -- call this FIRST, before any other tool. One call answers three questions: which plugins are streaming live data right now (and whether the engine itself is reachable), whether a browser tab is attached to a globe session, and which tool call fits your intent. " +
    "No parameters, no session required. Use it at the start of a session, after any failure or empty result to tell an outage apart from an empty query, and whenever you know the question but not the tool. " +
    "Do not loop on it: feed health changes on the order of seconds. " +
    "Output: { ok: true, data: { server, feeds: { engine, count, streaming[], hint }, session: { activeCount, tabAttached, attachedSessionId, camera, layers }, nextStep[], workflow[], advertisedToolCount } }. When nothing is streaming the result is STILL ok:true -- read meta.emptyReason: engine_unreachable is an outage, plugin_not_streaming just means the engine is up and idle. " +
    "Example: orient({})";

/** describe_tool -- the detail the trimmed server instructions block dropped. */
export const DESCRIBE_TOOL_DESCRIPTION =
    "The full semantics of ONE tool, by name: purpose, when to use it, when NOT to use it (naming the tool to use instead), every parameter with its type and constraint, the response shape, and one worked example. " +
    "Use it before calling a tool you have not used yet in this session, when a call failed with invalid_parameters, or when choosing between two similar tools. " +
    "Static documentation only -- it reads no live state; call orient for that. " +
    "Parameters: name (required, exact tool name). An unknown name fails with error not_found and validValues listing every tool this server registers. " +
    'Example: describe_tool({name:"query_entities"})';

/** list_available_plugins -- legacy, superseded by orient. */
export const LIST_AVAILABLE_PLUGINS_DESCRIPTION =
    "LEGACY -- prefer orient, which reports the same feed health plus session state and next-step guidance. Lists every plugin currently streaming live data from the engine: pluginId, pluginName, entityCount, and entityTypes (the queryable field names). " +
    "Use it when you specifically need per-plugin entity counts or field names, or to confirm a pluginId is streaming before calling query_entities. " +
    "No parameters required. " +
    "An empty list is a SUCCESS: read meta.emptyReason -- engine_unreachable means the engine is down (an OUTAGE), plugin_not_streaming means the engine is up with nothing streaming. " +
    "Example: list_available_plugins({})";

/** get_globe_context -- legacy, superseded by orient. */
export const GLOBE_CONTEXT_DESCRIPTION =
    "LEGACY -- prefer orient, which reports session state and feed health together. Reads the current globe context in one call: sessionCount, camera viewport, active layers, filter definitions, and the streaming plugin list. " +
    "Use it when you need the camera viewport or layer state of the most-recently-active tab. " +
    "With no browser session it SUCCEEDS with sessionCount:0 and camera:null -- that is not an error. Open the app in a tab to create a session. " +
    "Applied filter VALUES are browser-side and never server-tracked; only the definitions are returned. No parameters required. " +
    "Example: get_globe_context({})";

/** investigate_area -- the default answer to "what is happening in or around X?". */
export const INVESTIGATE_AREA_DESCRIPTION =
    'THE DEFAULT tool for "what is happening in, near, or around X?" -- reach for it whenever the user names a place. It geocodes the place name, finds every streaming plugin matching entity_type, queries the entities inside radius_km of the geocoded centre, and pans the open globe to the area. ' +
    "NO SESSION REQUIRED: with no browser tab attached the data still comes back and the summary states that the camera pan was skipped. " +
    "Use query_entities instead when you already have coordinates or a bounding box, when you need a field projection or server-side filters, or when you need aggregates rather than entities (that is get_regional_analytics). " +
    "Returns { ok: true, data: { entities[], summary }, meta: { count, truncated?, totalMatched? } }. summary is deterministic prose naming the place, the matched plugin, and the count. totalMatched is the sum of per-plugin results before the global 200-entity cap, so treat it as a lower bound, not the true global count. " +
    "When nothing matched, ok is STILL true: read meta.emptyReason -- plugin_not_streaming means no layer matched or none is live, no_data_matches means the layer is live and the region is genuinely empty. " +
    "Parameters: place_name (required, free-text), entity_type (required, case-insensitive substring matched against streaming plugin ids/names), radius_km (optional, > 0, default 50). " +
    'Example: investigate_area({place_name:"Auckland",entity_type:"flights",radius_km:100})';
