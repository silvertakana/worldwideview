/**
 * Pure tier-lock policy for deferred workspace locking.
 *
 * Nothing here touches the database: given the stored tier row, the incoming
 * tier/status and the current time, it decides what the organization's
 * workspaces should do. Keeping the policy pure and side-effect free is what
 * lets the webhook-driven sync and the deadline sweep share one implementation
 * instead of drifting into two that disagree.
 */

export const TIER_RANK: Record<string, number> = {
  free: 0,
  canceled: 0,
  beta_tester: 1,
  early_access: 2,
  pro: 3,
  team: 4,
  enterprise: 5,
};

/**
 * Subscription states where the billing provider is still trying to collect.
 *
 * `past_due` means the subscription is alive and the card is being retried, so
 * it must never be read as a downgrade and must never arm or fire a lock. Think
 * of a cheque that has been deposited but has not cleared yet: the money is not
 * in the account, but nobody has torn the cheque up either.
 */
export const DUNNING_STATUSES: ReadonlySet<string> = new Set(["past_due"]);

/**
 * How long an organization may sit on a lower effective tier before its
 * workspaces actually lock, when the paid-through date is not known.
 *
 * Fourteen days is the length of the default Stripe Billing smart-retry dunning
 * window, so an organization whose payment keeps failing keeps access for the
 * whole retry sequence and only loses it after the provider has genuinely given
 * up. Shorter would lock paying customers mid-dunning; longer would hand out
 * free access after a real cancellation. This constant is the single knob for
 * that policy.
 */
export const TIER_DOWNGRADE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

/** What one tier evaluation should do to the organization's workspaces. */
export type TierLockEffect = "released" | "locked" | "unchanged";

export interface TierLockDecision {
  /** The workspace-side effect to apply. */
  workspaceEffect: TierLockEffect;
  /**
   * Deferred-lock deadline to persist on the org tier row; null clears it.
   *
   * A lock consumes the deadline, so this is null in the `"locked"` decision as
   * well as in the releasing ones: nothing is left armed once it has fired.
   */
  pendingLockAt: Date | null;
  /** Reason persisted on the org tier row, and copied onto workspaces on lock. */
  pendingLockReason: string | null;
  /** Timestamp to stamp on the workspaces when the effect is "locked". */
  lockedAt: Date | null;
}

/** The slice of a stored org tier row that the decision needs. */
export interface PriorTierState {
  tier: string;
  status: string;
  periodEndsAt: Date | null;
  pendingLockAt: Date | null;
  pendingLockReason: string | null;
}

export interface IncomingTierState {
  tier: string;
  status: string;
  /**
   * Paid-through date. `undefined` means "the caller does not know", which
   * reuses whatever is stored; `null` means "there is no period end".
   */
  periodEndsAt?: Date | null;
}

/** A `canceled` subscription counts as `free`, whatever tier it names. */
export function effectiveTierForLock(tier: string, status: string): string {
  if (status === "canceled") return "free";
  return tier;
}

/** Comparable rank of a tier/status pair; unknown tiers rank as `free`. */
export function rankForLock(tier: string, status: string): number {
  return TIER_RANK[effectiveTierForLock(tier, status)] ?? 0;
}

const LOCK_EXPIRED_REASON =
  "Tier downgrade grace period expired. Re-upgrade to restore access.";

/**
 * The paid-through date the evaluation knows about, if it is still ahead.
 *
 * A missing value falls back to the stored one, so a hub that never sends
 * `periodEndsAt` cannot erase a date we already know. A date in the past
 * carries no protection and is ignored, which leaves the grace window in charge.
 */
function paidThroughFloor(
  previous: PriorTierState | null,
  incoming: Date | null | undefined,
  now: Date,
): Date | null {
  const candidate = incoming === undefined ? (previous?.periodEndsAt ?? null) : incoming;
  if (!candidate || candidate.getTime() <= now.getTime()) return null;
  return candidate;
}

function laterOf(a: Date, b: Date | null): Date {
  if (!b) return a;
  return b.getTime() > a.getTime() ? b : a;
}

function describeDowngrade(
  previousTier: string,
  previousStatus: string,
  incomingTier: string,
  incomingStatus: string,
  pendingLockAt: Date,
  paidThrough: Date | null,
): string {
  const paidThroughNote = paidThrough
    ? ` The subscription is paid through ${paidThrough.toISOString()}.`
    : "";

  return (
    `Tier downgraded from ${previousTier} (${previousStatus}) to ${incomingTier} (${incomingStatus}).` +
    `${paidThroughNote} Workspaces lock after ${pendingLockAt.toISOString()} unless the tier is restored.`
  );
}

/**
 * Decide what one tier evaluation should do, given the stored tier row (or
 * null when the organization has none) and the incoming tier/status.
 *
 * Pure and synchronous, with `now` injected, so the whole locking policy can be
 * exercised without a database.
 */
export function decideTierLock(
  previous: PriorTierState | null,
  incoming: IncomingTierState,
  now: Date,
): TierLockDecision {
  const previousTier = previous?.tier ?? "free";
  const previousStatus = previous?.status ?? "active";
  const previousRank = rankForLock(previousTier, previousStatus);
  const incomingStatus = incoming.status || "active";
  const incomingRank = rankForLock(incoming.tier, incomingStatus);

  // Dunning is not a downgrade: the subscription is still live, so access is
  // preserved and any armed deadline is disarmed rather than left ticking.
  if (DUNNING_STATUSES.has(incomingStatus)) {
    return {
      workspaceEffect: "released",
      pendingLockAt: null,
      pendingLockReason: null,
      lockedAt: null,
    };
  }

  // Upgrade or recovery: cancel the deferral and restore access immediately.
  if (incomingRank > previousRank) {
    return {
      workspaceEffect: "released",
      pendingLockAt: null,
      pendingLockReason: null,
      lockedAt: null,
    };
  }

  const paidThrough = paidThroughFloor(previous, incoming.periodEndsAt, now);

  // Downgrade: grant the grace window instead of locking. The deadline is
  // anchored on the FIRST observation of the decline, so a hub that re-sends
  // the same downgrade cannot push the deadline back forever, and it is never
  // earlier than the date the customer has already paid for.
  if (incomingRank < previousRank) {
    const graceDeadline =
      previous?.pendingLockAt ?? new Date(now.getTime() + TIER_DOWNGRADE_GRACE_MS);
    const pendingLockAt = laterOf(graceDeadline, paidThrough);

    return {
      workspaceEffect: "released",
      pendingLockAt,
      pendingLockReason: describeDowngrade(
        previousTier,
        previousStatus,
        incoming.tier,
        incomingStatus,
        pendingLockAt,
        paidThrough,
      ),
      lockedAt: null,
    };
  }

  // Rank unchanged. Only a deadline armed by an earlier decline can lock, and
  // only once it has actually elapsed and the paid-through date has passed.
  const armed = previous?.pendingLockAt ?? null;

  if (!armed) {
    return {
      workspaceEffect: "unchanged",
      pendingLockAt: null,
      // Keep the recorded explanation: after a lock has been applied this is the
      // only remaining trace of why the workspaces are shut.
      pendingLockReason: previous?.pendingLockReason ?? null,
      lockedAt: null,
    };
  }

  const pendingLockAt = laterOf(armed, paidThrough);

  if (now.getTime() < pendingLockAt.getTime()) {
    return {
      workspaceEffect: "unchanged",
      pendingLockAt,
      pendingLockReason: previous?.pendingLockReason ?? null,
      lockedAt: null,
    };
  }

  return {
    workspaceEffect: "locked",
    // The deadline has fired, so it is consumed here rather than left armed for
    // the sweep to keep rediscovering on every run.
    pendingLockAt: null,
    pendingLockReason: previous?.pendingLockReason ?? LOCK_EXPIRED_REASON,
    lockedAt: now,
  };
}
