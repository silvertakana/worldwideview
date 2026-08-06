import { NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/ba-org";
import { getEffectiveTier } from "@/lib/org-tier";
import { hasMinimumPlan } from "./planGating";

export async function requirePlan(minimum: "free" | "pro" | "team" | "enterprise"): Promise<NextResponse | null> {
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const { tier, status } = await getEffectiveTier(orgId);

  if (status === "suspended") {
    return NextResponse.json({ error: "Subscription suspended" }, { status: 402 });
  }

  if (!hasMinimumPlan(tier, minimum)) {
    return NextResponse.json(
      { error: "Upgrade required", required: minimum, current: tier },
      { status: 402 }
    );
  }

  return null;
}
