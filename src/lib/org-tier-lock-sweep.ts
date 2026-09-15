import { enforceTierLockDeadline, findDueTierLockOrganizations } from "@/lib/org-tier";

/** Cap on organizations enforced per run, so one backlog cannot tie up a request. */
export const TIER_LOCK_SWEEP_LIMIT = 500;

export interface TierLockSweepResult {
  /** Organizations whose armed deadline had elapsed and were evaluated. */
  due: number;
  /** Organizations whose workspaces this run actually locked. */
  locked: number;
  /** True when the run filled its page, so another run is likely to find work. */
  hasMore: boolean;
}

/**
 * Enforce every tier-lock deadline that has elapsed.
 *
 * Locks are otherwise driven only by billing webhooks, and a cancellation is a
 * one-off event the provider never resends, so a deadline armed by a downgrade
 * would never be evaluated again. Without this sweep the deferral would quietly
 * become permanent free access, which is the opposite failure from the one the
 * deferral exists to fix.
 *
 * Idempotent by construction: enforcement consumes the deadline it fires, and
 * the lock only targets workspaces that are not locked yet, so a second run
 * finds nothing due and a re-run over an already-locked organization changes
 * nothing (in particular it does not rewrite `lockedAt`).
 */
export async function sweepTierLockDeadlines(
  options: { now?: Date; limit?: number } = {},
): Promise<TierLockSweepResult> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? TIER_LOCK_SWEEP_LIMIT;

  const dueOrganizations = await findDueTierLockOrganizations(now, limit);

  let locked = 0;

  for (const organizationId of dueOrganizations) {
    if (await enforceTierLockDeadline(organizationId)) locked += 1;
  }

  return {
    due: dueOrganizations.length,
    locked,
    hasMore: dueOrganizations.length === limit,
  };
}
