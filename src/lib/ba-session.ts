/**
 * Server-side session helpers for Better Auth.
 *
 * Uses Better Auth's `auth.api.getSession()`. Requires Node.js runtime
 * because Prisma validates the session cookie against the database.
 *
 * @module ba-session
 */

import { auth } from "@/lib/better-auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Better Auth session shape returned by getServerSession().
 */
export interface BetterAuthSession {
    user: {
        id: string;
        email: string;
        name?: string | null;
        image?: string | null;
        role?: string;
    } | null;
    session: {
        id: string;
        token: string;
    } | null;
}

/**
 * Read the current session from the request cookies using Better Auth.
 *
 * Calls `auth.api.getSession()` which cryptographically validates the session
 * cookie against the database (via Prisma). Returns the full session object
 * containing `user` and `session` fields, or null if no valid session exists.
 *
 * **Requires Node.js runtime** — this function uses Prisma to query the
 * database and must not be called from Edge Runtime.
 *
 * @returns The Better Auth session object, or null if unauthenticated
 */
export async function getServerSession(): Promise<BetterAuthSession | null> {
    const headersList = await headers();
    const session = await auth.api.getSession({
        headers: headersList,
    });
    return session as BetterAuthSession | null;
}

/**
 * Require a valid session and extract the user ID.
 *
 * Pass the result of `getServerSession()` to this function. It returns either:
 * - `{ userId: string }` — when a valid session exists
 * - A 401 `NextResponse` — when the session is null/missing
 *
 * Use in API routes as a one-line auth gate:
 * ```ts
 * const result = requireSession(await getServerSession());
 * if (result instanceof NextResponse) return result;
 * const { userId } = result;
 * ```
 *
 * @param session - The session object from getServerSession() or null
 * @returns User ID payload or 401 response
 */
export function requireSession(
    session: BetterAuthSession | null,
): { userId: string } | NextResponse {
    const userId = session?.user?.id;
    if (!userId) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
        );
    }
    return { userId };
}
