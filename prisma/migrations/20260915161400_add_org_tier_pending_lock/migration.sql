-- Deferred tier-downgrade lock.
--
-- A downgrade no longer locks workspaces immediately: `setOrgTier` records the
-- deadline here and only locks once the deadline elapses. IF NOT EXISTS keeps
-- this safe in the documented dev flow, where `pnpm dev` runs `prisma db push`
-- (which creates these columns from the schema) before the container ever runs
-- `prisma migrate deploy`.
ALTER TABLE "org_tiers" ADD COLUMN IF NOT EXISTS "pendingLockAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "pendingLockReason" TEXT;

-- Serves the deadline sweep, which looks up `pendingLockAt <= now` on every run.
CREATE INDEX IF NOT EXISTS "org_tiers_pendingLockAt_idx" ON "org_tiers"("pendingLockAt");
