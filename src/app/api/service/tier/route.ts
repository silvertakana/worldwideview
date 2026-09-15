import { NextRequest, NextResponse } from "next/server";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { getActiveOrgId } from "@/lib/ba-org";
import { getOrgTier, resolveOrgIdByEmail } from "@/lib/org-tier";
import { prisma } from "@/lib/db";

type OrgResolution =
  | { ok: true; orgId: string }
  | { ok: false; response: NextResponse };

/**
 * Decide which organization this request is asking about.
 *
 * `organizationId` and `email` are part of the hub-to-globe contract. The hub is
 * trusted because it signs the request, so it may name any organization. A
 * session caller is an ordinary signed-in user and those parameters are not its
 * to use: honouring them would let any user read another organization's tier
 * and instance count. A session caller is therefore always answered about its
 * own active organization, and naming a different one is an authorization
 * failure rather than a malformed request.
 */
async function resolveRequestedOrg(
  request: NextRequest,
  isServiceAuth: boolean,
): Promise<OrgResolution> {
  const { searchParams } = new URL(request.url);
  const orgIdParam = searchParams.get("organizationId");
  const emailParam = searchParams.get("email");

  if (!isServiceAuth) {
    const sessionOrgId = await getActiveOrgId();
    if (!sessionOrgId) {
      return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    if (orgIdParam && orgIdParam !== sessionOrgId) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    return { ok: true, orgId: sessionOrgId };
  }

  if (orgIdParam) {
    return { ok: true, orgId: orgIdParam };
  }

  if (emailParam) {
    const resolvedOrgId = await resolveOrgIdByEmail(emailParam);
    if (!resolvedOrgId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Organization not found for email" }, { status: 404 }),
      };
    }
    return { ok: true, orgId: resolvedOrgId };
  }

  const activeOrgId = await getActiveOrgId();
  if (!activeOrgId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unable to determine organization" }, { status: 400 }),
    };
  }

  return { ok: true, orgId: activeOrgId };
}

async function countOrganizationInstances(orgId: string): Promise<number> {
  const ownerMembers = await prisma.pluginMember.findMany({
    where: { organizationId: orgId, role: "owner" },
    select: { userId: true },
  });

  if (ownerMembers.length === 0) {
    return 0;
  }

  return prisma.workspace.count({
    where: { ownerId: { in: ownerMembers.map((m) => m.userId) } },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await crossServiceAuth(request);
  const isServiceAuth = !authError;

  const resolved = await resolveRequestedOrg(request, isServiceAuth);
  if (!resolved.ok) {
    return resolved.response;
  }

  const tierData = await getOrgTier(resolved.orgId);
  const isExpiredTrial =
    tierData.status === "trialing" && tierData.trialEndsAt && tierData.trialEndsAt < new Date();

  return NextResponse.json({
    ...tierData,
    effectiveTier: isExpiredTrial ? "free" : tierData.tier,
    effectiveStatus: isExpiredTrial ? "expired" : tierData.status,
    instanceCount: await countOrganizationInstances(resolved.orgId),
  });
}
