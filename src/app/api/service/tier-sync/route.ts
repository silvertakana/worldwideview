import { NextRequest, NextResponse } from "next/server";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { resolveOrgIdByEmail, setOrgTier } from "@/lib/org-tier";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = await crossServiceAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email;
  const tier = body.tier;
  const status = body.status;

  if (!email || !tier) {
    return NextResponse.json({ error: "Missing required fields: email, tier" }, { status: 400 });
  }

  if (typeof email !== "string" || typeof tier !== "string") {
    return NextResponse.json({ error: "email and tier must be strings" }, { status: 400 });
  }

  const validTiers = ["free", "pro", "enterprise"];
  if (!validTiers.includes(tier)) {
    return NextResponse.json({ error: `Invalid tier: ${tier}. Must be one of: ${validTiers.join(", ")}` }, { status: 400 });
  }

  const validStatuses = ["active", "trialing", "past_due", "suspended", "canceled"];
  if (status && typeof status === "string" && !validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  let trialEndsAt: Date | undefined;
  if (body.trialEndsAt) {
    trialEndsAt = new Date(body.trialEndsAt as string);
    if (isNaN(trialEndsAt.getTime())) {
      return NextResponse.json({ error: "Invalid trialEndsAt date" }, { status: 400 });
    }
  }

  const orgId = await resolveOrgIdByEmail(email);
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found for email" }, { status: 404 });
  }

  try {
    await setOrgTier(orgId, {
      tier: tier as string,
      status: (status as string) || "active",
      trialEndsAt,
    });
  } catch (e) {
    console.error("[tier-sync] Failed to upsert tier:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    organizationId: orgId,
    tier,
    status: status || "active",
  });
}
