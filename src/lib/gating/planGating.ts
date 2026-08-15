export const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  pro: 1,
  team: 2,
  enterprise: 3,
};

export function hasMinimumPlan(userPlan: string, minimum: string): boolean {
  const userRank = PLAN_HIERARCHY[userPlan] ?? 0;
  const minRank = PLAN_HIERARCHY[minimum] ?? 0;
  return userRank >= minRank;
}
