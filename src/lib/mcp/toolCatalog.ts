/**
 * MCP v2 tool catalog -- the SINGLE SOURCE OF TRUTH for the agent-facing surface.
 *
 * WHY THIS EXISTS (AX overhaul, 2026-09-25): v1 published no machine-readable
 * discovery surface at all -- no server card, no llms.txt, no way to learn the
 * vocabulary except by reading one 2,900-character instructions block. The
 * audit's top finding was that WWV is "a server you must already know about".
 *
 * /llms.txt, /.well-known/mcp/server-card.json, orient, and describe_tool are
 * all generated from THIS module, so a published description drifting from the
 * registrar is impossible rather than merely discouraged. The registered surface
 * lives in the registrars (src/app/api/mcp/*Tools.ts, src/lib/mcp/tools.ts).
 *
 * PURITY: zero imports, no I/O -- data only, so routes, handlers, and tests
 * import it for free.
 */

/** How the surface is grouped for a caller deciding what to reach for. */
export type ToolCategory = "discovery" | "data" | "cockpit" | "filter";

export interface CatalogTool {
    /** Exact registered MCP tool name. */
    name: string;
    category: ToolCategory;
    /** True when the tool needs a live globe tab: it enqueues a browser command
     * or reads browser-published state, so it has no effect (or no data) without one. */
    requiresSession: boolean;
    /** One line, agent-facing: what this tool is for. */
    purpose: string;
    /** Key parameters: name -> type and constraint. */
    parameters: Readonly<Record<string, string>>;
    /** How a session-dependent tool behaves with no tab attached. */
    sessionNote?: string;
}

/**
 * The v2.0 agent-facing surface: 15 tools in four categories.
 *
 * Session rule: only the cockpit tools and the live-filter tools need an open
 * browser tab showing the globe. Everything else runs server-side against the
 * data engine with nothing but the API key, which matters because an agent with
 * no tab attached must still be able to do useful work.
 */
export const catalog: readonly CatalogTool[] = [
    // -- discovery ---------------------------------------------------------
    {
        name: "orient",
        category: "discovery",
        requiresSession: false,
        purpose: "THE FIRST CALL. Live feed health, cockpit session state, and explicit guidance on which tool to call next for your intent, in one call.",
        parameters: {},
    },
    {
        name: "describe_tool",
        category: "discovery",
        requiresSession: false,
        purpose: "The full contract for any tool: purpose, when to use it, when NOT to use it and what to use instead, parameters, response shape, and a worked example.",
        parameters: { name: "string (required) -- exact tool name" },
    },
    // -- data --------------------------------------------------------------
    {
        name: "investigate_area",
        category: "data",
        requiresSession: false,
        purpose: 'THE DEFAULT for "what is happening in or around X": geocodes a place, queries every matching streaming layer inside a radius, and pans the open globe to the result.',
        parameters: {
            place_name: "string (required) -- free-text place name, geocoded server-side",
            entity_type: "string (required) -- case-insensitive substring matched against streaming plugin ids/names",
            radius_km: "number (optional, > 0, default 50) -- search radius around the geocoded centre",
        },
        sessionNote: "Works without a tab; the camera pan is skipped and the summary says so.",
    },
    {
        name: "query_entities",
        category: "data",
        requiresSession: false,
        purpose: "The one entity finder: a bounding box, a radius around a point, or a name/text match. Replaces the v1 search_entities / get_entities_in_region / find_nearby_entities trio.",
        parameters: {
            bbox: "object (optional) -- { north, south, east, west }",
            near: "object (optional) -- { lat, lon, radiusKm }",
            text: "string (optional) -- name/text match; provide exactly one selector",
            pluginId: "string (optional) -- restrict to one plugin; omit to search every streaming plugin",
            filters: "object (optional) -- filterId -> value, applied server-side",
            fields: "string[] (optional) -- project only these properties",
            limit: "number (optional) -- maximum entities returned",
        },
    },
    {
        name: "get_entity_details",
        category: "data",
        requiresSession: false,
        purpose: "Full record for ONE entity you already have an id for: drill into a hit from query_entities or investigate_area.",
        parameters: { pluginId: "string (required)", entityId: "string (required)" },
    },
    {
        name: "get_plugin_data",
        category: "data",
        requiresSession: false,
        purpose: "The current full snapshot of one plugin, for surveying a feed rather than searching a region.",
        parameters: { pluginId: "string (required)" },
    },
    {
        name: "geocode_location",
        category: "data",
        requiresSession: false,
        purpose: "Resolve a place name or address to coordinates and a bounding box, when you need coordinates rather than a full investigation.",
        parameters: { query: "string (required) -- place name or address", limit: "integer 1-20 (optional, default 5) -- maximum matches, sorted by importance" },
    },
    {
        name: "get_regional_analytics",
        category: "data",
        requiresSession: false,
        purpose: "An aggregate answer for a region -- clustering and density summaries across the streaming feeds in a bounding box -- instead of a raw entity list.",
        parameters: {
            north: "number (required) [-90, 90]",
            south: "number (required) [-90, 90]",
            east: "number (required) [-180, 180]",
            west: "number (required) [-180, 180]",
            pluginId: "string (optional) -- restrict the analysis to one plugin",
            pluginIds: "string[] (optional) -- restrict the analysis to a set of plugins",
            groupBy: "string (optional) -- entity property to group counts by, e.g. 'type', 'country', 'operator'",
            clusterResolution: "integer 1-10 (optional, default 4) -- grid divisions per axis",
            topN: "integer 1-50 (optional, default 10) -- categories returned before the remainder is grouped as 'other'",
        },
    },
    // -- filter (live globe layer state) -----------------------------------
    {
        name: "get_plugin_filters",
        category: "filter",
        requiresSession: true,
        purpose: "The filterable fields a plugin declares, so a set_filter call is built with valid ids and value types.",
        parameters: { pluginId: "string (required)" },
        sessionNote: "Returns { available: false, reason: 'no_session_active' } rather than failing when no tab is open.",
    },
    {
        name: "set_filter",
        category: "filter",
        requiresSession: true,
        purpose: "Apply filters to one plugin's layer on the live globe, with no page reload. Affects the rendered layer, not query results.",
        parameters: { pluginId: "string (required)", filters: "object (required) -- filterId -> value; discover ids via get_plugin_filters", sessionId: "string (optional) -- target a specific tab" },
        sessionNote: "Enqueues a browser command; with no tab it returns 'no active globe session to control'.",
    },
    {
        name: "clear_filter",
        category: "filter",
        requiresSession: true,
        purpose: "Clear one plugin's filters, or every filter on the globe when pluginId is omitted.",
        parameters: { pluginId: "string (optional) -- omit to clear all plugins", sessionId: "string (optional) -- target a specific tab" },
        sessionNote: "Enqueues a browser command; with no tab it returns 'no active globe session to control'.",
    },
    // -- cockpit (browser command tools) -----------------------------------
    {
        name: "pan_globe",
        category: "cockpit",
        requiresSession: true,
        purpose: "Fly the camera to coordinates or to a bounding box. The only camera-movement tool (v1 fly_to was folded into it).",
        parameters: {
            lat: "number (optional) [-90, 90] -- with lon; optional when bbox is given",
            lon: "number (optional) [-180, 180]",
            bbox: "number[4] (optional) -- [west, south, east, north]; fits the region instead of a point",
            alt: "number (optional, > 0, default 15000) -- metres above the ellipsoid",
            heading: "number (optional) -- camera heading in degrees, 0 = north",
            pitch: "number (optional) -- camera pitch in degrees, -90 = straight down",
            duration: "number (optional) -- flight animation duration in seconds",
            sessionId: "string (optional)",
        },
        sessionNote: "A command tool: nothing moves without an open globe tab.",
    },
    {
        name: "focus_entity",
        category: "cockpit",
        requiresSession: true,
        purpose: "Centre the camera on one entity and open its detail card in the UI.",
        parameters: {
            entityId: "string (optional) -- focus this entity; alone it is resolved to coordinates via pluginId",
            pluginId: "string (optional) -- scopes the entityId lookup",
            lat: "number (optional) [-90, 90] -- focus a coordinate directly",
            lon: "number (optional) [-180, 180]",
            sessionId: "string (optional)",
        },
        sessionNote: "A command tool: nothing moves without an open globe tab.",
    },
    {
        name: "toggle_layer",
        category: "cockpit",
        requiresSession: true,
        purpose: "Turn a plugin's layer on or off on the live globe.",
        parameters: { layerId: "string (required) -- must be a plugin id this server knows about", enabled: "boolean (optional) -- omit to toggle the layer's current state", sessionId: "string (optional)" },
        sessionNote: "A command tool: nothing changes without an open globe tab.",
    },
    {
        name: "set_timeline",
        category: "cockpit",
        requiresSession: true,
        purpose: "Move the globe's timeline, or switch playback mode, for time-scoped data.",
        parameters: {
            currentTime: "string (optional) -- ISO 8601 datetime to seek to",
            timeWindow: "string (optional) -- one of '1h', '6h', '24h', '48h', '7d'",
            isPlaybackMode: "boolean (optional) -- true starts playback, false pauses",
            sessionId: "string (optional)",
        },
        sessionNote: "A command tool: nothing changes without an open globe tab.",
    },
];

/**
 * Legacy handlers still registered by registerDiscoveryTools for backward
 * compatibility. They are NOT part of the advertised v2 surface: orient
 * supersedes both. Kept here so describe_tool and the routes name them honestly
 * instead of pretending they do not exist.
 */
export const legacyTools: readonly CatalogTool[] = [
    {
        name: "list_available_plugins",
        category: "discovery",
        requiresSession: false,
        purpose: "LEGACY (prefer orient): streaming plugins with per-plugin entity counts and queryable field names.",
        parameters: {},
    },
    {
        name: "get_globe_context",
        category: "discovery",
        requiresSession: false,
        purpose: "LEGACY (prefer orient): session count, camera viewport, layers, and filter definitions in one call.",
        parameters: {},
    },
];

/** The tool an agent must call first, named so no artifact has to restate it. */
export const FIRST_CALL = "orient" as const;

export interface WorkflowStep {
    step: number;
    tool: string;
    /** Why this step exists, and when to stop here instead of continuing. */
    why: string;
}

/**
 * The canonical workflow. Order matters: orient first, so the agent knows what
 * is live before committing to a query. Stop at the first step that answers the
 * question -- most questions are answered by step 2.
 */
export const canonicalWorkflow: readonly WorkflowStep[] = [
    { step: 1, tool: "orient", why: "Always first: which feeds are streaming, whether a globe tab is attached, and which tool fits your intent. No parameters." },
    { step: 2, tool: "investigate_area", why: 'For "what is happening in or around X". Geocodes the place, queries the streaming layers, pans the globe when a tab is attached. Most questions end here.' },
    { step: 3, tool: "query_entities", why: "For a precise sweep you define yourself -- bounding box, radius around a point, or name match -- with optional server-side filters and field projection." },
    { step: 4, tool: "get_entity_details", why: "Drill into one entity from step 2 or 3 for its full record. Read-only, one entity." },
];

/** What an MCP session is, and which tools need one. */
export const sessionModel = {
    definition: "A session is one open browser tab showing the WorldWideView globe, identified by a UUID. Sessions are scoped to your API key: you only ever see your own.",
    discovery: "orient reports the active session count and whether a tab is attached.",
    selection: "Command tools take an optional sessionId. Omit it to target your most-recently-active tab.",
    requiresSession: catalog.filter((t) => t.requiresSession).map((t) => t.name),
    worksWithoutSession: catalog.filter((t) => !t.requiresSession).map((t) => t.name),
    noSessionBehaviour: "A command tool with no live tab fails with error 'no_active_session' and has no visible effect. Ask the user to open the app, then retry -- never report the command as done.",
} as const;

/**
 * DATA HONESTY. Load-bearing: an agent that presents placeholder data as ground
 * truth produces a confidently wrong answer about the real world, which is worse
 * than no answer. Every feed is either verified against a named upstream source
 * or explicitly placeholder.
 */
export const dataHonesty = {
    verifiedReal: [
        { feed: "ISS position", source: "WhereTheISS.at", note: "live orbital position, refreshed continuously" },
        { feed: "Earthquakes", source: "USGS", note: "real seismic events from the public feed" },
        { feed: "Wildfires", source: "NASA FIRMS", note: "real thermal anomaly detections" },
        { feed: "Sanctions", source: "OFAC", note: "real sanctions list entries" },
        { feed: "Civil unrest", source: "GDELT", note: "real reported events from the GDELT stream" },
        { feed: "Cyber threat indicators", source: "AlienVault OTX", note: "real published indicators" },
        { feed: "Satellites", source: "CelesTrak", note: "real TLE-derived orbital positions" },
    ],
    placeholder: [
        { feed: "Conflict events", why: "no verified live source is wired up; the layer shows synthetic/illustrative events" },
        { feed: "GPS jamming", why: "no verified live source is wired up; the layer shows synthetic/illustrative interference" },
    ],
    rule: "Never present a placeholder feed as ground truth. Name the feed the data came from, and for the two placeholder feeds above state that the values are illustrative and must not be used for decisions about real-world events.",
} as const;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Every advertised tool name, in catalog order. */
export function toolNames(): string[] {
    return catalog.map((t) => t.name);
}

/** Every name describe_tool can resolve, legacy handlers included. */
export function allKnownToolNames(): string[] {
    return [...catalog, ...legacyTools].map((t) => t.name);
}

/** The advertised tools in one category, in catalog order. */
export function toolsByCategory(category: ToolCategory): CatalogTool[] {
    return catalog.filter((t) => t.category === category);
}

/** Catalog entry for a tool, or undefined when the name is unknown to the surface. */
export function findTool(name: string): CatalogTool | undefined {
    return [...catalog, ...legacyTools].find((t) => t.name === name);
}
