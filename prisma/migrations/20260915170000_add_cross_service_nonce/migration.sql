-- Cross-service nonce replay protection, durable across restarts and instances.
--
-- The previous per-process Map lost every recorded nonce on restart and could
-- not see nonces recorded by a sibling instance (pm2 runs four), so the ledger
-- moves into this table. IF NOT EXISTS keeps this safe in the documented dev
-- flow, where `pnpm dev` runs `prisma db push` (which creates the table from the
-- schema) before the container ever runs `prisma migrate deploy`: without it the
-- deploy fails with 42P07 (relation already exists) and docker-entrypoint.sh
-- exits on that error instead of baselining, crash-looping the container.

-- CreateTable
CREATE TABLE IF NOT EXISTS "cross_service_nonces" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_service_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "cross_service_nonces_nonce_key" ON "cross_service_nonces"("nonce");

-- Serves the prune sweep, which deletes expired rows by expiresAt.
CREATE INDEX IF NOT EXISTS "cross_service_nonces_expiresAt_idx" ON "cross_service_nonces"("expiresAt");
