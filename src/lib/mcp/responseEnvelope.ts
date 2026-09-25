/**
 * MCP v2 unified response envelope.
 *
 * WHY THIS EXISTS (AX overhaul, 2026-09-25)
 * v1 answered "this didn't work" in three contradictory shapes:
 *   { error }                          -- no success field at all
 *   { success: true, entities: [], emptyReason }   -- empty
 *   { success: false, error }          -- failure
 * An agent could not tell a genuine failure from a successful empty search,
 * and resolveDataQueryEmptyReason() defaulted an UNKNOWN reason to
 * "no_data_matches", so "the plugin isn't running" was silently reported as
 * "nothing matched". That is an actively misleading answer to an agent that
 * will believe it.
 *
 * v2 rules, applied by every tool in this server:
 *   1. Success is { ok: true, data, meta }. Failure is { ok: false, error, ... }.
 *      An agent branches on one field: ok.
 *   2. Empty is a SUCCESS with a reason. A reason is NEVER inferred as
 *      "no data" -- an unknown reason is reported as "unknown".
 *   3. Every failure carries a hint and, where the fix is a vocabulary the
 *      caller cannot know, the valid values themselves.
 *   4. Every result is returned both as text (compatible) and as
 *      structuredContent (machine-readable, SDK >= 1.x).
 *
 * File: src/lib/mcp/responseEnvelope.ts
 */

import type { EmptyReason } from "@/lib/data-query/types";

/**
 * The shape every MCP tool handler in this server returns.
 *
 * Declared as a type ALIAS, not an interface, deliberately: the SDK's
 * registerTool expects a handler returning an object assignable to
 * { [x: string]: unknown; content: ContentBlock[]; ... }. TypeScript grants an
 * implicit index signature to object-literal type aliases but NOT to
 * interfaces, so an interface here makes every handler in the server
 * unassignable to the SDK's signature (TS2345 at all 20-odd registerTool
 * calls). Changing this word back to "interface" breaks the build.
 */
export type McpTextResult = {
    content: [{ type: "text"; text: string }];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
};

/**
 * Machine-readable failure codes. Deliberately small and closed: an agent can
 * enumerate these, and each one maps to a different recovery action.
 */
export type McpErrorCode =
    | "invalid_parameters"
    | "unknown_plugin"
    | "plugin_offline"
    | "engine_unreachable"
    | "no_active_session"
    | "not_found"
    | "rate_limited"
    | "relay_timeout"
    | "internal_error";

/**
 * Why a successful result carried nothing.
 *
 * - no_data_matches:      the feed is live and the query matched nothing. Normal.
 * - plugin_not_streaming: the plugin is absent or not streaming. Not an outage.
 * - engine_unreachable:   the data engine itself is down. An OUTAGE.
 * - unknown:              the service gave no reason. We refuse to guess.
 */
export type McpEmptyReason =
    | "no_data_matches"
    | "plugin_not_streaming"
    | "engine_unreachable"
    | "unknown";

/** Non-entity metadata attached to a successful result. */
export interface McpMeta {
    /** Number of items actually returned in this response. */
    count?: number;
    /** Total items that matched before the cap. Present only when truncated. */
    totalMatched?: number;
    /** True when the returned list is a capped sample, not the full match set. */
    truncated?: boolean;
    /** Present only when the result is empty. */
    emptyReason?: McpEmptyReason;
    /** Agent-facing explanation of how to read an empty result. */
    hint?: string;
    /** Fields the caller asked to project but which this entity type does not have. */
    unknownFields?: string[];
    /** Capture time of the underlying snapshot, when the source reports one. */
    capturedAt?: string;
    /** Ordering guarantee of the returned list. */
    order?: "distance" | "unspecified";
}

/**
 * How to read each empty result. This is the "explain how to read a result, not
 * just how to call it" rule: the reason is useless to an agent without the move
 * that follows it.
 */
export const EMPTY_HINTS: Record<McpEmptyReason, string> = {
    no_data_matches:
        "The feed is live and returned no matches. Widen the bounding box or radius, drop filters, or query a different time window. Do not conclude the feature is broken.",
    plugin_not_streaming:
        "This plugin is not currently streaming data. Call orient to see which plugins are live, then retry using one of those pluginId values.",
    engine_unreachable:
        "The data engine is unreachable. This is an OUTAGE, not an empty result -- do not report 'no data found'. Retry shortly, or tell the user the data source is down.",
    unknown:
        "The data source did not report why this result is empty. Treat it as unknown rather than as 'no data'. Call orient to check engine and plugin health.",
};

/**
 * Maps a service-layer empty reason onto the envelope vocabulary.
 *
 * NEVER returns "no_data_matches" for a missing reason: that substitution is
 * exactly the v1 defect that reported an outage as an empty result.
 */
export function resolveEmptyReason(serviceReason: EmptyReason | undefined): McpEmptyReason {
    if (serviceReason === "plugin_not_streaming") return "plugin_not_streaming";
    if (serviceReason === "no_data_matches") return "no_data_matches";
    if (serviceReason === "no_session_active") return "unknown";
    return "unknown";
}

/** Success envelope. */
export function mcpOk<T>(data: T, meta: McpMeta = {}): McpTextResult {
    const payload: Record<string, unknown> = { ok: true, data };
    if (Object.keys(meta).length > 0) payload.meta = meta;
    return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
    };
}

/**
 * Empty-but-successful envelope. Use for every "nothing matched" path so the
 * reason and its hint travel with the result.
 */
export function mcpEmpty<T>(data: T, emptyReason: McpEmptyReason, meta: McpMeta = {}): McpTextResult {
    return mcpOk(data, {
        ...meta,
        count: meta.count ?? 0,
        emptyReason,
        hint: meta.hint ?? EMPTY_HINTS[emptyReason],
    });
}

/** Options for a failure envelope. */
export interface McpFailOptions {
    hint?: string;
    /** Valid values the caller could have used instead. Kills the guess-and-retry loop. */
    validValues?: readonly string[];
    /** Extra machine-readable context (e.g. active session ids, app URL). */
    details?: Record<string, unknown>;
}

/** Failure envelope. */
export function mcpFail(
    error: McpErrorCode,
    message: string,
    options: McpFailOptions = {},
): McpTextResult {
    const payload: Record<string, unknown> = { ok: false, error, message };
    if (options.hint) payload.hint = options.hint;
    if (options.validValues && options.validValues.length > 0) {
        payload.validValues = [...options.validValues];
    }
    if (options.details) payload.details = options.details;
    return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
        isError: true,
    };
}

/**
 * Failure envelope for a caught throw. Logs server-side, never leaks the raw
 * error text to the caller (it can contain upstream URLs and credentials).
 */
export function mcpCatch(
    error: McpErrorCode,
    message: string,
    cause: unknown,
    options: McpFailOptions = {},
): McpTextResult {
    console.error(`[mcp] ${message}:`, cause);
    return mcpFail(error, message, options);
}

/** The application URL an agent should point a human at when a session is needed. */
export const MCP_APP_URL =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://cloud-wwv.dev";

/**
 * Unknown pluginId failure. Returns the valid vocabulary so the next turn lands
 * correctly instead of the agent guessing a second time.
 */
export function unknownPluginError(
    pluginId: string,
    validPlugins: readonly string[],
): McpTextResult {
    return mcpFail("unknown_plugin", `Unknown pluginId "${pluginId}".`, {
        hint:
            validPlugins.length > 0
                ? "Retry with one of validValues, or call orient to see which plugins are streaming right now."
                : "No plugins are currently streaming. Call orient to check engine health before retrying.",
        validValues: validPlugins,
    });
}

/** No live browser tab. Cockpit commands cannot have a visible effect without one. */
export function noActiveSessionError(activeSessionIds: readonly string[] = []): McpTextResult {
    return mcpFail(
        "no_active_session",
        "No active WorldWideView globe session is connected, so this command would have no visible effect.",
        {
            hint:
                "Ask the user to open the globe in a browser tab, then retry. Data-query tools (orient, investigate_area, query_entities) work without a session -- only cockpit commands need one.",
            validValues: activeSessionIds,
            details: { appUrl: MCP_APP_URL, activeSessionIds: [...activeSessionIds] },
        },
    );
}

/** True when a tool result is the failure envelope (used by tests and the relay). */
export function isMcpFailure(result: McpTextResult): boolean {
    if (result.isError === true) return true;
    const structured = result.structuredContent;
    return typeof structured === "object" && structured !== null && structured.ok === false;
}
