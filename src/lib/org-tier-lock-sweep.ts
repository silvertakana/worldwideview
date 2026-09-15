import { enforceTierLockDeadline, findDueTierLockOrganizations } from "@/lib/org-tier";

/** Cap on organizations enforced per run, so one backlog cannot tie up a request. */
export const TIER_LOCK_SWEEP_LIMIT = 500;

export interface TierLockSweepResult {
  /** Organizations whose armed deadline had elapsed and were evaluated. */
  due: number;
  /** Organizations whose workspaces this run actually locked. */
  locked: number;
  /** Organizations whose lock fired but had no owner-role member to lock for. */
  unapplied: number;
  /** Organizations whose enforcement threw, even after the retry. */
  failed: number;
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
 * nothing (in particular it does not rewrite `lockedAt`). The one deadline that
 * survives a run is an enforcement that could not be applied, which is simply
 * revisited.
 *
 * Every organization is enforced independently, so neither a failure nor an
 * unapplied lock stops the run: the summary reports both counts rather than
 * collapsing the whole page into one outcome.
 */
export async function sweepTierLockDeadlines(
  options: { now?: Date; limit?: number } = {},
): Promise<TierLockSweepResult> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? TIER_LOCK_SWEEP_LIMIT;

  const dueOrganizations = await findDueTierLockOrganizations(now, limit);

  let locked = 0;
  let unapplied = 0;
  let failed = 0;

  for (const organizationId of dueOrganizations) {
    try {
      const enforcement = await enforceTierLockDeadline(organizationId);

      if (enforcement === "locked") locked += 1;
      else if (enforcement === "unapplied") unapplied += 1;
    } catch (error) {
      // One organization's failure must not cost the rest of the page its work:
      // the previous version let the exception escape the loop, so a single
      // conflict or bad row skipped every organization behind it.
      failed += 1;
      console.error(
        `[tier-lock-sweep] Failed to enforce the tier-lock deadline for ${organizationId}:`,
        error,
      );
    }
  }

  return {
    due: dueOrganizations.length,
    locked,
    unapplied,
    failed,
    hasMore: dueOrganizations.length === limit,
  };
}
