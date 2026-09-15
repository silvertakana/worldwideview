import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockBetterUserFindUnique = vi.hoisted(() => vi.fn());
const mockMemberFindFirst = vi.hoisted(() => vi.fn());
const mockPluginMemberFindMany = vi.hoisted(() => vi.fn());
const mockWorkspaceUpdateMany = vi.hoisted(() => vi.fn());
const mockOrgTierFindMany = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    // $transaction executes the callback inline so tests need no real database
    $transaction: mockTransaction,
    orgTier: {
      findUnique: mockFindUnique,
      findMany: mockOrgTierFindMany,
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

import { prisma } from "@/lib/db";
import {
  getOrgTier,
  setOrgTier,
  resolveOrgIdByEmail,
  getEffectiveTier,
  decideTierLock,
  effectiveTierForLock,
  rankForLock,
  DUNNING_STATUSES,
  NO_ENTITLEMENT_STATUSES,
  TIER_RANK,
  enforceTierLockDeadline,
  findDueTierLockOrganizations,
  type PriorTierState,
} from "./org-tier";

// $transaction runs its callback against the mock client, mirroring the real
// interactive-transaction shape. Cast to never to bypass Prisma's overloads.
function wireTransaction(): void {
  mockTransaction.mockImplementation(
    ((fn: (tx: typeof prisma) => unknown) => fn(prisma)) as never,
  );
}

const GRACE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  wireTransaction();
});

// ---------------------------------------------------------------------------
// Shared factories
// ---------------------------------------------------------------------------

function makeOrgTier(overrides: Record<string, unknown> = {}) {
  return {
    id: "tier-1",
    organizationId: "org-1",
    tier: "pro",
    status: "active",
    trialEndsAt: null,
    periodEndsAt: null,
    pendingLockAt: null,
    pendingLockReason: null,
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

/** The `update` half of the last upsert, typed so assertions stay safe. */
function lastUpsertUpdate(): {
  tier: string;
  status: string;
  trialEndsAt: Date | null;
  periodEndsAt: Date | null;
  pendingLockAt: Date | null;
  pendingLockReason: string | null;
} {
  const calls = mockUpsert.mock.calls;
  const payload = calls[calls.length - 1]?.[0] as {
    update: {
      tier: string;
      status: string;
      trialEndsAt: Date | null;
      periodEndsAt: Date | null;
      pendingLockAt: Date | null;
      pendingLockReason: string | null;
    };
  };
  return payload.update;
}

const RELEASED = { locked: false, lockedReason: null, lockedAt: null };

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

// ---------------------------------------------------------------------------
// Lock policy — pure decision function (no database involved)
// ---------------------------------------------------------------------------

describe("decideTierLock", () => {
  const NOW = new Date("2026-09-15T00:00:00.000Z");

  function prior(overrides: Partial<PriorTierState> = {}): PriorTierState {
    return {
      tier: "pro",
      status: "active",
      periodEndsAt: null,
      pendingLockAt: null,
      pendingLockReason: null,
      ...overrides,
    };
  }

  it("defers the lock instead of locking on the first downgrade", () => {
    const decision = decideTierLock(prior(), { tier: "free", status: "active" }, NOW);

    expect(decision.workspaceEffect).toBe("released");
    expect(decision.pendingLockAt?.getTime()).toBe(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(decision.pendingLockReason).toContain("Tier downgraded from pro (active) to free (active)");
    expect(decision.lockedAt).toBeNull();
  });

  it("anchors the deadline on the first observation of the decline", () => {
    const anchored = new Date(NOW.getTime() + 60_000);

    const decision = decideTierLock(
      prior({ pendingLockAt: anchored }),
      { tier: "free", status: "active" },
      NOW,
    );

    expect(decision.pendingLockAt).toEqual(anchored);
  });

  it("keeps the original deadline when the decline continues", () => {
    const anchored = new Date(NOW.getTime() + 60_000);

    const decision = decideTierLock(
      prior({ tier: "team", pendingLockAt: anchored }),
      { tier: "free", status: "active" },
      NOW,
    );

    expect(decision.pendingLockAt).toEqual(anchored);
    expect(decision.pendingLockReason).toContain("Tier downgraded from team");
  });

  it("releases and disarms when the tier recovers inside the window", () => {
    const decision = decideTierLock(
      prior({ tier: "free", pendingLockAt: new Date(NOW.getTime() + 60_000) }),
      { tier: "team", status: "active" },
      NOW,
    );

    expect(decision.workspaceEffect).toBe("released");
    expect(decision.pendingLockAt).toBeNull();
    expect(decision.pendingLockReason).toBeNull();
  });

  it("does not lock before the deadline elapses", () => {
    const deadline = new Date(NOW.getTime() + 60_000);

    const decision = decideTierLock(
      prior({ tier: "free", pendingLockAt: deadline }),
      { tier: "free", status: "active" },
      NOW,
    );

    expect(decision.workspaceEffect).toBe("unchanged");
    expect(decision.pendingLockAt).toEqual(deadline);
  });

  it("locks once the deadline has elapsed", () => {
    const decision = decideTierLock(
      prior({ tier: "free", pendingLockAt: new Date(NOW.getTime() - 1) }),
      { tier: "free", status: "active" },
      NOW,
    );

    expect(decision.workspaceEffect).toBe("locked");
    expect(decision.lockedAt).toEqual(NOW);
    // The deadline is consumed by the lock, so a sweep has nothing left to find.
    expect(decision.pendingLockAt).toBeNull();
  });

  it("locks at the deadline itself", () => {
    const decision = decideTierLock(
      prior({ tier: "free", pendingLockAt: new Date(NOW.getTime()) }),
      { tier: "free", status: "active" },
      NOW,
    );

    expect(decision.workspaceEffect).toBe("locked");
  });

  it("leaves workspaces alone when nothing changed and nothing is armed", () => {
    const decision = decideTierLock(prior(), { tier: "pro", status: "active" }, NOW);

    expect(decision.workspaceEffect).toBe("unchanged");
    expect(decision.pendingLockAt).toBeNull();
  });

  it("never arms a lock while the subscription is in dunning", () => {
    const decision = decideTierLock(prior(), { tier: "free", status: "past_due" }, NOW);

    expect(decision.workspaceEffect).toBe("released");
    expect(decision.pendingLockAt).toBeNull();
    expect(decision.pendingLockReason).toBeNull();
  });

  it("never fires an armed deadline while the subscription is in dunning", () => {
    const decision = decideTierLock(
      prior({ tier: "free", pendingLockAt: new Date(NOW.getTime() - 1) }),
      { tier: "free", status: "past_due" },
      NOW,
    );

    expect(decision.workspaceEffect).not.toBe("locked");
    expect(decision.pendingLockAt).toBeNull();
  });

  it("treats a brand-new organization with no prior row as free", () => {
    const decision = decideTierLock(null, { tier: "free", status: "active" }, NOW);

    expect(decision.workspaceEffect).toBe("unchanged");
    expect(decision.pendingLockAt).toBeNull();
  });

  it("defers past the paid-through date when the period end is still ahead", () => {
    const paidThrough = new Date(NOW.getTime() + 300 * 24 * 60 * 60 * 1000);

    const decision = decideTierLock(
      prior(),
      { tier: "free", status: "active", periodEndsAt: paidThrough },
      NOW,
    );

    expect(decision.workspaceEffect).toBe("released");
    expect(decision.pendingLockAt).toEqual(paidThrough);
    expect(decision.pendingLockReason).toContain(paidThrough.toISOString());
  });

  it("keeps the standard grace window when the period end is sooner", () => {
    const decision = decideTierLock(
      prior(),
      { tier: "free", status: "active", periodEndsAt: new Date(NOW.getTime() + 60_000) },
      NOW,
    );

    expect(decision.pendingLockAt?.getTime()).toBe(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
  });

  it("falls back to the grace window when the period end is unknown", () => {
    const explicitNull = decideTierLock(
      prior(),
      { tier: "free", status: "active", periodEndsAt: null },
      NOW,
    );
    const omitted = decideTierLock(prior(), { tier: "free", status: "active" }, NOW);

    expect(explicitNull.pendingLockAt?.getTime()).toBe(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(omitted.pendingLockAt).toEqual(explicitNull.pendingLockAt);
  });

  it("keeps a stored period end when the payload omits it", () => {
    const stored = new Date(NOW.getTime() + 300 * 24 * 60 * 60 * 1000);

    const decision = decideTierLock(
      prior({ periodEndsAt: stored }),
      { tier: "free", status: "active" },
      NOW,
    );

    expect(decision.pendingLockAt).toEqual(stored);
  });

  it("ignores a period end that has already passed", () => {
    const decision = decideTierLock(
      prior(),
      { tier: "free", status: "active", periodEndsAt: new Date(NOW.getTime() - 1) },
      NOW,
    );

    expect(decision.pendingLockAt?.getTime()).toBe(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
  });

  it("still locks once a period-end deferral has run out", () => {
    const paidThrough = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000);
    const deferred = decideTierLock(
      prior(),
      { tier: "free", status: "active", periodEndsAt: paidThrough },
      NOW,
    );
    expect(deferred.pendingLockAt).toEqual(paidThrough);

    // One moment after the paid-through date the deferral has run out and the
    // normal rules take over, so the workspace does reach a locked state.
    const after = new Date(paidThrough.getTime() + 1);
    const locked = decideTierLock(
      prior({
        tier: "free",
        periodEndsAt: paidThrough,
        pendingLockAt: deferred.pendingLockAt,
      }),
      { tier: "free", status: "active", periodEndsAt: paidThrough },
      after,
    );

    expect(locked.workspaceEffect).toBe("locked");
    expect(locked.lockedAt).toEqual(after);
    expect(locked.pendingLockAt).toBeNull();
  });

  it("does not lock when a paid-through date covers an elapsed deadline", () => {
    const paidThrough = new Date(NOW.getTime() + 300 * 24 * 60 * 60 * 1000);

    const decision = decideTierLock(
      prior({ tier: "free", pendingLockAt: new Date(NOW.getTime() - 1) }),
      { tier: "free", status: "active", periodEndsAt: paidThrough },
      NOW,
    );

    expect(decision.workspaceEffect).toBe("unchanged");
    expect(decision.pendingLockAt).toEqual(paidThrough);
  });

  it("still locks when the elapsed deadline is not covered by a period end", () => {
    const decision = decideTierLock(
      prior({
        tier: "free",
        pendingLockAt: new Date(NOW.getTime() - 1),
        periodEndsAt: new Date(NOW.getTime() - 1000),
      }),
      { tier: "free", status: "active" },
      NOW,
    );

    expect(decision.workspaceEffect).toBe("locked");
  });

  it("cannot infer a downgrade from a missing tier row, whatever arrives", () => {
    for (const tier of ["free", "pro", "team", "enterprise"]) {
      for (const status of ["active", "canceled", "past_due"]) {
        const decision = decideTierLock(null, { tier, status }, NOW);

        expect(decision.workspaceEffect).not.toBe("locked");
        expect(decision.pendingLockAt).toBeNull();
      }
    }
  });
});

describe("rankForLock", () => {
  it("counts a canceled subscription as free whatever tier it names", () => {
    expect(effectiveTierForLock("pro", "canceled")).toBe("free");
    expect(rankForLock("pro", "canceled")).toBe(TIER_RANK.free);
  });

  it("leaves dunning on the tier the provider still names", () => {
    expect(rankForLock("pro", "past_due")).toBe(TIER_RANK.pro);
  });

  it("ranks unknown tiers as free", () => {
    expect(rankForLock("platinum", "active")).toBe(0);
  });

  it("classifies past_due as a dunning status", () => {
    expect(DUNNING_STATUSES.has("past_due")).toBe(true);
  });

  it("counts a suspended subscription as free whatever tier it names", () => {
    expect(effectiveTierForLock("pro", "suspended")).toBe("free");
    expect(rankForLock("pro", "suspended")).toBe(TIER_RANK.free);
  });

  it("keeps suspended out of the dunning set, so it starts the clock instead of stopping it", () => {
    expect(DUNNING_STATUSES.has("suspended")).toBe(false);
    expect(NO_ENTITLEMENT_STATUSES.has("suspended")).toBe(true);
    expect(NO_ENTITLEMENT_STATUSES.has("past_due")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Lock policy — setOrgTier integration through the transaction
// ---------------------------------------------------------------------------

describe("setOrgTier", () => {
  beforeEach(() => {
    // Default: no previous tier, no org owners => no cascade
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
        periodEndsAt: null,
        pendingLockAt: null,
        pendingLockReason: null,
      },
      update: {
        tier: "pro",
        status: "active",
        trialEndsAt: null,
        periodEndsAt: null,
        pendingLockAt: null,
        pendingLockReason: null,
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

  it("runs the read, write and cascade in one Serializable transaction", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("defers the lock instead of locking immediately on downgrade from pro to free", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    const before = Date.now();
    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(lastUpsertUpdate().pendingLockAt?.getTime()).toBeGreaterThanOrEqual(
      before + GRACE_WINDOW_MS,
    );
    expect(lastUpsertUpdate().pendingLockReason).toContain("Tier downgraded from pro (active) to free (active)");
    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: { in: ["user-1"] } },
        data: RELEASED,
      }),
    );
  });

  it("defers the lock on downgrade from team to free", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "team", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(lastUpsertUpdate().pendingLockReason).toContain("Tier downgraded from team");
    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: RELEASED }),
    );
  });

  it("defers the lock when status becomes canceled (treats as free rank)", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    // Hub sends tier="pro" with status="canceled" — effective rank should be 0 (free)
    await setOrgTier("org-1", { tier: "pro", status: "canceled" });

    expect(lastUpsertUpdate().pendingLockAt).toBeInstanceOf(Date);
    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: RELEASED }),
    );
  });

  it("locks the workspace once the grace window has elapsed", async () => {
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: new Date(Date.now() - 60_000),
        pendingLockReason: "Tier downgraded from pro (active) to free (active).",
      }),
    );
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: { in: ["user-1"] }, locked: false },
        data: expect.objectContaining({
          locked: true,
          lockedReason: expect.stringContaining("Tier downgraded from pro"),
          lockedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("keeps the workspace open while the grace window is still open", async () => {
    const deadline = new Date(Date.now() + 60_000);
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: deadline,
        pendingLockReason: "Tier downgraded from pro (active) to free (active).",
      }),
    );
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "free", status: "active" });

    // A re-sent downgrade must not move the deadline that is already armed.
    expect(lastUpsertUpdate().pendingLockAt).toEqual(deadline);
    expect(mockWorkspaceUpdateMany).not.toHaveBeenCalled();
  });

  it("clears the pending lock when the tier recovers before the deadline", async () => {
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: new Date(Date.now() + 86_400_000),
        pendingLockReason: "Tier downgraded from pro (active) to free (active).",
      }),
    );
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "pro", status: "active" });

    expect(lastUpsertUpdate().pendingLockAt).toBeNull();
    expect(lastUpsertUpdate().pendingLockReason).toBeNull();
    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: RELEASED }),
    );
  });

  it("does not lock a past_due downgrade (dunning window)", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 0 });

    await setOrgTier("org-1", { tier: "free", status: "past_due" });

    expect(lastUpsertUpdate().pendingLockAt).toBeNull();
    expect(mockWorkspaceUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ locked: true }) }),
    );
  });

  it("arms the grace window when the hub reports the subscription suspended", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    const before = Date.now();
    await setOrgTier("org-1", { tier: "pro", status: "suspended" });

    const armed = lastUpsertUpdate().pendingLockAt;
    expect(armed).toBeInstanceOf(Date);
    expect(armed!.getTime()).toBeGreaterThanOrEqual(before + GRACE_WINDOW_MS);
    expect(lastUpsertUpdate().status).toBe("suspended");
    expect(lastUpsertUpdate().pendingLockReason).toContain(
      "Tier downgraded from pro (active) to pro (suspended)",
    );
  });

  it("locks the workspace once a suspended subscription's grace window has elapsed", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "pro", status: "suspended" });

    const armed = lastUpsertUpdate().pendingLockAt;
    const reason = lastUpsertUpdate().pendingLockReason;
    expect(armed).toBeInstanceOf(Date);
    expect(mockWorkspaceUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ locked: true }) }),
    );

    // The same stored row, seen by the sweep two weeks later: the deadline the
    // suspension armed (armed == now + grace) is now in the past.
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "pro",
        status: "suspended",
        pendingLockAt: new Date(armed!.getTime() - GRACE_WINDOW_MS - 1000),
        pendingLockReason: reason,
      }),
    );
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("locked");
    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith({
      where: { ownerId: { in: ["user-1"] }, locked: false },
      data: { locked: true, lockedReason: reason, lockedAt: expect.any(Date) },
    });
  });

  it("defers past the grace window when the period end is still ahead", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    const paidThrough = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000);
    await setOrgTier("org-1", { tier: "free", status: "active", periodEndsAt: paidThrough });

    expect(lastUpsertUpdate().pendingLockAt).toEqual(paidThrough);
    expect(lastUpsertUpdate().periodEndsAt).toEqual(paidThrough);
    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: RELEASED }),
    );
  });

  it("falls back to the grace window when the period end is unknown", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    const before = Date.now();
    await setOrgTier("org-1", { tier: "free", status: "active" });

    const pendingLockAt = lastUpsertUpdate().pendingLockAt;
    expect(pendingLockAt?.getTime()).toBeGreaterThanOrEqual(before + GRACE_WINDOW_MS);
    expect(pendingLockAt?.getTime()).toBeLessThan(before + GRACE_WINDOW_MS + 5000);
    expect(lastUpsertUpdate().pendingLockReason).toContain("Tier downgraded from pro");
    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: RELEASED }),
    );
  });

  it("keeps a stored period end when the hub omits the field", async () => {
    const stored = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue(
      makeOrgTier({ tier: "pro", status: "active", periodEndsAt: stored }),
    );
    mockUpsert.mockResolvedValue({});

    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(lastUpsertUpdate().periodEndsAt).toEqual(stored);
  });

  it("does not push the deadline back when a second downgrade follows", async () => {
    // pro -> team already deferred the lock; team -> free must keep that
    // anchored deadline rather than starting a fresh two-week window.
    const anchored = new Date(Date.now() + 60_000);
    mockFindUnique.mockResolvedValue(
      makeOrgTier({ tier: "team", status: "active", pendingLockAt: anchored }),
    );
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 0 });

    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(lastUpsertUpdate().pendingLockAt).toEqual(anchored);
  });

  it("disarms an armed deadline while the subscription is in dunning", async () => {
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: new Date(Date.now() - 60_000),
        pendingLockReason: "Tier downgraded from pro (active) to free (active).",
      }),
    );
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "free", status: "past_due" });

    expect(lastUpsertUpdate().pendingLockAt).toBeNull();
    expect(lastUpsertUpdate().pendingLockReason).toBeNull();
    expect(lastUpsertUpdate().status).toBe("past_due");
    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: RELEASED }),
    );
  });

  it("consumes the deadline it fires, keeping the reason as the audit trail", async () => {
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: new Date(Date.now() - 60_000),
        pendingLockReason: "Tier downgraded from pro (active) to free (active).",
      }),
    );
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(lastUpsertUpdate().pendingLockAt).toBeNull();
    expect(lastUpsertUpdate().pendingLockReason).toContain("Tier downgraded from pro");
  });

  it("retries when the transaction hits a serialization conflict", async () => {
    mockUpsert.mockResolvedValue({});
    const conflict = Object.assign(new Error("could not serialize access"), { code: "P2034" });

    mockTransaction
      .mockImplementationOnce(((() => Promise.reject(conflict)) as never))
      .mockImplementation(((fn: (tx: typeof prisma) => unknown) => fn(prisma)) as never);

    await setOrgTier("org-1", { tier: "pro", status: "active" });

    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it("re-reads the tier row inside the retried transaction", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});
    const conflict = Object.assign(new Error("could not serialize access"), { code: "P2034" });
    let attempts = 0;

    // A real serialization failure aborts at COMMIT, after the callback body
    // has already run its reads, so a retry has to replay the whole body.
    mockTransaction.mockImplementation(
      ((fn: (tx: typeof prisma) => unknown) => {
        attempts += 1;
        const attempt = attempts;
        return Promise.resolve(fn(prisma)).then(() => {
          if (attempt === 1) throw conflict;
          return undefined;
        });
      }) as never,
    );

    await setOrgTier("org-1", { tier: "pro", status: "active" });

    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it("gives up after three serialization conflicts", async () => {
    const conflict = Object.assign(new Error("could not serialize access"), { code: "P2034" });
    mockTransaction.mockImplementation(((() => Promise.reject(conflict)) as never));

    await expect(setOrgTier("org-1", { tier: "pro", status: "active" })).rejects.toThrow(
      "could not serialize access",
    );
    expect(mockTransaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-conflict failure", async () => {
    const failure = Object.assign(new Error("foreign key violation"), { code: "P2003" });
    mockTransaction.mockImplementation(((() => Promise.reject(failure)) as never));

    await expect(setOrgTier("org-1", { tier: "pro", status: "active" })).rejects.toThrow(
      "foreign key violation",
    );
    expect(mockTransaction).toHaveBeenCalledTimes(1);
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
        data: RELEASED,
      }),
    );
  });

  it("unlocks workspace on upgrade from pro to team", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "team", status: "active" });

    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: { in: ["user-1"] } },
        data: RELEASED,
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
        data: RELEASED,
      }),
    );
  });

  it("cascades a deferred lock across multiple owners and workspaces", async () => {
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
        data: RELEASED,
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
    await expect(mockWorkspaceUpdateMany.mock.results[0].value).resolves.toEqual({ count: 0 });
  });

  it("handles org with zero owners (no cascade)", async () => {
    mockFindUnique.mockResolvedValue(makeOrgTier({ tier: "pro", status: "active" }));
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([]);

    await setOrgTier("org-1", { tier: "free", status: "active" });

    expect(mockWorkspaceUpdateMany).not.toHaveBeenCalled();
    // No owner means nobody to release for today, but the downgrade still arms
    // the deadline: the lock path must not depend on a member row existing now.
    expect(lastUpsertUpdate().pendingLockAt).toBeInstanceOf(Date);
  });

  it("never reads a missing tier row as a downgrade", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await setOrgTier("org-1", { tier: "free", status: "canceled" });

    expect(lastUpsertUpdate().pendingLockAt).toBeNull();
    expect(mockWorkspaceUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ locked: true }) }),
    );
  });

  it("cannot arm a deferral from a missing tier row", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});

    for (const tier of ["free", "pro", "team", "enterprise"]) {
      await setOrgTier("org-1", { tier, status: "active" });

      expect(lastUpsertUpdate().pendingLockAt).toBeNull();
      expect(lastUpsertUpdate().pendingLockReason).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Deadline enforcement — the database half the sweep calls into
// ---------------------------------------------------------------------------

describe("enforceTierLockDeadline", () => {
  beforeEach(() => {
    mockOrgTierFindMany.mockResolvedValue([]);
    mockUpsert.mockResolvedValue({});
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("locks workspaces whose deadline has elapsed", async () => {
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "pro",
        status: "canceled",
        pendingLockAt: new Date(Date.now() - 60_000),
        pendingLockReason: "Tier downgraded from pro (active) to pro (canceled).",
      }),
    );
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 2 });

    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("locked");

    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith({
      where: { ownerId: { in: ["user-1"] }, locked: false },
      data: {
        locked: true,
        lockedReason: "Tier downgraded from pro (active) to pro (canceled).",
        lockedAt: expect.any(Date),
      },
    });
  });

  it("leaves workspaces alone while the deadline is still ahead", async () => {
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: new Date(Date.now() + 60_000),
        pendingLockReason: "Tier downgraded from pro (active) to free (active).",
      }),
    );

    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("noop");
    expect(mockWorkspaceUpdateMany).not.toHaveBeenCalled();
  });

  it("does not lock a deadline that a paid-through date still covers", async () => {
    const paidThrough = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        periodEndsAt: paidThrough,
        pendingLockAt: new Date(Date.now() - 60_000),
        pendingLockReason: "Tier downgraded from pro (active) to free (active).",
      }),
    );

    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("noop");
    expect(lastUpsertUpdate().pendingLockAt).toEqual(paidThrough);
    expect(mockWorkspaceUpdateMany).not.toHaveBeenCalled();
  });

  it("does not churn lockedAt when it runs twice", async () => {
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: new Date(Date.now() - 60_000),
        pendingLockReason: "Tier downgraded from pro (active) to free (active).",
      }),
    );
    mockWorkspaceUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("locked");
    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("noop");

    // Both runs carry the same guard, so the second matched no unlocked workspace.
    expect(mockWorkspaceUpdateMany).toHaveBeenCalledTimes(2);
    expect(mockWorkspaceUpdateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { ownerId: { in: ["user-1"] }, locked: false } }),
    );
  });

  it("never locks anything for an organization with no tier row", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("noop");
    expect(mockWorkspaceUpdateMany).not.toHaveBeenCalled();
  });

  it("keeps the fired deadline armed when there is no owner to lock for", async () => {
    const firedAt = new Date(Date.now() - 60_000);
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: firedAt,
        pendingLockReason: "Tier downgraded from pro (active) to free (active).",
      }),
    );
    mockPluginMemberFindMany.mockResolvedValue([]);

    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("unapplied");

    expect(mockWorkspaceUpdateMany).not.toHaveBeenCalled();
    // Consuming the deadline here would leave the organization with nothing
    // locked and nothing armed: arming needs a fresh rank decrease.
    expect(lastUpsertUpdate().pendingLockAt).toEqual(firedAt);
    expect(lastUpsertUpdate().pendingLockReason).toBe(
      "Tier downgraded from pro (active) to free (active).",
    );
  });

  it("locks on a later sweep once the organization gains an owner", async () => {
    const reason = "Tier downgraded from pro (active) to free (active).";
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: new Date(Date.now() - 60_000),
        pendingLockReason: reason,
      }),
    );
    mockPluginMemberFindMany.mockResolvedValue([]);

    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("unapplied");
    const stillArmed = lastUpsertUpdate().pendingLockAt;
    expect(stillArmed).toBeInstanceOf(Date);

    // An owner shows up before the next sweep; the deadline never left the row.
    mockPluginMemberFindMany.mockResolvedValue([{ userId: "user-1" }]);
    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: stillArmed,
        pendingLockReason: reason,
      }),
    );
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("locked");

    expect(mockWorkspaceUpdateMany).toHaveBeenCalledWith({
      where: { ownerId: { in: ["user-1"] }, locked: false },
      data: { locked: true, lockedReason: reason, lockedAt: expect.any(Date) },
    });
    // Applied this time, so the deadline it fired is consumed.
    expect(lastUpsertUpdate().pendingLockAt).toBeNull();
  });

  it("retries the enforcement when the transaction hits a serialization conflict", async () => {
    const conflict = Object.assign(new Error("could not serialize access"), { code: "P2034" });
    let attempts = 0;

    mockFindUnique.mockResolvedValue(
      makeOrgTier({
        tier: "free",
        status: "active",
        pendingLockAt: new Date(Date.now() - 60_000),
        pendingLockReason: "Tier downgraded from pro (active) to free (active).",
      }),
    );
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    // A real conflict aborts at COMMIT, after the body has run, so the retry
    // replays the whole evaluation rather than resuming it.
    mockTransaction.mockImplementation(
      ((fn: (tx: typeof prisma) => unknown) => {
        attempts += 1;
        const attempt = attempts;
        return Promise.resolve(fn(prisma)).then((result) => {
          if (attempt === 1) throw conflict;
          return result;
        });
      }) as never,
    );

    await expect(enforceTierLockDeadline("org-1")).resolves.toBe("locked");
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it("gives up on the enforcement after three serialization conflicts", async () => {
    const conflict = Object.assign(new Error("could not serialize access"), { code: "P2034" });
    mockTransaction.mockImplementation(((() => Promise.reject(conflict)) as never));

    await expect(enforceTierLockDeadline("org-1")).rejects.toThrow("could not serialize access");
    expect(mockTransaction).toHaveBeenCalledTimes(3);
  });
});

describe("findDueTierLockOrganizations", () => {
  it("queries only armed deadlines that have already elapsed", async () => {
    const now = new Date("2026-09-15T00:00:00.000Z");
    mockOrgTierFindMany.mockResolvedValue([{ organizationId: "org-1" }]);

    await expect(findDueTierLockOrganizations(now, 25)).resolves.toEqual(["org-1"]);
    expect(mockOrgTierFindMany).toHaveBeenCalledWith({
      where: { pendingLockAt: { lte: now } },
      select: { organizationId: true },
      orderBy: { pendingLockAt: "asc" },
      take: 25,
    });
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
