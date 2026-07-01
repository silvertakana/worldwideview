/**
 * Client-side Better Auth SDK instance.
 *
 * This is the browser-side auth client used by React components. It reads
 * cookies automatically and provides signIn, signUp, signOut, and useSession
 * methods.
 *
 * The baseURL should match the globe app's origin. In development this is
 * typically http://localhost:3000; in production it is the deployed app URL.
 *
 * @module auth-client
 */

import { createAuthClient } from "better-auth/react";

/**
 * Get the base URL for the auth server.
 *
 * Reads from NEXT_PUBLIC_APP_URL env var, falls back to localhost:3000.
 * Trailing slashes are stripped for consistency.
 */
function resolveBaseUrl(): string {
    const raw = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return raw.replace(/\/+$/, "");
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
