/**
 * MCP Globe Command Tool registrar (Phase 19a Wave 2 -- 19-03).
 *
 * Registers four MCP tools that let an AI agent control the live globe in the
 * browser. Commands are enqueued to a per-session Redis list; the browser polls
 * GET /api/globe/commands to drain them (poll-based delivery, 19a transport).
 *
 *   pan_globe      -- fly the camera to a lat/lon/altitude
 *   focus_entity   -- point the camera at a known entity or coordinate
 *   toggle_layer   -- enable or disable a named plugin layer
 *   set_timeline   -- set playback time / window / mode
 *
 * Security: userId comes ONLY from ctx (the verified auth result). It is never
 * read from tool arguments. sessionId may come from args (scopes the tab) or is
 * resolved from the user's active ZSET entry.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { enqueueGlobeCommand, resolveActiveSessionId } from "@/lib/globeCommandQueue";
import { TIME_WINDOW_VALUES } from "@/core/globe/types/GlobeCommand";
import type { GlobeCommand } from "@/core/globe/types/GlobeCommand";
import { latSchema, lonSchema, altSchema } from "@/lib/mcp/coordinateSchemas";

// Re-export so existing tests that import from this module continue to work.
export { latSchema, lonSchema, altSchema };

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type McpTextResult = { content: [{ type: "text"; text: string }] };

function textResult(text: string): McpTextResult {
    return { content: [{ type: "text", text }] };
}

const NO_SESSION_RESULT = textResult("no active globe session to control");

/**
 * Resolves the session to use: explicit arg takes precedence, falling back to
 * the most-recently-active session for this user. Returns null if none is live.
 */
async function resolveSession(
    userId: string,
    argSessionId: string | undefined,
): Promise<string | null> {
    if (argSessionId !== undefined && argSessionId !== "") {
        return argSessionId;
    }
    return resolveActiveSessionId(userId);
}

// ---------------------------------------------------------------------------
// Public registrar
// ---------------------------------------------------------------------------

export function registerGlobeCommandTools(
    server: McpServer,
    ctx: { userId: string },
): void {
    const { userId } = ctx;

    // TOOL-01: pan_globe
    server.registerTool(
        "pan_globe",
        {
            description:
                "Fly the globe camera to a geographic position. Provide lat/lon/alt (metres). Optional heading, pitch, and animation duration.",
            inputSchema: {
                lat: latSchema.describe("Latitude in decimal degrees [-90, 90]"),
                lon: lonSchema.describe("Longitude in decimal degrees [-180, 180]"),
                alt: altSchema.describe("Altitude in metres above the ellipsoid (must be > 0)"),
                heading: z.number().optional().describe("Camera heading in degrees (0 = north)"),
                pitch: z.number().optional().describe("Camera pitch in degrees (-90 = straight down)"),
                duration: z.number().optional().describe("Flight animation duration in seconds"),
                sessionId: z.string().optional().describe("Target globe session id. Obtain valid ids by reading the globe://sessions resource. Omit to target your most-recently-active browser tab."),
            },
        },
        async (args) => {
            try {
                const sessionId = await resolveSession(userId, args.sessionId);
                if (sessionId === null) return NO_SESSION_RESULT;

                const cmd: GlobeCommand = {
                    type: "pan",
                    lat: args.lat,
                    lon: args.lon,
                    alt: args.alt,
                    ...(args.heading !== undefined && { heading: args.heading }),
                    ...(args.pitch !== undefined && { pitch: args.pitch }),
                    ...(args.duration !== undefined && { duration: args.duration }),
                };
                await enqueueGlobeCommand(userId, sessionId, cmd);
                return textResult(`Camera panning to lat=${args.lat}, lon=${args.lon}, alt=${args.alt}`);
            } catch (err) {
                console.error("[globeCommandTools] pan_globe failed:", err);
                return textResult("pan_globe command failed");
            }
        },
    );

    // TOOL-02: focus_entity
    server.registerTool(
        "focus_entity",
        {
            description:
                "Point the globe camera at a geographic coordinate. Provide lat and lon to fly the camera there. " +
                "entityId is accepted but entity-id-to-coordinate resolution is not yet wired; always include lat/lon for a reliable camera move.",
            inputSchema: {
                entityId: z.string().optional().describe("Entity id (informational; coordinate resolution not yet supported -- also provide lat/lon)"),
                lat: latSchema.optional().describe("Latitude to focus on [-90, 90]"),
                lon: lonSchema.optional().describe("Longitude to focus on [-180, 180]"),
                sessionId: z.string().optional().describe("Target globe session id. Obtain valid ids by reading the globe://sessions resource. Omit to target your most-recently-active browser tab."),
            },
        },
        async (args) => {
            try {
                const sessionId = await resolveSession(userId, args.sessionId);
                if (sessionId === null) return NO_SESSION_RESULT;

                const cmd: GlobeCommand = {
                    type: "focusEntity",
                    ...(args.entityId !== undefined && { entityId: args.entityId }),
                    ...(args.lat !== undefined && { lat: args.lat }),
                    ...(args.lon !== undefined && { lon: args.lon }),
                };
                await enqueueGlobeCommand(userId, sessionId, cmd);
                return textResult(`Focus entity command enqueued (entityId=${args.entityId ?? "none"}, lat=${args.lat ?? "none"}, lon=${args.lon ?? "none"})`);
            } catch (err) {
                console.error("[globeCommandTools] focus_entity failed:", err);
                return textResult("focus_entity command failed");
            }
        },
    );

    // TOOL-03: toggle_layer
    server.registerTool(
        "toggle_layer",
        {
            description:
                "Enable or disable a plugin data layer on the globe. Omit 'enabled' to toggle the current state.",
            inputSchema: {
                layerId: z.string().describe("The plugin/layer identifier to toggle"),
                enabled: z.boolean().optional().describe("True to enable, false to disable, omit to toggle"),
                sessionId: z.string().optional().describe("Target globe session id. Obtain valid ids by reading the globe://sessions resource. Omit to target your most-recently-active browser tab."),
            },
        },
        async (args) => {
            try {
                const sessionId = await resolveSession(userId, args.sessionId);
                if (sessionId === null) return NO_SESSION_RESULT;

                const cmd: GlobeCommand = {
                    type: "toggleLayer",
                    layerId: args.layerId,
                    ...(args.enabled !== undefined && { enabled: args.enabled }),
                };
                await enqueueGlobeCommand(userId, sessionId, cmd);
                return textResult(`Layer '${args.layerId}' toggle command enqueued`);
            } catch (err) {
                console.error("[globeCommandTools] toggle_layer failed:", err);
                return textResult("toggle_layer command failed");
            }
        },
    );

    // TOOL-04: set_timeline
    server.registerTool(
        "set_timeline",
        {
            description:
                "Set the globe timeline position, time window, or playback mode.",
            inputSchema: {
                currentTime: z.string().optional().describe("ISO 8601 datetime to seek to"),
                timeWindow: z.enum(TIME_WINDOW_VALUES).optional().describe("Time window: one of '1h', '6h', '24h', '48h', '7d'"),
                isPlaybackMode: z.boolean().optional().describe("True to start playback, false to pause"),
                sessionId: z.string().optional().describe("Target globe session id. Obtain valid ids by reading the globe://sessions resource. Omit to target your most-recently-active browser tab."),
            },
        },
        async (args) => {
            try {
                const sessionId = await resolveSession(userId, args.sessionId);
                if (sessionId === null) return NO_SESSION_RESULT;

                const cmd: GlobeCommand = {
                    type: "setTimeline",
                    ...(args.currentTime !== undefined && { currentTime: args.currentTime }),
                    ...(args.timeWindow !== undefined && { timeWindow: args.timeWindow }),
                    ...(args.isPlaybackMode !== undefined && { isPlaybackMode: args.isPlaybackMode }),
                };
                await enqueueGlobeCommand(userId, sessionId, cmd);
                return textResult("Timeline command enqueued");
            } catch (err) {
                console.error("[globeCommandTools] set_timeline failed:", err);
                return textResult("set_timeline command failed");
            }
        },
    );
}
