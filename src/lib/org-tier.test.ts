import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockBetterUserFindUnique = vi.hoisted(() => vi.fn());
const mockMemberFindFirst = vi.hoisted(() => vi.fn());
const mockPluginMemberFindMany = vi.hoisted(() => vi.fn());
const mockWorkspaceUpdateMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    orgTier: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
    betterAuthUser: {
      findUnique: mockBetterUserFindUnique,
    },
    pluginMember: {
      findFirst: mockMemberFindFirst,
      findMany: mockPluginMemberFindMany,
    },
    workspace: {
      updateMany: mockWorkspaceUpdateMany,
    },
  },
}));

import { getOrgTier, setOrgTier, resolveOrgIdByEmail, getEffectiveTier } from "./org-tier";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Shared factory
// ---------------------------------------------------------------------------

function makeOrgTier(overrides: Record<string, unknown> = {}) {
  return {
    id: "tier-1",
    organizationId: "org-1",
    tier: "pro",
    status: "active",
    trialEndsAt: null,
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe("getOrgTier", () => {
  it("returns default free tier when no record exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getOrgTier("org-1");
    expect(result).toEqual({ tier: "free", status: "active", trialEndsAt: null });
  });

  it("returns stored tier when record exists", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier());

    const result = await getOrgTier("org-1");
    expect(result).toEqual({ tier: "pro", status: "active", trialEndsAt: null });
  });
});

describe("setOrgTier", () => {
  beforeEach(() => {
    // Default: no previous tier, no org owners  => no cascade
    mockFindUnique.mockResolvedValue(null);
    mockPluginMemberFindMany.mockResolvedValue([]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("upserts tier data", async () => {
    mockUpsert.mockResolvedValue({});

    await setOrgTier("org-1", { tier: "pro", status: "active" });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      create: {
        organizationId: "org-1",
        tier: "pro",
        status: "active",
        trialEndsAt: null,
      },
      update: {
        tier: "pro",
        status: "active",
        trialEndsAt: null,
      },
    });
  });

  it("includes trialEndsAt when provided", async () => {
    mockUpsert.mockResolvedValue({});
    const trialDate = new Date("2025-12-31");

    await setOrgTier("org-1", { tier: "pro", status: "trialing", trialEndsAt: trialDate });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ trialEndsAt: trialDate }),
      }),
    );
  });

  it("locks workspace on downgrade from pro to free", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: { in: ["user-1"] } },
        data: expect.objectContaining({
          locked: true,
          lockedReason: expect.stringContaining("Tier downgraded from pro"),
          lockedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("unlocks workspace on upgrade from free to pro", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "free", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "pro", status: "active" });

    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: { in: ["user-1"] } },
        data: { locked: false, lockedReason: null, lockedAt: null },
      }),
    );
  });

  it("locks workspace when status is canceled (treats as free rank)", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    // Hub sends tier="pro" with status="canceled" — effective rank should be 0 (free)
    await setOrgTier("org-1", { tier: "pro", status: "canceled" });

    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locked: true }),
      }),
    );
  });

  it("unlocks workspace when canceled subscription is reactivated", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "canceled" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    // Reactivation: tier stays "pro" but status goes from "canceled" to "active"
    await setOrgTier("org-1", { tier: "pro", status: "active" });

    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { locked: false, lockedReason: null, lockedAt: null },
      }),
    );
  });

  it("handles org with multiple owners and multiple workspaces", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "enterprise", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 3 });

    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(mockPluginMemberFindMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", role: "owner" },
      select: { userId: true },
    });
    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: { in: ["user-1", "user-2"] } },
        data: expect.objectContaining({ locked: true }),
      }),
    );
  });

  it("handles org with zero workspaces (no-op)", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 0 });

    await setOrgTier("org-1", { tier: "free", status: "active" });

    // updateMany with no matching records is a no-op, not an error
    expect(mockWorkspaceUpdateMany).toHaveBeenCalled();
    expect(mockWorkspaceUpdateMany.mock.results[0].value).resolves.toEqual({ count: 0 });
  });

  it("handles org with zero owners (no cascade)", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([]);

    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(mockWorkspaceUpdateMany).not.toHaveBeenCalled();
  });
});

describe("resolveOrgIdByEmail", () => {
  it("returns orgId when user and membership exist", async () => {
    mockBetterUserFindUnique.mockResolvedValue({ id: "user-1" });
    mockMemberFindFirst.mockResolvedValue({ organizationId: "org-1" });

    const result = await resolveOrgIdByEmail("user@test.com");
    expect(result).toBe("org-1");
  });

  it("returns null when user not found", async () => {
    mockBetterUserFindUnique.mockResolvedValue(null);

    const result = await resolveOrgIdByEmail("unknown@test.com");
    expect(result).toBeNull();
  });

  it("returns null when user has no membership", async () => {
    mockBetterUserFindUnique.mockResolvedValue({ id: "user-1" });
    mockMemberFindFirst.mockResolvedValue(null);

    const result = await resolveOrgIdByEmail("user@test.com");
    expect(result).toBeNull();
  });
});

describe("getEffectiveTier", () => {
  it("returns stored tier and status when active", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier());

    const result = await getEffectiveTier("org-1");
    expect(result).toEqual({ tier: "pro", status: "active" });
  });

  it("returns expired when trial has ended", async () => {
    const pastDate = new Date(Date.now() - 86400000);
    mockFindUnique.mockResolvedValue(makeOrgTier({ status: "trialing", trialEndsAt: pastDate }));

    const result = await getEffectiveTier("org-1");
    expect(result).toEqual({ tier: "free", status: "expired" });
  });

  it("returns default free when no record exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getEffectiveTier("org-1");
    expect(result).toEqual({ tier: "free", status: "active" });
  });
});
