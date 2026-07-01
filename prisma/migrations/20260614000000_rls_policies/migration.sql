-- DropIndex
DROP INDEX IF EXISTS "users_tenantId_email_key";

-- AlterTable: Remove tenantId column from users (IF EXISTS for idempotency)
ALTER TABLE "users" DROP COLUMN IF EXISTS "tenantId";

-- AlterTable: Add workspace tenant foundation fields
ALTER TABLE "workspaces" ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateIndex: RLS-performance indices on tenantId for all scoped tables
CREATE INDEX "favorites_tenantId_idx" ON "favorites"("tenantId");
CREATE INDEX "installed_plugins_tenantId_idx" ON "installed_plugins"("tenantId");
CREATE INDEX "marketplace_credentials_tenantId_idx" ON "marketplace_credentials"("tenantId");
CREATE INDEX "settings_tenantId_idx" ON "settings"("tenantId");
CREATE INDEX "user_api_keys_tenantId_idx" ON "user_api_keys"("tenantId");

-- CreateIndex: New unique constraint on users.email (replaces composite tenantId+email)
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- ============================================================
-- PostgreSQL Row-Level Security (RLS) — Defense-in-depth
-- ============================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE "favorites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "installed_plugins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketplace_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_api_keys" ENABLE ROW LEVEL SECURITY;

-- RLS policy: each scoped table filters by app.current_tenant_id
-- The db.ts Prisma extension sets app.current_tenant_id via SELECT set_config()
-- BEFORE any query executes. The policy compares the row's tenantId against
-- the session variable (both TEXT). Rows with NULL tenantId are invisible
-- to tenant-scoped queries, which is correct for post-backfill state.

CREATE POLICY tenant_isolation ON "favorites"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation ON "installed_plugins"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation ON "settings"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation ON "marketplace_credentials"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation ON "user_api_keys"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);
