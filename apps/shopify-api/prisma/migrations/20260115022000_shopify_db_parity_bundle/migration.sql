-- Shopify DB parity bundle (safe, additive)
-- Adds missing columns detected by scripts/prisma-db-parity.mjs

ALTER TABLE "CampaignRecipient"
ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;


