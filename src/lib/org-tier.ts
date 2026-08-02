import { prisma } from "@/lib/db";

export interface OrgTierData {
  tier: string;
  status: string;
  trialEndsAt: Date | null;
}

export interface TierInput {
  tier: string;
  status: string;
  trialEndsAt?: Date | null;
}

export const TIER_RANK: Record<string, number> = {
  free: 0,
  canceled: 0,
  beta_tester: 1,
  early_access: 2,
  pro: 3,
  enterprise: 4,
};

function effectiveTierForLock(tier: string, status: string): string {
  if (status === "canceled") return "free";
  return tier;
}

export async function getOrgTier(orgId: string): Promise<OrgTierData> {
  const record = await prisma.orgTier.findUnique({
    where: { organizationId: orgId },
  });

  if (!record) {
    return { tier: "free", status: "active", trialEndsAt: null };
  }

  return {
    tier: record.tier,
    status: record.status,
    trialEndsAt: record.trialEndsAt,
  };
}

export async function setOrgTier(orgId: string, data: TierInput): Promise<void> {
  const previous = await prisma.orgTier.findUnique({
    where: { organizationId: orgId },
  });

  await prisma.orgTier.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      tier: data.tier,
      status: data.status ?? "active",
      trialEndsAt: data.trialEndsAt ?? null,
    },
    update: {
      tier: data.tier,
      status: data.status ?? "active",
      trialEndsAt: data.trialEndsAt ?? null,
    },
  });

  const previousTier = previous?.tier ?? "free";
  const previousStatus = previous?.status ?? "active";
  const newEffectiveTier = effectiveTierForLock(data.tier, data.status ?? "active");
  const previousEffectiveTier = effectiveTierForLock(previousTier, previousStatus);

  const previousRank = TIER_RANK[previousEffectiveTier] ?? 0;
  const newRank = TIER_RANK[newEffectiveTier] ?? 0;
  const isDowngrade = newRank < previousRank;

  const ownerMembers = await prisma.pluginMember.findMany({
    where: { organizationId: orgId, role: "owner" },
    select: { userId: true },
  });

  if (ownerMembers.length > 0) {
    const ownerIds = ownerMembers.map((m: { userId: string }) => m.userId);

    await prisma.workspace.updateMany({
      where: { ownerId: { in: ownerIds } },
      data: {
        locked: isDowngrade,
        lockedReason: isDowngrade
          ? `Tier downgraded from ${previousTier} (${previousStatus}) to ${data.tier} (${data.status ?? "active"}). Re-upgrade to restore access.`
          : null,
        lockedAt: isDowngrade ? new Date() : null,
      },
    });
  }
}

export async function resolveOrgIdByEmail(email: string): Promise<string | null> {
  const user = await prisma.betterAuthUser.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) return null;

  const membership = await prisma.pluginMember.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });

  return membership?.organizationId ?? null;
}

export async function getEffectiveTier(orgId: string): Promise<{ tier: string; status: string }> {
  const { tier, status, trialEndsAt } = await getOrgTier(orgId);

  if (status === "trialing" && trialEndsAt && trialEndsAt < new Date()) {
    return { tier: "free", status: "expired" };
  }

  return { tier, status };
}
