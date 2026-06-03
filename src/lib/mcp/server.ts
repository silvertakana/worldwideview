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

const SERVER_NAME = "worldwideview" as const;

// The MCP server's own protocol-advertised version. Bump this when the
// server's self-description or tool surface changes in a meaningful way.
// This is NOT package.json -- do not keep them in sync automatically.
export const MCP_SERVER_VERSION = "1.2.0" as const;

export const MCP_SERVER_INSTRUCTIONS = `\
WorldWideView MCP server. Read and control a live 3D geospatial globe for the authenticated user. Everything is scoped to your API key: you only ever see and control your own data and your own browser sessions.

CAPABILITIES
- Globe command tools (write/steer a live browser tab): pan_globe, focus_entity, toggle_layer, set_timeline.
- Data query tools (read shared engine data): search_entities, get_entities_in_region, get_entity_details, get_plugin_data.
- Resources (read): globe://sessions, globe://state/{sessionId}, globe://layers.
- Plugin tools (dynamic): extra tools named "<pluginId>__<toolName>" appear only after a browser tab has loaded that plugin and published its catalog. Re-call tools/list after the relevant plugin is loaded.

SESSIONS (read before using any command tool)
- A session is one open browser tab showing the globe, identified by a UUID sessionId.
- To discover sessions, READ the resource globe://sessions. It returns the tabs active in the last ~45 seconds; a tab that goes quiet drops off the list.
- Every command tool takes an optional sessionId. Omit it to target your most-recently-active tab. Pass a sessionId from globe://sessions to target one specific tab. Commands are isolated per session and are never broadcast to other tabs.
- To see what a specific tab currently shows (camera, layers, timeline), read globe://state/{sessionId}.
- If no tab is active, command tools return "no active globe session to control" -- the user must open the app in a browser first.

COORDINATES
- latitude must be in [-90, 90], longitude in [-180, 180], altitude greater than 0 metres. Out-of-range values are rejected with a validation error.

DATA AVAILABILITY
- Data query tools return {"success": true, "entities": [], "count": 0} when nothing matches OR when the live data engine is not currently feeding that plugin. An empty result is normal, not an error.`;

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
                // tools.listChanged: required so Phase 21 can push live tool
                // list updates to clients (RECONCILIATION R-1).
                tools: { listChanged: true },
            },
        },
    );
}
