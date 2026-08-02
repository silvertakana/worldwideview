import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { TIER_RANK } from "@/lib/org-tier";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const authError = await crossServiceAuth(request);
    if (authError) return authError;

    const { id } = await params;

    const body = (await request.json()) as { tier?: string };
    const { tier } = body;

    if (!tier || TIER_RANK[tier] === undefined) {
        return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id } });
    if (!workspace) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const currentRank = TIER_RANK[workspace.tier] ?? 0;
    const newRank = TIER_RANK[tier] ?? 0;
    const isDowngrade = newRank < currentRank;

    const updated = await prisma.workspace.update({
        where: { id },
        data: {
            tier,
            tierStampedAt: new Date(),
            locked: isDowngrade,
            lockedReason: isDowngrade
                ? `Tier changed from ${workspace.tier} to ${tier}. Re-upgrade to restore access.`
                : null,
            lockedAt: isDowngrade ? new Date() : null,
        },
    });

    return NextResponse.json({
        id: updated.id,
        tier: updated.tier,
        locked: updated.locked,
        lockedReason: updated.lockedReason,
    });
}
