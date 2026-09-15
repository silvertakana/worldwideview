-- Enforce one membership row per (organization, user).
--
-- `member` only had plain indexes on organizationId and userId, so the same pair
-- could be inserted twice. Provisioning now decides "does this user already have a
-- workspace?" by reading this table, so a duplicate would let one user end up with
-- two workspaces. The unique index is what rules that out.
--
-- Existing duplicates cannot be papered over: CREATE UNIQUE INDEX fails while any
-- remain, and silently dropping the wrong row would strip a membership. So the
-- duplicates are collapsed first, keeping the oldest row of each pair (earliest
-- createdAt, tie-broken by id) and deleting the rest.

-- Collapse pre-existing duplicate memberships, keeping the oldest row per pair.
DELETE FROM "member" m
USING "member" keep
WHERE m."organizationId" = keep."organizationId"
  AND m."userId" = keep."userId"
  AND (
    keep."createdAt" < m."createdAt"
    OR (keep."createdAt" = m."createdAt" AND keep."id" < m."id")
  );

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "member_organizationId_userId_key" ON "member"("organizationId", "userId");
