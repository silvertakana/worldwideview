/**
 * Globe MCP Resource registrar (Phase 18 Wave 3 — 18-04).
 *
 * Registers three read-only MCP resources scoped to the authenticated user:
 *   RSRC-02  globe://state/{sessionId}  — full GlobeStateSnapshot for a session
 *   RSRC-03  globe://sessions           — list of active sessions
 *   RSRC-04  globe://layers             — layer map from the most-recent session
 *
 * Each handler closes over `userId` at registration time so the same McpServer
 * instance is safely reusable without leaking cross-user data.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readGlobeState, readActiveSessions } from "@/lib/globeStateStore";

// ---------------------------------------------------------------------------
// Public registrar
// ---------------------------------------------------------------------------

export function registerGlobeResources(
    server: McpServer,
    { userId }: { userId: string },
): void {
    // RSRC-02: globe://state/{sessionId}
    // Returns the full GlobeStateSnapshot for the given session.
    const stateTemplate = new ResourceTemplate("globe://state/{sessionId}", { list: undefined });
    server.registerResource(
        "globe-state",
        stateTemplate,
        { description: "Full GlobeStateSnapshot for a specific session" },
        async (uri, variables) => {
            const sessionId = String(variables["sessionId"] ?? "");
            const snapshot = await readGlobeState(userId, sessionId);
            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: "application/json",
                        text: JSON.stringify(snapshot),
                    },
                ],
            };
        },
    );

    // RSRC-03: globe://sessions
    // Returns the list of active sessions for the authenticated user.
    server.registerResource(
        "globe-sessions",
        "globe://sessions",
        { description: "Active globe sessions for the authenticated user" },
        async (uri) => {
            const sessions = await readActiveSessions(userId);
            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: "application/json",
                        text: JSON.stringify(sessions),
                    },
                ],
            };
        },
    );

    // RSRC-04: globe://layers
    // Returns the layer map from the most-recent active session snapshot.
    // Gracefully returns an empty object when no active sessions exist.
    server.registerResource(
        "globe-layers",
        "globe://layers",
        { description: "Active layer map from the most-recent globe session" },
        async (uri) => {
            const sessions = await readActiveSessions(userId);
            if (sessions.length === 0) {
                return {
                    contents: [
                        {
                            uri: uri.toString(),
                            mimeType: "application/json",
                            text: JSON.stringify({}),
                        },
                    ],
                };
            }
            const snapshot = await readGlobeState(userId, sessions[0].sessionId);
            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: "application/json",
                        text: JSON.stringify(snapshot?.layers ?? {}),
                    },
                ],
            };
        },
    );
}
