/**
 * Per-tool semantics for the describe_tool MCP tool.
 *
 * WHY THIS FILE EXISTS (AX overhaul, 2026-09-25): the v2 server instructions
 * block was trimmed to the essentials BECAUSE describe_tool now carries the
 * detail. A tool description that only says what a tool does leaves an agent to
 * discover the boundaries by failing; this map states the boundaries up front,
 * including the tool to use INSTEAD when this one is the wrong call.
 *
 * Every tool the server can register has an entry here, and a test asserts that
 * completeness, so a newly registered tool cannot ship undescribed.
 *
 * PURITY: zero imports, no I/O, data only.
 */

export interface ToolGuide {
    /** Situations this tool is the right call for. */
    useWhen: readonly string[];
    /** Situations where it is the WRONG call -- each names the alternative. */
    avoidWhen: readonly string[];
    /** What a successful call returns, in envelope terms. */
    returns: string;
    /** One worked call an agent can copy and adapt. */
    example: string;
}

/** Guide keyed by exact tool name. */
export const toolGuides: Readonly<Record<string, ToolGuide>> = {
    orient: {
        useWhen: [
            "Always, as the FIRST call in a session: it is the front door and needs no parameters.",
            "When a previous call failed or returned empty, to check whether the feed or the engine is the problem.",
            "When you know the question but not which tool answers it -- orient maps intent to tool.",
        ],
        avoidWhen: [
            "Repeatedly in a loop: plugin health changes on the order of seconds, not milliseconds.",
            "As a substitute for describe_tool when you already know which tool you want and need its contract.",
        ],
        returns: "data.feeds (engine reachable, streaming pluginIds, or an unreachable reason), data.session (active count, whether a tab is attached, session ids), data.nextStep (guidance keyed to intent), data.server (name and version).",
        example: "orient({})",
    },
    describe_tool: {
        useWhen: [
            "Before calling a tool you have not used yet in this session.",
            "When a call failed with invalid_parameters and you need the exact constraint.",
            "When you are choosing between two similar tools and need the boundary between them.",
        ],
        avoidWhen: [
            "For live state (feeds, sessions, camera): call orient instead -- describe_tool is static documentation.",
        ],
        returns: "data with name, category, requiresSession, purpose, whenToUse, whenNotToUse, parameters (type and constraint per parameter), returns, and example.",
        example: 'describe_tool({ name: "query_entities" })',
    },
    investigate_area: {
        useWhen: [
            'The user asks what is happening in, near, or around a named place -- this is THE default for that question.',
            "You want one call to geocode, query the matching live layers, and move the open globe to the result.",
            "You do not know which plugin carries the data: entity_type is a substring match across every streaming plugin.",
        ],
        avoidWhen: [
            "You already have coordinates or a bounding box: call query_entities with bbox or near instead of geocoding a name.",
            "You need a specific field projection or a server-side filter: investigate_area takes neither -- use query_entities.",
            "You need aggregates rather than entities: call get_regional_analytics.",
        ],
        returns: "data.entities (a capped list) plus data.summary, a prose answer naming the place, the plugin, the count, and whether the camera moved. meta.count, and meta.truncated + meta.totalMatched when the cap was hit (totalMatched is the sum of per-plugin results before the global cap, so it is a lower bound, not a global total). An empty result is a success with meta.emptyReason.",
        example: 'investigate_area({ place_name: "Auckland", entity_type: "flights", radius_km: 100 })',
    },
    query_entities: {
        useWhen: [
            "You need the raw entity list for a region you define yourself: a bounding box, a radius around a point, or a name/text match.",
            "You need server-side filters, field projection, or an explicit result limit.",
        ],
        avoidWhen: [
            "The user named a place and wants to know what is happening there: call investigate_area, which also pans the globe.",
            "You need counts, distributions, or density rather than entities: call get_regional_analytics.",
            "You already have an entityId: call get_entity_details directly.",
        ],
        returns: "data.entities plus meta.count; meta.truncated and meta.totalMatched when the result was capped, meta.unknownFields when a requested field does not exist on the entity type, and meta.emptyReason when nothing matched.",
        example: 'query_entities({ bbox: { north: -36.7, south: -37.0, east: 175.0, west: 174.5 }, pluginId: "flights", fields: ["status"], limit: 50 })',
    },
    get_entity_details: {
        useWhen: [
            "You have a pluginId and an entityId and need the full record -- typically to answer a follow-up question about one hit.",
        ],
        avoidWhen: [
            "You do not have an entityId yet: find it first with query_entities or investigate_area.",
            "You want the whole layer rather than one row: call get_plugin_data.",
        ],
        returns: "data with the entity's full property set, coordinates, and timestamp; a miss is a failure with error not_found, not an empty success.",
        example: 'get_entity_details({ pluginId: "flights", entityId: "abc123" })',
    },
    get_plugin_data: {
        useWhen: [
            "You want to survey one feed -- what it contains, how many entities, which fields -- rather than search a region.",
        ],
        avoidWhen: [
            "You want a bounded region or a text match: call query_entities, which is cheaper and returns only the relevant rows.",
            "You want aggregates: call get_regional_analytics.",
        ],
        returns: "data.entities for the whole plugin snapshot plus meta.count; meta.truncated when the snapshot was capped, and meta.emptyReason when the plugin is not streaming.",
        example: 'get_plugin_data({ pluginId: "earthquakes" })',
    },
    geocode_location: {
        useWhen: [
            "You need coordinates, a display name, or a bounding box for a place before doing something else with it.",
            "You need to disambiguate a place name: results carry type, country, and importance for ranking.",
        ],
        avoidWhen: [
            "You want the data around the place, not just its coordinates: investigate_area geocodes internally and answers the question in one call.",
            "You want to move the camera to a place you have already geocoded: call pan_globe with the coordinates.",
        ],
        returns: "data is a list of matches sorted by importance, each with lat, lng, name, display_name, type, addresstype, country, bbox [west, south, east, north], and importance. No match at all fails with not_found.",
        example: 'geocode_location({ query: "Auckland", limit: 3 })',
    },
    get_regional_analytics: {
        useWhen: [
            "The question is about how much, how dense, or how distributed -- counts per plugin, a breakdown by a property, or density clusters.",
            "The region is large enough that a raw entity list would be mostly noise.",
        ],
        avoidWhen: [
            "You need the entities themselves: call query_entities, optionally with fields and limit.",
            "You need a named place resolved for you: geocode it or use investigate_area first to get the bounds.",
        ],
        returns: "data with totalCount, per-plugin counts, the optional groupBy breakdown (remainder grouped as 'other' beyond topN), and spatial density clusters -- never a raw entity dump.",
        example: 'get_regional_analytics({ north: 55, south: 50, east: 5, west: -5, groupBy: "type", clusterResolution: 4 })',
    },
    get_plugin_filters: {
        useWhen: [
            "Before set_filter, to learn which filter ids a plugin declares and what value type each one takes.",
        ],
        avoidWhen: [
            "No browser tab is open: the definitions are published by the browser, so the call can only report available:false. Call orient to check for a tab first.",
            "You want to filter a server-side query rather than the rendered layer: pass filters to query_entities instead.",
        ],
        returns: "data.filters is the list of FilterDefinition { id, label, type (text|select|range|boolean), propertyKey, options?, range? }. data.available is false with reason 'no_session_active' when no tab is open, or 'plugin not loaded' when the plugin has not published a catalog.",
        example: 'get_plugin_filters({ pluginId: "flights" })',
    },
    set_filter: {
        useWhen: [
            "The user wants to narrow what the live globe is SHOWING, in place, without reloading the page.",
        ],
        avoidWhen: [
            "You want to narrow a query result: pass filters to query_entities -- it works with no tab attached.",
            "You have not read the plugin's filter ids yet: call get_plugin_filters first, or the call will be a guess.",
        ],
        returns: "data confirming the enqueue (plugin, filter count, session). An unrecognized pluginId still enqueues but is reported as possibly ignored. Without a live tab it fails with error no_active_session and nothing changes.",
        example: 'set_filter({ pluginId: "flights", filters: { status: { type: "select", values: ["airborne"] } } })',
    },
    clear_filter: {
        useWhen: [
            "The user wants the globe back to its unfiltered state, for one plugin or for everything.",
        ],
        avoidWhen: [
            "You want to change one filter's value: call set_filter; clearing and re-setting is two live-globe round trips instead of one.",
        ],
        returns: "data confirming the enqueue for a plugin, or for ALL plugins when pluginId is omitted. Without a live tab it fails with error no_active_session and nothing changes.",
        example: 'clear_filter({ pluginId: "flights" })',
    },
    pan_globe: {
        useWhen: [
            "You need to move the camera: to a coordinate, or to fit a region when you have bounds.",
            "The user asks to show, fly to, or look at somewhere.",
        ],
        avoidWhen: [
            "No tab is attached: this is a command tool and fails with no_active_session. With no tab, answer with data tools instead of trying to move a camera nobody is watching.",
            "You want the camera on one entity: call focus_entity, which also opens its detail card.",
        ],
        returns: "data with the command enqueued (command type, sessionId, and the resolved coordinates or bbox). It confirms the enqueue, not that the browser finished animating.",
        example: "pan_globe({ lat: 48.8566, lon: 2.3522, alt: 500000 })",
    },
    focus_entity: {
        useWhen: [
            "You want the camera on a specific entity AND its detail card open in the UI.",
        ],
        avoidWhen: [
            "You only have coordinates: call pan_globe.",
            "You do not know where the entity is and have no pluginId to resolve it with: find it with query_entities first, or pass lat/lon.",
        ],
        returns: "data with the command enqueued and the coordinates it resolved. An entityId that cannot be resolved to coordinates fails with error not_found rather than enqueuing a command the browser cannot execute. Without a tab: error no_active_session.",
        example: 'focus_entity({ entityId: "ship-123", pluginId: "ais" })',
    },
    toggle_layer: {
        useWhen: [
            "The user wants a data layer shown or hidden on the live globe.",
        ],
        avoidWhen: [
            "You want to filter a layer's contents rather than hide it: call set_filter.",
            "You want the layer's data server-side: call query_entities or get_plugin_data -- those read the feed regardless of whether the layer is visible.",
        ],
        returns: "data confirming the enqueue (command, sessionId, layerId). An unrecognized layerId fails with error unknown_plugin plus validValues. Omit enabled to flip the current state. Without a tab: error no_active_session.",
        example: 'toggle_layer({ layerId: "earthquakes", enabled: true })',
    },
    set_timeline: {
        useWhen: [
            "The user asks about a time range, a moment in the past, or wants playback started or paused.",
        ],
        avoidWhen: [
            "The question is about right now and needs no time control -- most queries do not need this.",
            "You want to change what data exists rather than what is displayed: the timeline scopes the view, it does not re-query the feeds.",
        ],
        returns: "data confirming the enqueue (command, sessionId, and whichever of currentTime, timeWindow, isPlaybackMode were set). timeWindow must be one of '1h', '6h', '24h', '48h', '7d'. Without a tab: error no_active_session.",
        example: 'set_timeline({ timeWindow: "24h", isPlaybackMode: true })',
    },
    // -- legacy handlers (still registered, superseded by orient) ----------
    list_available_plugins: {
        useWhen: [
            "Only when a caller or script specifically asks for the pre-v2 shape. Prefer orient, which reports the same feed health plus session state and next-step guidance.",
        ],
        avoidWhen: [
            "In any new work: call orient instead.",
        ],
        returns: "data.plugins, each with pluginId, pluginName, entityCount, entityTypes, and source ('engine' or 'local'). Empty is a success carrying meta.emptyReason, which separates engine_unreachable (an outage) from plugin_not_streaming (the engine is up, nothing is streaming).",
        example: "list_available_plugins({})",
    },
    get_globe_context: {
        useWhen: [
            "Only when a caller or script specifically asks for the pre-v2 shape. Prefer orient, which reports session state and feed health together.",
        ],
        avoidWhen: [
            "In any new work: call orient instead.",
        ],
        returns: "data with sessionCount, camera (lat, lon, altitude, heading, pitch or null), layers, filter definitions, and the streaming plugin list. Applied filter VALUES are browser-side and never server-tracked. Empty is a success carrying meta.emptyReason.",
        example: "get_globe_context({})",
    },
};
