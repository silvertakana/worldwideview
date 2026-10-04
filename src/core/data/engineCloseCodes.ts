/**
 * @file engineCloseCodes.ts
 * @description Recovery semantics for the data engine's WebSocket close codes.
 * The engine already says why it hung up; acting on that code is what keeps a
 * refused connection visible instead of turning it into an endless reconnect
 * loop that shows the user an empty globe with no explanation.
 * @module src/core/data
 */

/** The ticket expired mid-connection. */
export const WS_CLOSE_TOKEN_EXPIRED = 4001;
/** Auth failed, was never attempted, or re-auth was refused. */
export const WS_CLOSE_AUTH_REQUIRED = 4003;
/** The engine does not serve the subscribed plugin id. */
export const WS_CLOSE_INVALID_PLUGIN_ID = 4400;
/** Too many concurrent subscriptions on one connection. */
export const WS_CLOSE_SUBSCRIPTION_LIMIT = 4401;
/** The per-connection message rate limit was exceeded. */
export const WS_CLOSE_RATE_LIMIT = 4402;
/** The ticket's scope does not cover the requested channel. */
export const WS_CLOSE_NOT_IN_SCOPE = 4403;

export type CloseRecovery =
    /** Credentials are missing or stale: obtain a fresh ticket, then retry. */
    | "refresh-ticket"
    /** Retrying cannot succeed: surface it to the user and stop reconnecting. */
    | "block"
    /** Transient overload: retry, but more slowly. */
    | "backoff"
    /** Ordinary disconnect: retry on the usual backoff. */
    | "retry";

/**
 * Maps a close code to the action that can actually help.
 *
 * Anything unrecognised (including a code-less close, e.g. a network drop) is
 * treated as an ordinary disconnect so unknown future codes stay retryable.
 */
export function classifyEngineClose(code: number | undefined): CloseRecovery {
    switch (code) {
        case WS_CLOSE_AUTH_REQUIRED:
        case WS_CLOSE_TOKEN_EXPIRED:
            return "refresh-ticket";
        case WS_CLOSE_NOT_IN_SCOPE:
        case WS_CLOSE_INVALID_PLUGIN_ID:
        case WS_CLOSE_SUBSCRIPTION_LIMIT:
            return "block";
        case WS_CLOSE_RATE_LIMIT:
            return "backoff";
        default:
            return "retry";
    }
}
