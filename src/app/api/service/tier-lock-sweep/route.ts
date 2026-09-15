import { NextRequest, NextResponse } from "next/server";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { sweepTierLockDeadlines } from "@/lib/org-tier-lock-sweep";

/**
 * Enforce tier-lock deadlines that have elapsed.
 *
 * Invoked by the scheduled reconciler with the same cross-service signature
 * (`X-Service-Signature`) as POST /api/service/tier-sync. This endpoint is what
 * makes a deferred lock actually fire: the hub only syncs tiers on webhook
 * events, and a cancellation is a one-off event it never resends, so a deadline
 * armed by a downgrade would otherwise never be evaluated again.
 *
 * Safe to call as often as the scheduler likes - enforcement is idempotent and
 * returns a summary the caller can log.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = await crossServiceAuth(request);
  if (authError) return authError;

  try {
    const result = await sweepTierLockDeadlines();

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("[tier-lock-sweep] Failed to enforce tier lock deadlines:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
