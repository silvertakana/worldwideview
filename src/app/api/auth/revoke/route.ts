import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/db";
import { isCloud } from "@/core/edition";

/**
 * POST /api/auth/revoke: "sign out everywhere".
 *
 * Deletes all Better Auth session records for this user, then calls
 * `auth.api.signOut()` to invalidate the current session server-side.
 * Requires an authenticated session.
 */
export async function POST(request: NextRequest) {
    const session = await getServerSession();
    const userId = session?.user?.id;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cloud identities are managed by Supabase; there are no local session rows.
    if (!isCloud) {
        await prisma.betterAuthSession.deleteMany({ where: { userId } });
    }

    // Invalidate the current session server-side using actual request headers
    await auth.api.signOut({ headers: request.headers });
    return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
