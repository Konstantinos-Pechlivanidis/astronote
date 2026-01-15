-- Add missing CampaignMetrics.totalProcessed column (safe, additive)
-- Fixes runtime Prisma error: The column `totalProcessed` does not exist in the current database.

ALTER TABLE "CampaignMetrics"
ADD COLUMN IF NOT EXISTS "totalProcessed" INTEGER NOT NULL DEFAULT 0;


