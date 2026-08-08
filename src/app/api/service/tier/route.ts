import { NextRequest, NextResponse } from "next/server";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { getActiveOrgId } from "@/lib/ba-org";
import { getOrgTier, resolveOrgIdByEmail } from "@/lib/org-tier";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await crossServiceAuth(request);
  const isServiceAuth = !authError;

  if (!isServiceAuth) {
    const sessionOrgId = await getActiveOrgId();
    if (!sessionOrgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const orgIdParam = searchParams.get("organizationId");
  const emailParam = searchParams.get("email");

  let orgId: string | null = null;

  if (orgIdParam) {
    orgId = orgIdParam;
  } else if (emailParam) {
    orgId = await resolveOrgIdByEmail(emailParam);
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found for email" }, { status: 404 });
    }
  } else {
    orgId = await getActiveOrgId();
  }

  if (!orgId) {
    return NextResponse.json({ error: "Unable to determine organization" }, { status: 400 });
  }

  const ownerMembers = await prisma.pluginMember.findMany({
    where: { organizationId: orgId, role: "owner" },
    select: { userId: true },
  });

  const instanceCount =
    ownerMembers.length > 0
      ? await prisma.workspace.count({
          where: { ownerId: { in: ownerMembers.map((m) => m.userId) } },
        })
      : 0;

  const tierData = await getOrgTier(orgId);
  const isExpiredTrial = tierData.status === "trialing" && tierData.trialEndsAt && tierData.trialEndsAt < new Date();
  const effectiveTier = isExpiredTrial ? "free" : tierData.tier;
  const effectiveStatus = isExpiredTrial ? "expired" : tierData.status;

  return NextResponse.json({
    ...tierData,
    effectiveTier,
    effectiveStatus,
    instanceCount,
  });
}
