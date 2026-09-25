/**
 * @file endpoint.ts
 * @description Single source of truth for the MCP endpoint URL the "Connect your
 * agent" panel advertises (CONNECT-01 / T-17-04).
 *
 * The panel previously fell back to a hardcoded third-party host for the cloud
 * edition, so a local or self-hosted install advertised a URL that was never
 * theirs. A cloud instance is served from its own origin
 * (https://<name>.cloud-wwv.dev) and its MCP route is /api/mcp on that same app,
 * so the page origin is the correct answer in nearly every case.
 *
 * Precedence, decided by the owner:
 *   1. NEXT_PUBLIC_MCP_API_URL, when it is an absolute http(s) URL (operator override);
 *   2. page origin + /api/mcp (proven from the browser, never guessed);
 *   3. an explicit "undetected" result carrying an explanation and the expected
 *      shape for the edition -- the panel says it cannot detect the URL rather
 *      than inventing a host.
 *
 * Security invariant (CONNECT-01 / T-17-04): this module builds URLs only. It
 * accepts no token parameter, so a token can never reach the URL or a query
 * string; the token belongs in the Authorization header value.
 */

import type { Edition } from "@/core/edition";

/** Path of the MCP streamable-HTTP route on every WorldWideView deployment. */
export const MCP_API_PATH = "/api/mcp";

/** Why the endpoint could not be detected. */
export type McpUndetectedReason =
    | "no-config-no-origin"
    | "invalid-configured-url";

/** Inputs to the resolver. Every input is passed in, so the resolver stays pure. */
export interface McpEndpointInput {
    /** Explicit override, normally process.env.NEXT_PUBLIC_MCP_API_URL. */
    configuredUrl?: string | null;
    /** Browser page origin, normally window.location.origin. */
    pageOrigin?: string | null;
    /** Deployment edition -- selects the shape of the expected-URL example. */
    edition: Edition;
}

/** Result of endpoint detection. */
export type McpEndpointResolution =
    | { kind: "configured"; url: string }
    | { kind: "page-origin"; url: string }
    | {
          kind: "undetected";
          reason: McpUndetectedReason;
          explanation: string;
          example: string;
      };

// ---------------------------------------------------------------------------
// Expected shape per edition
// ---------------------------------------------------------------------------

const MCP_ENDPOINT_EXAMPLES: Record<Edition, string> = {
    cloud: "https://<your-instance>.cloud-wwv.dev/api/mcp",
    local: "http://localhost:3000/api/mcp",
    // Demo never renders the panel (Header gates it on !isDemo); the local shape
    // is the honest example if it ever does.
    demo: "http://localhost:3000/api/mcp",
};

/** The URL shape a working endpoint has on this edition. */
export function mcpEndpointExample(edition: Edition): string {
    return MCP_ENDPOINT_EXAMPLES[edition];
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const REMEDY =
    "Set NEXT_PUBLIC_MCP_API_URL to this instance's full MCP URL, or open this panel from the running instance itself so its own address can be read from the browser.";

const EXPLANATIONS: Record<McpUndetectedReason, string> = {
    "no-config-no-origin":
        "This page cannot detect the MCP endpoint: no NEXT_PUBLIC_MCP_API_URL is configured and there is no page address to derive it from (a server render, a static export, or an opaque browser origin). " +
        REMEDY,
    "invalid-configured-url":
        "This page cannot detect the MCP endpoint: NEXT_PUBLIC_MCP_API_URL is set, but not to an absolute http(s) URL, so it cannot be used. " +
        REMEDY,
};

/** Drops trailing slashes so an origin and MCP_API_PATH never double up. */
function stripTrailingSlashes(value: string): string {
    return value.replace(/\/+$/, "");
}

/**
 * Validates and normalises an explicit override. Returns null when the value is
 * absent or is not something a client could actually dial.
 */
function normalizeConfiguredUrl(raw?: string | null): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    } catch {
        return null;
    }
    return stripTrailingSlashes(trimmed);
}

/**
 * Validates and normalises a page origin. Returns null for anything that is not
 * a real http(s) origin -- including the literal "null" that jsdom and file://
 * pages report -- so the caller never derives a URL from a host it cannot prove.
 */
function normalizePageOrigin(raw?: string | null): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        return stripTrailingSlashes(parsed.origin);
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolves the MCP endpoint for the connect panel.
 *
 * Pure: no DOM access, no env reads. Pass window.location.origin in as
 * `pageOrigin`.
 */
export function resolveMcpEndpoint(input: McpEndpointInput): McpEndpointResolution {
    const example = mcpEndpointExample(input.edition);

    const configured = input.configuredUrl?.trim() ?? "";
    if (configured !== "") {
        const url = normalizeConfiguredUrl(configured);
        if (url !== null) return { kind: "configured", url };
        // An explicit override that cannot be dialled is reported, not silently
        // ignored: a typo'd NEXT_PUBLIC_MCP_API_URL is exactly the class of
        // configuration defect this panel exists to surface, and falling back to
        // the page origin here would hide it.
        return {
            kind: "undetected",
            reason: "invalid-configured-url",
            explanation: EXPLANATIONS["invalid-configured-url"],
            example,
        };
    }

    const origin = normalizePageOrigin(input.pageOrigin);
    if (origin !== null) {
        return { kind: "page-origin", url: origin + MCP_API_PATH };
    }

    return {
        kind: "undetected",
        reason: "no-config-no-origin",
        explanation: EXPLANATIONS["no-config-no-origin"],
        example,
    };
}

/**
 * Reads the current page origin, or null when there is no browser origin to
 * prove (server render, file:// page, sandboxed frame). The panel passes this
 * into resolveMcpEndpoint so the resolver itself never touches the DOM.
 */
export function readBrowserOrigin(): string | null {
    if (typeof window === "undefined") return null;
    return window.location?.origin ?? null;
}
