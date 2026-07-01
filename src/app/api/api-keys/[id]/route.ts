import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { prisma } from "@/lib/db";
import { isDemo } from "@/core/edition";
import { apiKeyManagementLimiter, getClientIp } from "@/lib/rateLimiters";

// ---------------------------------------------------------------------------
// DELETE /api/api-keys/[id] — KEY-03 (ownership-scoped revoke, hard delete)
// ---------------------------------------------------------------------------

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const limited = apiKeyManagementLimiter.check(getClientIp(request));
    if (limited) return limited;

    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Atomic ownership-scoped delete — T-16-06 (BOLA prevention).
        // Using deleteMany (not delete) so a non-matching id returns count 0
        // instead of throwing a NotFound error, eliminating TOCTOU.
        const deleted = await prisma.userApiKey.deleteMany({
            where: { id, userId: session.user.id },
        });

        if (deleted.count === 0) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[api-keys] DELETE error:", err);
        return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
    }
}

export const runtime = "nodejs";
