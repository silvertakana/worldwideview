-- Paid-through date for the subscription, forwarded by the hub as an optional
-- `periodEndsAt` on POST /api/service/tier-sync.
--
-- The deferred-lock policy uses it as a floor on the lock deadline: a workspace
-- must never lock before the date the customer has already paid for. It is
-- nullable because the hub does not always know it, in which case the tier
-- downgrade grace window applies instead.
ALTER TABLE "org_tiers" ADD COLUMN IF NOT EXISTS "periodEndsAt" TIMESTAMP(3);
