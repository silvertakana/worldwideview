/**
 * Better Auth session checking helpers for proxy.ts.
 *
 * Only checks Better Auth session cookies — NextAuth was removed.
 * getSessionCookie() from better-auth/cookies is Edge Runtime compatible
 * (pure cookie string parser, no Prisma or Node.js deps).
 */
import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";

/**
 * Create a minimal request-like object for testing.
 * Provides the headers API that getSessionCookie() expects.
 */
export function createTestRequest(): NextRequest {
    return {
        cookies: {
            get: () => undefined,
        },
        headers: {
            get: () => null,
        },
        nextUrl: { pathname: "/" },
    } as unknown as NextRequest;
}

/**
 * Check if the request carries a Better Auth session cookie.
 *
 * NOTE: This checks only cookie PRESENCE, not cryptographic validity.
 * A renamed surface-level guard to avoid implying JWT verification.
 *
 * Uses getSessionCookie() from better-auth/cookies — a pure sync
 * cookie-header parser that does NOT require Node.js runtime or Prisma.
 *
 * Returns true when a session cookie exists, false otherwise.
 */
export function hasBetterAuthCookie(req: NextRequest): boolean {
    const sessionCookie = getSessionCookie(req);
    return sessionCookie !== null && sessionCookie !== undefined;
}
