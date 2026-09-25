/**
 * Client-side Better Auth SDK instance.
 *
 * This is the browser-side auth client used by React components. It reads
 * cookies automatically and provides signIn, signUp, signOut, and useSession
 * methods.
 *
 * The base URL is the page's OWN origin. A session cookie can only be set for
 * the host the user is actually on: pointing the auth client at a different
 * host (the app opened at http://127.0.0.1:3000 while NEXT_PUBLIC_APP_URL says
 * http://localhost:3000) turns every sign-in into a cross-origin request the
 * auth server rejects, and any cookie issued would land on a host the browser
 * is not using. A configured URL is therefore honoured only when its host
 * matches the page host. NEXT_PUBLIC_AUTH_BASE_URL is the explicit escape
 * hatch for a deliberately separate auth server.
 *
 * @module auth-client
 */

import { createAuthClient } from "better-auth/react";

/** Fallback base URL, used during SSR when nothing is configured at all. */
const DEFAULT_BASE_URL = "http://localhost:3000";

/** Inputs the base-URL decision is made from. */
export interface AuthBaseUrlInput {
    /** `window.location.origin` in the browser; null/absent during SSR. */
    pageOrigin?: string | null;
    /** NEXT_PUBLIC_APP_URL — the configured public app URL. */
    configuredUrl?: string | null;
    /** NEXT_PUBLIC_AUTH_BASE_URL — explicit opt-in to a cross-host auth server. */
    overrideUrl?: string | null;
}

/** Which input supplied the base URL. */
export type AuthBaseUrlSource = "override" | "configured" | "page-origin" | "default";

export interface AuthBaseUrlResolution {
    baseURL: string;
    source: AuthBaseUrlSource;
    /** Set when a configured URL was ignored because it is not the page host. */
    ignoredConfiguredUrl?: string;
}

/** Trim and drop trailing slashes, so URLs compare and concatenate cleanly. */
function normalize(url: string): string {
    return url.trim().replace(/\/+$/, "");
}

/** Host (hostname plus port) of a URL, or null when it cannot be parsed. */
function hostOf(url: string): string | null {
    try {
        return new URL(url).host.toLowerCase();
    } catch {
        return null;
    }
}

/**
 * Decide the auth base URL for the current context.
 *
 * Rules, in order:
 *  1. `overrideUrl` wins — an explicit, deliberate cross-host configuration.
 *  2. In a browser, a configured URL is used only when its host (hostname and
 *     port) equals the page host; otherwise the page origin is used and the
 *     ignored URL is reported back to the caller.
 *  3. With no page context (SSR), the configured URL is used.
 *  4. With nothing configured, the local dev default applies.
 */
export function resolveAuthBaseUrl(input: AuthBaseUrlInput): AuthBaseUrlResolution {
    const override = input.overrideUrl ? normalize(input.overrideUrl) : "";
    if (override) return { baseURL: override, source: "override" };

    const configured = input.configuredUrl ? normalize(input.configuredUrl) : "";
    const pageOrigin = input.pageOrigin ? normalize(input.pageOrigin) : "";

    if (pageOrigin) {
        const sameHost =
            configured !== "" &&
            hostOf(configured) !== null &&
            hostOf(configured) === hostOf(pageOrigin);
        if (sameHost) return { baseURL: configured, source: "configured" };
        return configured
            ? { baseURL: pageOrigin, source: "page-origin", ignoredConfiguredUrl: configured }
            : { baseURL: pageOrigin, source: "page-origin" };
    }

    if (configured) return { baseURL: configured, source: "configured" };
    return { baseURL: DEFAULT_BASE_URL, source: "default" };
}

/** Read the base-URL inputs from the current runtime (browser or server). */
function currentBaseUrlInput(): AuthBaseUrlInput {
    return {
        pageOrigin: typeof window === "undefined" ? null : window.location.origin,
        configuredUrl: process.env.NEXT_PUBLIC_APP_URL || null,
        overrideUrl: process.env.NEXT_PUBLIC_AUTH_BASE_URL || null,
    };
}

/**
 * Resolve the auth base URL and make an ignored configured URL visible.
 *
 * Silence here is what let a mismatched NEXT_PUBLIC_APP_URL break sign-in with
 * no explanation, so the mismatch is logged together with the fix.
 */
function resolveBaseUrl(): string {
    const resolution = resolveAuthBaseUrl(currentBaseUrlInput());
    if (resolution.ignoredConfiguredUrl) {
        console.warn(
            `[auth] NEXT_PUBLIC_APP_URL=${resolution.ignoredConfiguredUrl} is not the host ` +
                `this page is served from (${window.location.origin}); using the page origin so the ` +
                "session cookie lands on the host you are on. Set NEXT_PUBLIC_AUTH_BASE_URL to " +
                "deliberately point at a separate auth server.",
        );
    }
    return resolution.baseURL;
}

/**
 * Configured Better Auth client instance.
 *
 * Use in client components to sign in, sign up, sign out, and read session:
 * ```ts
 * authClient.signIn.email({ email, password })
 * authClient.signUp.email({ email, password, name })
 * authClient.signOut()
 * const { data, isPending } = authClient.useSession()
 * ```
 */
export const authClient = createAuthClient({
    baseURL: resolveBaseUrl(),
    basePath: "/api/ba",
});

/**
 * Get the auth client base URL configuration.
 *
 * Returns the resolved base URL object for programmatic use (e.g.,
 * constructing full auth API endpoint URLs).
 *
 * @returns {{ baseURL: string }} The base URL config object
 */
export function getAuthClientUrl(): { baseURL: string } {
    return { baseURL: resolveBaseUrl() };
}
