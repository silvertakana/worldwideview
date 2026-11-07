-- CreateTable
CREATE TABLE "mcp_tool_usage_monthly" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "lastCallAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_tool_usage_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_tool_usage_monthly_keyId_periodStart_idx" ON "mcp_tool_usage_monthly"("keyId", "periodStart");

-- CreateIndex
CREATE INDEX "mcp_tool_usage_monthly_userId_periodStart_idx" ON "mcp_tool_usage_monthly"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "mcp_tool_usage_monthly_periodStart_toolName_idx" ON "mcp_tool_usage_monthly"("periodStart", "toolName");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tool_usage_monthly_keyId_periodStart_toolName_key" ON "mcp_tool_usage_monthly"("keyId", "periodStart", "toolName");
