/**
 * @file outageResponse.ts
 * @description The one way this server says "the data engine is down".
 *
 * WHY THIS EXISTS
 * The data-query service collapses two different worlds into a single reason:
 * a plugin the engine does not have (a clean 404) and an engine that is not
 * answering at all. Both surface as "plugin_not_streaming", which reads to an
 * agent as a DATA condition -- "nothing is streaming right now" -- when the
 * truth can be an outage. Reporting an outage as an absence of data is the
 * exact v1 defect the v2 surface was built to remove, so every data tool that
 * can reach that state answers the outage as a FAILURE instead.
 *
 * HOW IT IS DETECTED
 * From the plugin vocabulary (which probes the engine), never from a guess. The
 * vocabulary is consulted on the EMPTY path only, so a successful query never
 * pays for it. Tools that already hold the vocabulary pass it in rather than
 * paying for a second sweep.
 *
 * A live end-to-end run with the engine stopped found four of five data tools
 * reporting a dead engine as "not currently streaming". That is what this
 * module exists to prevent.
 */

import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";
import { EMPTY_HINTS, mcpFail, type McpTextResult } from "@/lib/mcp/responseEnvelope";

/** The outage hint, worded once, taken from the envelope's own vocabulary. */
export const ENGINE_UNREACHABLE_HINT = EMPTY_HINTS.engine_unreachable;

/** The minimum a caller must know about a plugin vocabulary to detect an outage. */
export interface PluginVocabulary {
    reason?: string;
}

/**
 * Is this vocabulary telling us the engine itself is down?
 *
 * An absent vocabulary is NOT evidence of an outage, so it answers false rather
 * than throwing: the escalation must never turn a data answer into a failure on
 * a guess.
 */
export function vocabularySaysEngineIsDown(vocabulary: PluginVocabulary | undefined): boolean {
    return vocabulary?.reason === "engine_unreachable";
}

/** The outage failure, so every tool words it the same way. */
export function engineOutageFailure(message: string): McpTextResult {
    return mcpFail("engine_unreachable", message, { hint: ENGINE_UNREACHABLE_HINT });
}

/**
 * The envelope's empty reason, read back off a result.
 *
 * Returns undefined unless the result is a SUCCESS carrying an explicit
 * emptyReason, so a failure is never re-read as an empty.
 */
function emptyReasonOf(result: McpTextResult): string | undefined {
    const structured = result.structuredContent as
        | { ok?: unknown; meta?: { emptyReason?: string } }
        | undefined;
    if (structured?.ok !== true) return undefined;
    return structured.meta?.emptyReason;
}

/**
 * Rescue an empty result that may actually be an outage.
 *
 * Use this where the result is already built and the caller has no vocabulary in
 * hand; pass the vocabulary to escalateWithVocabulary when it does, to avoid a
 * second plugin sweep.
 */
export async function escalateEngineOutage(
    result: McpTextResult,
    message: string,
): Promise<McpTextResult> {
    if (emptyReasonOf(result) !== "plugin_not_streaming") return result;
    const vocabulary = await listStreamingPlugins();
    if (!vocabularySaysEngineIsDown(vocabulary)) return result;
    return engineOutageFailure(message);
}

/** As escalateEngineOutage, for a caller that already fetched the vocabulary. */
export function escalateWithVocabulary(
    result: McpTextResult,
    message: string,
    vocabulary: PluginVocabulary | undefined,
): McpTextResult {
    if (emptyReasonOf(result) !== "plugin_not_streaming") return result;
    if (!vocabularySaysEngineIsDown(vocabulary)) return result;
    return engineOutageFailure(message);
}
