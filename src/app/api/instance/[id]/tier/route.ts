import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { decideTierLock, TIER_RANK } from "@/lib/org-tier";

/**
 * This route is a second, older lock path next to the organization-level policy
 * in `@/lib/org-tier` (`decideTierLock` / `setOrgTier`), and it stays separate
 * because the two do not have the same shape:
 *
 *   - The policy decides for a whole organization. Its deferral state
 *     (`pendingLockAt` / `pendingLockReason`) is stored on the `org_tiers` row,
 *     and its workspace effect is a cascade over every workspace owned by that
 *     organization's owner members.
 *   - This route addresses exactly one workspace by its own id. It has no
 *     organization and no subscription status in its request, and `workspaces`
 *     has no column that could hold an armed deadline.
 *
 * The lock decision is therefore taken from the shared policy - rank, dunning
 * and the grace window all come from `decideTierLock`, never from a second copy
 * of the rules - but only the non-locking effects are applied. `"locked"` is
 * unreachable here by construction, because no armed deadline can be read, and
 * it must stay unreachable: a lock written from this route would always fire
 * sooner than the grace window the policy grants, which is the bug this route
 * used to have.
 *
 * Unifying the two paths needs one of:
 *   1. route this endpoint through `setOrgTier`, resolving the workspace owner
 *      to their organization - which widens a single-workspace call into a
 *      cascade over that organization's other workspaces; or
 *   2. give `workspaces` its own `pendingLockAt` / `pendingLockReason` columns
 *      and let the deadline sweep enforce them, so this route can persist the
 *      deferral it arms instead of dropping it.
 */
const ROUTE_STATUS = "active";

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

    const now = new Date();
    const decision = decideTierLock(
        {
            tier: workspace.tier,
            status: ROUTE_STATUS,
            periodEndsAt: null,
            pendingLockAt: null,
            pendingLockReason: null,
        },
        { tier, status: ROUTE_STATUS },
        now,
    );

    // "released" is the policy's answer for a downgrade as well as an upgrade:
    // a downgrade arms the grace window instead of locking. Every other effect
    // leaves the stored lock columns alone.
    const released = decision.workspaceEffect === "released";

    const updated = await prisma.workspace.update({
        where: { id },
        data: {
            tier,
            tierStampedAt: now,
            ...(released ? { locked: false, lockedReason: null, lockedAt: null } : {}),
        },
    });

    return NextResponse.json({
        id: updated.id,
        tier: updated.tier,
        locked: updated.locked,
        lockedReason: updated.lockedReason,
    });
}
