/**
 * MCP server factory -- Phase 17 (Stateless Streamable HTTP transport)
 *
 * createMcpServer() returns a FRESH McpServer instance on every call.
 * It is the single aggregation point where future phases register their
 * capabilities:
 *
 *   Phase 18 -- registerGlobeResources(server, { userId })   -> globe:// resources
 *   Phase 19 -- registerGlobeCommandTools(server, { userId }) -> globe control tools
 *   Phase 20 -- registerDataQueryTools(server, { userId })    -> data query tools
 *   Phase 21 -- dynamic per-plugin tools merged into tools/list
 *
 * Those registrars are NOT called here -- Phase 17 ships the transport only.
 * Each feature phase calls its own registrar from src/app/api/mcp/route.ts
 * AFTER createMcpServer() returns, passing { userId } via closure injection
 * (per RECONCILIATION R-1).
 *
 * Stateless invariant (D-17-04): never cache this instance. A fresh server
 * is created per request so no session state or transport binding leaks
 * between concurrent requests.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readActiveSessions, readGlobeState } from "@/lib/globeStateStore";

const SERVER_NAME = "worldwideview" as const;

// The MCP server's own protocol-advertised version. Bump this when the
// server's self-description or tool surface changes in a meaningful way.
// This is NOT package.json -- do not keep them in sync automatically.
export const MCP_SERVER_VERSION = "2.0.0" as const;

export const MCP_SERVER_INSTRUCTIONS = `\
WorldWideView is a live geospatial intelligence engine: real-world data streams onto a 3D globe that a human can watch while you work. You query that data, and when a browser tab is open you can steer the globe so the human sees what you found. All state is scoped to your API key; you only ever see your own sessions and data.

START HERE
Call orient. In one call it tells you which data feeds are live right now, whether a browser tab is attached, and which tool to call for the task in front of you. Do not guess plugin names -- orient returns them.

TWO KINDS OF TOOL
1. Data tools -- run server-side, need no browser, always available: investigate_area (THE default for "what is happening in or around X"), query_entities, get_entity_details, get_plugin_data, geocode_location, get_regional_analytics.
2. Cockpit tools -- control the live globe and have no visible effect without an open tab: pan_globe, focus_entity, toggle_layer, set_timeline, and the filter tools set_filter, clear_filter, get_plugin_filters. Each takes an optional sessionId; omit it to target the most recently active tab.

READING A RESULT
Success is {"ok": true, "data": ..., "meta": ...}. Failure is {"ok": false, "error": ..., "message": ..., "hint": ...}, plus "validValues" when the fix is a vocabulary you could not have known. Branch on "ok", and read "hint" before retrying.
An empty result is a SUCCESS, not an error. "meta.emptyReason" says why: "no_data_matches" (the feed is live and nothing matched -- normal), "plugin_not_streaming" (that layer is not running), "engine_unreachable" (an OUTAGE -- say so plainly; never report it as an absence of data), "unknown". Never describe an outage as "no data".
Capped results carry "meta.truncated": true and "meta.totalMatched" for the full count.

SESSIONS AND RESOURCES
A session is one open browser tab, identified by a UUID, and it is live only while that tab is open. Read globe://sessions to list them, globe://state/{sessionId} to see what a tab is showing, globe://layers for layer definitions.

PLUGIN TOOLS
Extra tools named "<pluginId>__<toolName>" appear in tools/list once a browser tab has loaded that plugin. This server is stateless: re-call tools/list to discover them.

MORE DETAIL
Call describe_tool({ name }) for the full contract of any tool, including when NOT to use it. Machine-readable discovery lives at /llms.txt and /.well-known/mcp/server-card.json.

COORDINATES
latitude in [-90, 90], longitude in [-180, 180], altitude in metres above the ellipsoid.`;

/**
 * Returns a fresh, empty-capability McpServer per call.
 *
 * STATELESS (D-17-04): never cache this instance; a fresh server is created
 * per request. Do NOT hoist the return value to module scope.
 */
export function createMcpServer(): McpServer {
    return new McpServer(
        { name: SERVER_NAME, version: MCP_SERVER_VERSION },
        {
            instructions: MCP_SERVER_INSTRUCTIONS,
            capabilities: {
                // tools.listChanged is false: this stateless server constructs a
                // fresh McpServer per request and cannot push notifications to
                // connected clients. Clients must re-call tools/list to pick up
                // plugin tools added after the browser loads a new plugin (TRANS-04).
                tools: { listChanged: false },
            },
        },
    );
}

// ---------------------------------------------------------------------------
// Phase 26: Orientation prompts (INST-03, INST-04)
// ---------------------------------------------------------------------------

/**
 * Registers orientation prompts that give a fresh agent immediate context
 * about the current globe state and canonical investigation workflows.
 *
 * orient-globe: returns active sessions + loaded layers + camera state in
 *   one call so the agent is ready to issue command tools without extra reads.
 *
 * investigate: returns a static step-numbered workflow for investigating a
 *   named place on the globe (geocode -> check plugins -> fly -> query).
 */
export async function registerOrientationPrompts(
    server: McpServer,
    { userId }: { userId: string },
): Promise<void> {
    // orient-globe: no args -- returns a snapshot of the current globe state.
    server.registerPrompt(
        "orient-globe",
        {
            title: "Orient Globe",
            description:
                "Returns active globe sessions, loaded layers, and camera state in one call. " +
                "Call this first so you know which sessions exist and what each tab is showing " +
                "before issuing any command tool.",
        },
        async () => {
            const sessions = await readActiveSessions(userId);

            if (sessions.length === 0) {
                return {
                    messages: [
                        {
                            role: "user" as const,
                            content: {
                                type: "text" as const,
                                text: [
                                    "GLOBE ORIENTATION",
                                    "",
                                    "Active sessions: none",
                                    "",
                                    "No browser tab is currently showing the globe. " +
                                        "Ask the user to open the WorldWideView app in a browser first, " +
                                        "then call orient-globe again.",
                                    "",
                                    "Loaded layers: none",
                                    "Camera state: none",
                                ].join("\n"),
                            },
                        },
                    ],
                };
            }

            // readActiveSessions returns Redis zrange order (ascending score =
            // oldest first), so sort by lastSeen descending to pick the genuinely
            // most-recent session (matches composeGlobeContext / get_globe_context).
            const sorted = [...sessions].sort((a, b) => b.lastSeen - a.lastSeen);
            const mostRecent = sorted[0];
            const snapshot = await readGlobeState(userId, mostRecent.sessionId);

            const sessionLines = sorted.map(
                (s, i) =>
                    `  ${i + 1}. sessionId=${s.sessionId} (last seen ${Math.round((Date.now() - s.lastSeen) / 1000)}s ago)`,
            );

            const layers = snapshot?.layers ?? {};
            const layerKeys = Object.keys(layers);
            const layerLines =
                layerKeys.length > 0
                    ? layerKeys.map((k) => `  - ${k}: ${JSON.stringify(layers[k])}`)
                    : ["  none"];

            const camera = snapshot
                ? [
                      `  latitude:  ${snapshot.viewport?.lat ?? "unknown"}`,
                      `  longitude: ${snapshot.viewport?.lon ?? "unknown"}`,
                      `  altitude:  ${snapshot.viewport?.altitude ?? "unknown"} m`,
                  ]
                : ["  unknown (no snapshot available)"];

            const text = [
                "GLOBE ORIENTATION",
                "",
                `Active sessions (${sessions.length}):`,
                ...sessionLines,
                "",
                `Most-recent session: ${mostRecent.sessionId}`,
                "",
                "Loaded layers:",
                ...layerLines,
                "",
                "Camera state:",
                ...camera,
            ].join("\n");

            return {
                messages: [
                    {
                        role: "user" as const,
                        content: { type: "text" as const, text },
                    },
                ],
            };
        },
    );

    // investigate: optional place arg -- returns a step-numbered workflow.
    server.registerPrompt(
        "investigate",
        {
            title: "Investigate a Place",
            description:
                "Returns a step-numbered workflow for investigating a named place on the globe. " +
                "Covers geocoding, plugin availability check, camera navigation, layer toggling, " +
                "and entity querying. Provide a place name for a tailored guide, or omit for the generic template.",
            argsSchema: { place: z.string().optional() },
        },
        ({ place }: { place?: string }) => {
            const target = place ?? "the place of interest";
            const text = [
                `INVESTIGATION WORKFLOW${place ? `: ${place.toUpperCase()}` : ""}`,
                "",
                `Fastest path -- one call`,
                `  investigate_area({ place_name: "${target}", entity_type: "<layer>" })`,
                `  It geocodes the place, queries every matching streaming plugin in one region`,
                `  query, and pans the open globe to the area when a browser tab is attached.`,
                `  entity_type is OPTIONAL: omit it and every streaming layer is scanned, no`,
                `  prior vocabulary needed. With a layer in mind it is a case-insensitive`,
                `  substring of a plugin id or name -- call orient first if you do not know`,
                `  which feeds are live.`,
                "",
                `Manual path -- when you need control`,
                `  Step 1  orient -- which feeds are live, and is a browser tab attached?`,
                `  Step 2  query_entities({ bbox }) or query_entities({ near }), or`,
                `          geocode_location({ query: "${target}" }) for exact coordinates.`,
                `  Step 3  get_entity_details({ pluginId, entityId }) to drill into one entity.`,
                `  Step 4  Cockpit, needs an open tab: toggle_layer, pan_globe, focus_entity, set_timeline.`,
                "",
                `READING RESULTS`,
                `  Success is {"ok":true,"data":...,"meta":...}. An empty result is still a success:`,
                `  read meta.emptyReason. "no_data_matches" is normal; "engine_unreachable" is an`,
                `  outage and must be reported as one, never as "no data".`,
                `  Call describe_tool({ name }) for any tool's full contract.`,
            ].join("\n");

            return {
                messages: [
                    {
                        role: "user" as const,
                        content: { type: "text" as const, text },
                    },
                ],
            };
        },
    );
}
