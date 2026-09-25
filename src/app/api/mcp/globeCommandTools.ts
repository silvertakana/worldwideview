/**
 * MCP Globe Command Tool registrar (Phase 19a Wave 2 -- 19-03).
 *
 * Registers four MCP tools that let an AI agent control the live globe in the
 * browser: pan_globe (coordinate or bbox), focus_entity, toggle_layer,
 * set_timeline. Commands are enqueued to a per-session Redis list; the browser
 * polls GET /api/globe/commands to drain them (poll-based delivery, 19a).
 *
 * Security: userId comes ONLY from ctx (the verified auth result), never from
 * tool arguments. sessionId may come from args or is resolved from the user's
 * active ZSET entry.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { enqueueGlobeCommand, resolveActiveSessionId } from "@/lib/globeCommandQueue";
import { readActiveSessions } from "@/lib/globeStateStore";
import { TIME_WINDOW_VALUES } from "@/core/globe/types/GlobeCommand";
import type { GlobeCommand } from "@/core/globe/types/GlobeCommand";
import { latSchema, lonSchema, altSchema } from "@/lib/mcp/coordinateSchemas";
import { layerIdSchema, entityIdSchema } from "@/lib/mcp/identifierSchemas";
import { mcpCatch, mcpFail, mcpOk, noActiveSessionError } from "@/lib/mcp/responseEnvelope";
import type { McpTextResult } from "@/lib/mcp/responseEnvelope";
import { listStreamingPlugins } from "./discoveryHelpers";
import { getEntityDetails } from "@/lib/data-query/service";

/** Default camera altitude, in metres, when the caller omits one. */
export const DEFAULT_ALTITUDE_M = 15_000;

/** The one camera-selection rule, carried by every command tool description. */
export const CAMERA_DECISION =
    "Camera tools: pan_globe moves the camera to explicit coordinates or fits a bbox, focus_entity centres on one entity or coordinate when you already have an entity id, toggle_layer changes layer visibility, and set_timeline changes time or playback.";

const ENQUEUE_HINT =
    "The command could not be enqueued. Retry, and check that Redis is reachable if it keeps failing.";

/** Explicit arg wins; otherwise the user's most-recently-active session, or null. */
async function resolveSession(userId: string, argSessionId: string | undefined): Promise<string | null> {
    if (argSessionId !== undefined && argSessionId !== "") return argSessionId;
    return resolveActiveSessionId(userId);
}

/** Failure envelope for "no live browser tab", carrying the ids that are live. */
export async function noActiveSessionResult(userId: string): Promise<McpTextResult> {
    const sessions = await readActiveSessions(userId);
    return noActiveSessionError(sessions.map((s) => s.sessionId));
}

/**
 * Plugin ids this server knows about: the validity set and the validValues vocabulary.
 *
 * Never throws. It feeds a validity HINT, not an authorization gate, so an
 * unreachable engine must degrade to "cannot validate" (empty list, callers skip
 * the check) rather than turning the whole tool call into a protocol error. An
 * empty list is already the documented "no plugin ids known" case.
 */
async function knownPluginIds(): Promise<string[]> {
    try {
        const { plugins } = await listStreamingPlugins();
        return plugins.map((p) => p.pluginId);
    } catch {
        return [];
    }
}

/** Failure envelope for an entityId that resolved to no coordinates. */
async function unresolvedEntityError(
    entityId: string,
    pluginId: string | undefined,
): Promise<McpTextResult> {
    const hint =
        pluginId === undefined
            ? "Retry with pluginId set to the plugin that owns this entity, or pass lat and lon directly. Call query_entities to find the entity and its pluginId."
            : "The entity was not in that plugin's live snapshot. Call query_entities to confirm the entityId is current, or pass lat and lon directly.";
    return mcpFail("not_found", `Could not resolve entityId "${entityId}" to coordinates.`, {
        hint,
        validValues: pluginId === undefined ? await knownPluginIds() : undefined,
        details: { entityId, pluginId: pluginId ?? null },
    });
}

/** Enqueues the command and returns the shared success/throw envelopes. */
async function enqueueAndOk<C extends GlobeCommand>(
    userId: string,
    sessionId: string,
    cmd: C,
    payload: (cmd: C) => Record<string, unknown>,
    toolName: string,
): Promise<McpTextResult> {
    try {
        await enqueueGlobeCommand(userId, sessionId, cmd);
        return mcpOk({ command: cmd.type, sessionId, ...payload(cmd) });
    } catch (err) {
        return mcpCatch("internal_error", `${toolName} command failed.`, err, { hint: ENQUEUE_HINT });
    }
}

/** The two camera commands pan_globe can enqueue. */
type PanCommand = Extract<GlobeCommand, { type: "pan" } | { type: "flyTo" }>;

/** Anchor coordinates echoed back for a pan or flyTo command. */
function panAnchor(cmd: PanCommand): Record<string, unknown> {
    if (cmd.type !== "flyTo") return { lat: cmd.lat, lon: cmd.lon, alt: cmd.alt };
    const { lat, lng: lon, alt, bbox } = cmd;
    return { lat, lon, ...(alt !== undefined && { alt }), ...(bbox !== undefined && { bbox }) };
}

/** Resolves a bbox fit (flyTo) or a direct pan into the GlobeCommand to enqueue. */
function panCommand(args: {
    lat?: number; lon?: number; bbox?: [number, number, number, number];
    alt?: number; heading?: number; pitch?: number; duration?: number;
}): PanCommand | McpTextResult {
    if (args.bbox !== undefined) {
        // A bbox wins: the browser fits the region. Anchor at the caller's
        // coordinates when given, otherwise the centre of the box.
        const [west, south, east, north] = args.bbox;
        return {
            type: "flyTo",
            lat: args.lat ?? (south + north) / 2,
            lng: args.lon ?? (west + east) / 2,
            ...(args.alt !== undefined && { alt: args.alt }),
            bbox: args.bbox,
        };
    }
    if (args.lat === undefined || args.lon === undefined) {
        return mcpFail("invalid_parameters", "pan_globe needs either bbox, or both lat and lon.", {
            hint: "Pass bbox [west,south,east,north] to fit a region, or lat and lon for a point.",
        });
    }
    return {
        type: "pan",
        lat: args.lat,
        lon: args.lon,
        alt: args.alt ?? DEFAULT_ALTITUDE_M,
        ...(args.heading !== undefined && { heading: args.heading }),
        ...(args.pitch !== undefined && { pitch: args.pitch }),
        ...(args.duration !== undefined && { duration: args.duration }),
    };
}

export function registerGlobeCommandTools(
    server: McpServer,
    ctx: { userId: string },
): void {
    const { userId } = ctx;

    server.registerTool(
        "pan_globe",
        {
            description:
                "Move the globe camera: with lat/lon it pans to that coordinate, with bbox it fits that region in view using a flyTo. " +
                "Requires an active globe session (globe://sessions); without a live tab this fails with error no_active_session. " +
                CAMERA_DECISION + " " +
                "Limits: lat [-90, 90], lon [-180, 180], alt > 0 m; with bbox only, the bbox centre is the anchor. " +
                "Parameters: lat, lon (optional with bbox), bbox, alt metres (default 15000), heading, pitch, duration, sessionId. " +
                "Example: pan_globe({lat:48.8566,lon:2.3522,alt:500000}) or pan_globe({bbox:[2.2,48.8,2.5,48.9]}).",
            inputSchema: {
                lat: latSchema.optional().describe("Latitude [-90, 90]. Optional when bbox is supplied."),
                lon: lonSchema.optional().describe("Longitude [-180, 180]. Optional when bbox is supplied."),
                bbox: z.tuple([lonSchema, latSchema, lonSchema, latSchema]).optional()
                    .describe("[west, south, east, north] bounding box to fit in view"),
                alt: altSchema.optional().describe("Altitude in metres above the ellipsoid (must be > 0). Defaults to 15000."),
                heading: z.number().optional().describe("Camera heading in degrees (0 = north)"),
                pitch: z.number().optional().describe("Camera pitch in degrees (-90 = straight down)"),
                duration: z.number().optional().describe("Flight animation duration in seconds"),
                sessionId: z.string().optional().describe("Target session id; omit for your most-recently-active tab."),
            },
        },
        async (args) => {
            const sessionId = await resolveSession(userId, args.sessionId);
            if (sessionId === null) return await noActiveSessionResult(userId);
            const cmd = panCommand(args);
            if (!("type" in cmd)) return cmd;
            return await enqueueAndOk(userId, sessionId, cmd, panAnchor, "pan_globe");
        },
    );

    server.registerTool(
        "focus_entity",
        {
            description:
                "Point the globe camera at a known entity or coordinate. Requires an active globe session (globe://sessions); without a live tab this fails with error no_active_session. " +
                CAMERA_DECISION + " " +
                "Given lat/lon they are used directly; given only entityId the server resolves coordinates via a pluginId + entityId lookup, and an unresolvable entityId fails with error not_found (with the plugin ids as validValues when pluginId was omitted). " +
                "Parameters: entityId, pluginId (scopes the lookup), lat, lon, sessionId (all optional). " +
                "Example: focus_entity({entityId:'ship-123',pluginId:'ais'}) or focus_entity({lat:35.68,lon:139.69}).",
            inputSchema: {
                entityId: entityIdSchema.optional().describe("Entity id to focus on"),
                pluginId: z.string().optional().describe("Plugin owning this entity; narrows the id lookup when lat/lon are absent"),
                lat: latSchema.optional().describe("Latitude to focus on [-90, 90]"),
                lon: lonSchema.optional().describe("Longitude to focus on [-180, 180]"),
                sessionId: z.string().optional().describe("Target session id; omit for your most-recently-active tab."),
            },
        },
        async (args) => {
            const sessionId = await resolveSession(userId, args.sessionId);
            if (sessionId === null) return await noActiveSessionResult(userId);

            let lat = args.lat;
            let lon = args.lon;
            const resolvesFromEntityId =
                lat === undefined && lon === undefined && args.entityId !== undefined;

            // Coordinates absent but an entity id present: resolve server-side.
            if (resolvesFromEntityId && args.pluginId !== undefined && args.entityId !== undefined) {
                const detail = await getEntityDetails(args.pluginId, args.entityId);
                if (detail.data !== null) ({ latitude: lat, longitude: lon } = detail.data);
            }

            if (resolvesFromEntityId && (lat === undefined || lon === undefined)) {
                // Unresolvable entity id: fail honestly rather than enqueue a
                // command the browser cannot execute.
                return await unresolvedEntityError(args.entityId as string, args.pluginId);
            }

            const cmd: GlobeCommand = {
                type: "focusEntity",
                ...(args.entityId !== undefined && { entityId: args.entityId }),
                ...(lat !== undefined && { lat }),
                ...(lon !== undefined && { lon }),
            };
            return await enqueueAndOk(
                userId,
                sessionId,
                cmd,
                () => ({
                    ...(args.entityId !== undefined && { entityId: args.entityId }),
                    ...(lat !== undefined && { lat }),
                    ...(lon !== undefined && { lon }),
                    resolvedFromEntityId: resolvesFromEntityId,
                }),
                "focus_entity",
            );
        },
    );

    server.registerTool(
        "toggle_layer",
        {
            description:
                "Enable or disable a plugin data layer on the globe. Requires an active globe session (globe://sessions); without a live tab this fails with error no_active_session. " +
                CAMERA_DECISION + " " +
                "Limits: layerId must match a plugin this server knows about; an unrecognized id fails with error unknown_plugin plus validValues. " +
                "Parameters: layerId (required), enabled (true/false, omit to toggle), sessionId (optional). " +
                "Example: toggle_layer({layerId:'ais',enabled:true})",
            inputSchema: {
                layerId: layerIdSchema.describe("The plugin/layer identifier to toggle"),
                enabled: z.boolean().optional().describe("True to enable, false to disable, omit to toggle"),
                sessionId: z.string().optional().describe("Target session id; omit for your most-recently-active tab."),
            },
        },
        async (args) => {
            const sessionId = await resolveSession(userId, args.sessionId);
            if (sessionId === null) return await noActiveSessionResult(userId);

            const validLayerIds = await knownPluginIds();
            if (validLayerIds.length > 0 && !validLayerIds.includes(args.layerId)) {
                return mcpFail("unknown_plugin", `Unknown layerId "${args.layerId}".`, {
                    hint: "Retry with one of validValues. Call list_available_plugins to see every layer this server currently knows about.",
                    validValues: validLayerIds,
                });
            }

            const cmd: GlobeCommand = {
                type: "toggleLayer",
                layerId: args.layerId,
                ...(args.enabled !== undefined && { enabled: args.enabled }),
            };
            return await enqueueAndOk(userId, sessionId, cmd, () => ({ layerId: args.layerId }), "toggle_layer");
        },
    );

    server.registerTool(
        "set_timeline",
        {
            description:
                "Set the globe timeline position, time window, or playback mode. Requires an active globe session (globe://sessions); without a live tab this fails with error no_active_session. " +
                CAMERA_DECISION + " " +
                "Limits: currentTime must be ISO 8601; timeWindow must be one of '1h','6h','24h','48h','7d'. " +
                "Parameters: currentTime, timeWindow, isPlaybackMode, sessionId (all optional). " +
                "Example: set_timeline({timeWindow:'24h',isPlaybackMode:true})",
            inputSchema: {
                currentTime: z.string().optional().describe("ISO 8601 datetime to seek to"),
                timeWindow: z.enum(TIME_WINDOW_VALUES).optional().describe("Time window: one of '1h', '6h', '24h', '48h', '7d'"),
                isPlaybackMode: z.boolean().optional().describe("True to start playback, false to pause"),
                sessionId: z.string().optional().describe("Target session id; omit for your most-recently-active tab."),
            },
        },
        async (args) => {
            const sessionId = await resolveSession(userId, args.sessionId);
            if (sessionId === null) return await noActiveSessionResult(userId);

            const cmd: GlobeCommand = {
                type: "setTimeline",
                ...(args.currentTime !== undefined && { currentTime: args.currentTime }),
                ...(args.timeWindow !== undefined && { timeWindow: args.timeWindow }),
                ...(args.isPlaybackMode !== undefined && { isPlaybackMode: args.isPlaybackMode }),
            };
            return await enqueueAndOk(
                userId,
                sessionId,
                cmd,
                () => ({
                    ...(args.currentTime !== undefined && { currentTime: args.currentTime }),
                    ...(args.timeWindow !== undefined && { timeWindow: args.timeWindow }),
                    ...(args.isPlaybackMode !== undefined && { isPlaybackMode: args.isPlaybackMode }),
                }),
                "set_timeline",
            );
        },
    );
}
