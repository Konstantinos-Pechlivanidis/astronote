-- Add missing CampaignRecipient.bulkId column (safe, additive)
-- Fixes runtime Prisma error when code expects the bulkId field.

ALTER TABLE "CampaignRecipient"
ADD COLUMN IF NOT EXISTS "bulkId" TEXT;

CREATE INDEX IF NOT EXISTS "CampaignRecipient_bulkId_idx" ON "CampaignRecipient"("bulkId");


