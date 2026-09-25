/**
 * orient -- the MCP front door (AX overhaul, 2026-09-25).
 *
 * WHY THIS EXISTS: v1 had no single entry point. An agent that did not already
 * know the tool vocabulary had to read the server instructions block and guess
 * which of five overlapping finders to call. orient answers three questions in
 * ONE call -- is the engine up and what is streaming, is a globe tab attached,
 * and which tool should I call next -- so the first turn is never a guess.
 *
 * Everything here is derived from existing helpers; nothing is re-implemented.
 *   composeGlobeContext    -> session count, camera, layers, streaming plugins
 *   resolveActiveSessionId -> the tab a command tool would target
 */

import {
    composeGlobeContext,
    resolveActiveSessionId,
    type StreamingPlugin,
} from "./discoveryHelpers";
import type { McpEmptyReason } from "@/lib/mcp/responseEnvelope";
import { catalog, canonicalWorkflow, type WorkflowStep } from "@/lib/mcp/toolCatalog";

/** One intent -> the exact call that answers it. */
export interface IntentGuidance {
    intent: string;
    call: string;
    note: string;
}

/**
 * Intent routing. Deliberately explicit and few: the point of the front door
 * is that an agent with a question but no vocabulary lands on the right tool on
 * the first try, so each note says what the tool DOES, not which category it
 * belongs to.
 */
export const INTENT_GUIDANCE: readonly IntentGuidance[] = [
    {
        intent: "What is happening in or around a named place?",
        call: "investigate_area({ place_name, entity_type?, radius_km? }) -- omit entity_type to scan every streaming layer",
        note: "The default for this question. Needs no session; pans the globe when a tab is attached.",
    },
    {
        intent: "Sweep a region I can define myself (box, radius, or name)?",
        call: "query_entities({ bbox | near | text, pluginId?, filters?, fields?, limit? })",
        note: "No session required. Use this instead of investigate_area when you already have coordinates or bounds.",
    },
    {
        intent: "How much, how dense, or how distributed is a region?",
        call: "get_regional_analytics({ north, south, east, west, groupBy?, ... })",
        note: "Aggregates, breakdowns, and clusters instead of a raw entity list.",
    },
    {
        intent: "Full detail for one entity I already have an id for?",
        call: "get_entity_details({ pluginId, entityId })",
        note: "Read-only, no session required.",
    },
    {
        intent: "Where is a place, or which place did the user mean?",
        call: "geocode_location({ query, limit? })",
        note: "Coordinates plus alternatives ranked by importance. Do not guess coordinates.",
    },
    {
        intent: "What are the exact parameters and limits of a tool?",
        call: "describe_tool({ name })",
        note: "Purpose, when to use it, when NOT to, parameters, response shape, one worked example.",
    },
    {
        intent: "Steer the globe the user is looking at?",
        call: "pan_globe(...) | focus_entity(...) | toggle_layer(...) | set_timeline(...)",
        note: "COCKPIT tools: they enqueue browser commands and fail with no_active_session when no tab is attached.",
    },
    {
        intent: "Narrow what the live globe is showing?",
        call: "get_plugin_filters({ pluginId }) then set_filter({ pluginId, filters })",
        note: "Affects the rendered layer. To narrow a QUERY instead, pass filters to query_entities.",
    },
];

/**
 * Maps the engine/plugin reason reported by listStreamingPlugins onto the frozen
 * envelope vocabulary. Never guesses "no data": an absent reason becomes
 * "unknown", because reporting an outage as an empty result is the exact v1
 * defect this overhaul exists to remove.
 */
export function mapEngineReason(reason: string | undefined): McpEmptyReason {
    if (reason === "engine_unreachable") return "engine_unreachable";
    if (reason === "no_active_plugins") return "plugin_not_streaming";
    return "unknown";
}

/** Extra hint for the "engine is up, nothing is streaming" case -- not an outage. */
export const NO_ACTIVE_PLUGINS_HINT =
    "The data engine is reachable but no plugin is streaming right now. This is NOT an outage and NOT an empty query result.";

/** The engine is down -- deliberately distinct from NO_ACTIVE_PLUGINS_HINT. */
export const ENGINE_UNREACHABLE_HINT =
    "The data engine is unreachable. This is an OUTAGE: data tools will fail or report engine_unreachable until it recovers -- do not report this as no data found.";

export interface OrientFeed {
    pluginId: string;
    source: StreamingPlugin["source"];
    entityCount: number;
}

export interface OrientPayload {
    server: { name: string; version: string };
    feeds: {
        /** "unreachable" is an OUTAGE. "ok" with zero plugins is not. */
        engine: "ok" | "unreachable" | "unknown";
        count: number;
        streaming: OrientFeed[];
        hint: string;
    };
    session: {
        activeCount: number;
        /** True only when a command tool would actually have a visible effect. */
        tabAttached: boolean;
        /** The tab a command tool targets when sessionId is omitted. */
        attachedSessionId: string | null;
        camera: Record<string, number> | null;
        layers: string[];
    };
    /** Intent -> exact call. What the caller should do next. */
    nextStep: readonly IntentGuidance[];
    /** The canonical multi-step sequence, for a caller that wants the long path. */
    workflow: readonly WorkflowStep[];
    /** Size of the advertised surface, so the caller knows how much there is to learn. */
    advertisedToolCount: number;
}

export interface OrientResult {
    payload: OrientPayload;
    /** Present only when nothing is streaming: the reason travels with the result. */
    emptyReason?: McpEmptyReason;
}

/**
 * Builds the orient payload. Never throws: a session or engine failure degrades
 * to a STATED reason rather than an error, because "I could not check" is itself
 * orientation information an agent must be able to act on.
 */
export async function composeOrient(
    userId: string,
    serverVersion: string,
    serverName = "worldwideview",
): Promise<OrientResult> {
    const [context, attachedSessionId] = await Promise.all([
        composeGlobeContext(userId),
        resolveActiveSessionId(userId),
    ]);

    const engine: OrientPayload["feeds"]["engine"] =
        context.reason === "engine_unreachable"
            ? "unreachable"
            : context.reason === undefined
              ? "ok"
              : "unknown";

    const streaming: OrientFeed[] = context.plugins.map((p) => ({
        pluginId: p.pluginId,
        source: p.source,
        entityCount: p.entityCount,
    }));

    const feedsHint =
        streaming.length > 0
            ? String(streaming.length) +
              " plugin(s) streaming. Pass one of these pluginId values to query_entities, get_plugin_data, or get_regional_analytics."
            : engine === "unreachable"
              ? ENGINE_UNREACHABLE_HINT
              : NO_ACTIVE_PLUGINS_HINT;

    const payload: OrientPayload = {
        server: { name: serverName, version: serverVersion },
        feeds: { engine, count: streaming.length, streaming, hint: feedsHint },
        session: {
            activeCount: context.sessionCount,
            tabAttached: attachedSessionId !== null,
            attachedSessionId,
            camera: context.camera,
            layers: Object.keys(context.layers),
        },
        nextStep: INTENT_GUIDANCE,
        workflow: canonicalWorkflow,
        advertisedToolCount: catalog.length,
    };

    if (streaming.length > 0) return { payload };
    return { payload, emptyReason: mapEngineReason(context.reason) };
}
