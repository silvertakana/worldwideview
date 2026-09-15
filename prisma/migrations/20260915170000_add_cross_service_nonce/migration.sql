-- CreateTable
CREATE TABLE "cross_service_nonces" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_service_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cross_service_nonces_nonce_key" ON "cross_service_nonces"("nonce");

-- CreateIndex
CREATE INDEX "cross_service_nonces_expiresAt_idx" ON "cross_service_nonces"("expiresAt");
