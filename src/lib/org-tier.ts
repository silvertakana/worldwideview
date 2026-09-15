import { prisma } from "@/lib/db";
import {
  decideTierLock,
  type IncomingTierState,
  type PriorTierState,
  type TierLockDecision,
} from "@/lib/org-tier-policy";

export {
  TIER_RANK,
  TIER_DOWNGRADE_GRACE_MS,
  DUNNING_STATUSES,
  NO_ENTITLEMENT_STATUSES,
  effectiveTierForLock,
  rankForLock,
  decideTierLock,
} from "@/lib/org-tier-policy";
export type {
  TierLockDecision,
  TierLockEffect,
  PriorTierState,
  IncomingTierState,
} from "@/lib/org-tier-policy";

export interface OrgTierData {
  tier: string;
  status: string;
  trialEndsAt: Date | null;
}

export interface TierInput {
  tier: string;
  status: string;
  trialEndsAt?: Date | null;
  /**
   * Paid-through date for the subscription.
   *
   * `undefined` means "the caller does not know", which preserves whatever is
   * already stored; `null` means "there is no period end", which clears it.
   */
  periodEndsAt?: Date | null;
}

/** The stored columns the lock evaluation reads. */
interface StoredTierRecord {
  tier: string;
  status: string;
  trialEndsAt: Date | null;
  periodEndsAt: Date | null;
  pendingLockAt: Date | null;
  pendingLockReason: string | null;
}

/** The row to write on the next evaluation. */
interface NextTierState extends IncomingTierState {
  trialEndsAt: Date | null;
}

type TierTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toPriorState(record: StoredTierRecord | null): PriorTierState | null {
  if (!record) return null;

  return {
    tier: record.tier,
    status: record.status,
    periodEndsAt: record.periodEndsAt,
    pendingLockAt: record.pendingLockAt,
    pendingLockReason: record.pendingLockReason,
  };
}

/**
 * What one workspace-effect attempt resolved to.
 *
 * `applied` is false in exactly one case: the organization has no owner-role
 * member, so the effect has nowhere to land. A lock that matched zero workspaces
 * still counts as applied, because the workspaces it targets are already locked
 * and there was simply nothing left to write.
 */
interface EffectOutcome {
  applied: boolean;
  affected: number;
}

/**
 * Apply the decision to the organization's workspaces.
 *
 * The lock branch only targets workspaces that are not locked yet, which is what
 * makes a repeated evaluation a no-op instead of a rewrite that churns
 * `lockedAt`.
 */
async function applyWorkspaceEffect(
  tx: TierTransaction,
  orgId: string,
  decision: TierLockDecision,
): Promise<EffectOutcome> {
  if (decision.workspaceEffect === "unchanged") return { applied: true, affected: 0 };

  const ownerMembers = await tx.pluginMember.findMany({
    where: { organizationId: orgId, role: "owner" },
    select: { userId: true },
  });

  if (ownerMembers.length === 0) return { applied: false, affected: 0 };

  const ownerIds = ownerMembers.map((member) => member.userId);

  if (decision.workspaceEffect === "locked") {
    const result = await tx.workspace.updateMany({
      where: { ownerId: { in: ownerIds }, locked: false },
      data: {
        locked: true,
        lockedReason: decision.pendingLockReason,
        lockedAt: decision.lockedAt,
      },
    });

    return { applied: true, affected: result.count };
  }

  const result = await tx.workspace.updateMany({
    where: { ownerId: { in: ownerIds } },
    data: { locked: false, lockedReason: null, lockedAt: null },
  });

  return { applied: true, affected: result.count };
}

/**
 * Evaluate one organization and write the result atomically.
 *
 * The stored tier row, the tier write and the workspace cascade all run inside
 * one Serializable transaction. Reading the row, then writing based on that
 * read, is how a failed payment and a successful upgrade arriving at the same
 * moment used to leave a paid workspace locked: each sync computed its decision
 * from a row the other had already replaced.
 *
 * `resolveNext` decides what the incoming tier state is, given the row as it
 * exists inside the transaction. The webhook path passes the hub's payload; the
 * deadline sweep passes the stored row back unchanged, which keeps the sweep on
 * exactly the same decision path instead of a parallel implementation.
 *
 * The workspace effect runs BEFORE the tier row is written, and the deadline a
 * lock fired is only consumed once that effect has been applied. A fired lock
 * whose effect cannot land - the organization has no owner-role member for the
 * cascade to reach - keeps its deadline armed, because the alternative is an
 * organization with nothing locked and nothing left to try again: arming only
 * happens on a fresh rank decrease, so a dropped deadline is permanent free
 * access rather than a delay. Keeping it armed costs a retry on the next sweep
 * and heals itself the moment the organization gains an owner.
 */
async function runTierEvaluation(
  orgId: string,
  resolveNext: (stored: StoredTierRecord | null, now: Date) => NextTierState,
): Promise<{ decision: TierLockDecision; affected: number; applied: boolean }> {
  return prisma.$transaction(
    async (tx) => {
      const stored = await tx.orgTier.findUnique({
        where: { organizationId: orgId },
      });

      const now = new Date();
      const previous = toPriorState(stored);
      const next = resolveNext(stored, now);

      const decision = decideTierLock(
        previous,
        { tier: next.tier, status: next.status, periodEndsAt: next.periodEndsAt },
        now,
      );

      const effect = await applyWorkspaceEffect(tx, orgId, decision);

      // A lock consumes the deadline it fired; anything else persists the
      // decision's own deadline. Only the lock branch can be "not applied".
      const deadlineConsumed = decision.workspaceEffect !== "locked" || effect.applied;

      const tierFields = {
        tier: next.tier,
        status: next.status,
        trialEndsAt: next.trialEndsAt,
        // An omitted periodEndsAt means "not reported", not "no period end":
        // keep the date we already have rather than erasing it.
        periodEndsAt:
          next.periodEndsAt === undefined ? (previous?.periodEndsAt ?? null) : next.periodEndsAt,
        pendingLockAt: deadlineConsumed ? decision.pendingLockAt : (previous?.pendingLockAt ?? null),
        pendingLockReason: decision.pendingLockReason,
      };

      await tx.orgTier.upsert({
        where: { organizationId: orgId },
        create: { organizationId: orgId, ...tierFields },
        update: tierFields,
      });

      return { decision, affected: effect.affected, applied: effect.applied };
    },
    { isolationLevel: "Serializable" },
  );
}

/** Prisma's code for a transaction aborted by a serialization conflict. */
const SERIALIZATION_FAILURE = "P2034";

/**
 * How many times one evaluation may lose the serialization lottery before it
 * gives up.
 *
 * The budget is a fixed count, so it scales poorly with concurrency: it does not
 * grow with the number of evaluations in flight, and every extra same-organization
 * writer is another chance for one request to lose every round in a row. Three was
 * chosen when the worst observed burst was three concurrent requests, which is not
 * a bound anything enforces - a wider burst just fails, and the failure used to be
 * indistinguishable in logs from a broken code path.
 *
 * Five covers the realistic worst case for this path: a handful of Stripe webhooks
 * for one organization landing within a few hundred milliseconds of each other,
 * which is a small single-digit burst rather than an unbounded one. It stays well
 * short of the point where repeated retries would hide a genuine defect, and every
 * attempt is cheap because a conflicted transaction rolled back without writing.
 */
const MAX_TIER_SYNC_ATTEMPTS = 5;

function isRetryableConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === SERIALIZATION_FAILURE
  );
}

/**
 * Raised when an evaluation spent its whole retry budget on serialization
 * conflicts and still lost.
 *
 * What it describes is contention, not a fault: every attempt was rolled back by
 * Postgres, so nothing was half-applied and replaying the same sync can still
 * succeed. It carries its own type so the boundary that talks to the caller can
 * answer "busy, retry" instead of the opaque 500 that used to read exactly like
 * broken code. Only this case gets the type - a non-conflict error keeps
 * propagating as itself.
 */
export class TierSyncContentionError extends Error {
  /** The organization whose evaluation never got through. */
  readonly organizationId: string;
  /** How many serialization attempts were spent before giving up. */
  readonly attempts: number;

  constructor(organizationId: string, attempts: number, lastConflict: unknown) {
    const conflictMessage =
      lastConflict instanceof Error ? lastConflict.message : String(lastConflict);

    super(
      `Tier sync for organization ${organizationId} exhausted ${attempts} serialization ` +
        `attempts without committing (last conflict: ${conflictMessage})`,
    );

    this.name = "TierSyncContentionError";
    this.organizationId = organizationId;
    this.attempts = attempts;
  }
}

/**
 * Run a Serializable evaluation, retrying the transaction when Postgres aborts
 * it with a serialization conflict.
 *
 * The conflict is the transaction's own optimistic guard doing its job - another
 * evaluation touched the same row first - so the whole evaluation is simply
 * replayed against the newer row. Anything that is not a P2034 is a real
 * failure and propagates immediately: retrying it would only delay the report.
 * Shared by the webhook sync and the deadline sweep, so neither can end up with
 * a weaker retry policy than the other.
 *
 * Running out of attempts is the one outcome with a type of its own: every
 * attempt rolled back, so the caller can be told "contended, try again" instead
 * of being handed the last conflict and left to guess whether the code or the
 * crowd was at fault.
 */
async function withSerializationRetry<T>(
  organizationId: string,
  operation: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_TIER_SYNC_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      // A real failure propagates untouched on every attempt, so the retry can
      // never absorb something it did not cause.
      if (!isRetryableConflict(error)) throw error;

      lastError = error;

      if (attempt === MAX_TIER_SYNC_ATTEMPTS) {
        throw new TierSyncContentionError(organizationId, attempt, error);
      }
    }
  }

  throw lastError;
}

export async function setOrgTier(orgId: string, data: TierInput): Promise<void> {
  const next: NextTierState = {
    tier: data.tier,
    status: data.status || "active",
    trialEndsAt: data.trialEndsAt ?? null,
    periodEndsAt: data.periodEndsAt,
  };

  await withSerializationRetry(orgId, () => runTierEvaluation(orgId, () => next));
}

/**
 * Organizations whose armed lock deadline has elapsed.
 *
 * Served by the `(pendingLockAt)` index on `org_tiers`.
 */
export async function findDueTierLockOrganizations(now: Date, limit: number): Promise<string[]> {
  const rows = await prisma.orgTier.findMany({
    where: { pendingLockAt: { lte: now } },
    select: { organizationId: true },
    orderBy: { pendingLockAt: "asc" },
    take: limit,
  });

  return rows.map((row) => row.organizationId);
}

/**
 * What one enforcement call actually did.
 *
 * `"locked"` means this call wrote the lock. `"unapplied"` means the deadline
 * fired but the organization has no owner-role member for the lock to land on,
 * so the deadline was deliberately left armed for a later sweep. `"noop"` means
 * there was nothing to enforce: the deadline had not elapsed, or the workspaces
 * it targets were already locked.
 */
export type TierLockEnforcement = "locked" | "unapplied" | "noop";

/**
 * Enforce one organization's armed deadline against the current time.
 *
 * The stored tier is re-evaluated rather than a payload, so the rank is
 * unchanged by construction and the only possible outcomes are "the workspaces
 * lock" or "nothing to do" - a sweep can never arm a new deferral or release
 * access. Carries the same serialization-conflict retry as the webhook sync, so
 * a conflict on one organization cannot cost a whole sweep its remaining work.
 */
export async function enforceTierLockDeadline(orgId: string): Promise<TierLockEnforcement> {
  const { decision, affected, applied } = await withSerializationRetry(orgId, () =>
    runTierEvaluation(orgId, (stored) => ({
      tier: stored?.tier ?? "free",
      status: stored?.status ?? "active",
      trialEndsAt: stored?.trialEndsAt ?? null,
      periodEndsAt: undefined,
    })),
  );

  if (decision.workspaceEffect !== "locked") return "noop";

  if (!applied) {
    console.warn(
      `[org-tier] Tier-lock deadline for organization ${orgId} fired but could not be applied: ` +
        "the organization has no owner-role member to lock for. The deadline stays armed for a later sweep.",
    );

    return "unapplied";
  }

  return affected > 0 ? "locked" : "noop";
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
