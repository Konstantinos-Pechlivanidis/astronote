-- Add Campaign Parity Fields Migration
-- Migration: 20250127000004_add_campaign_parity_fields
-- Aligns Shopify Campaign and CampaignRecipient models with Retail canonical implementation

-- Ensure CampaignStatus enum exists (some environments were migrated before enums were introduced)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignStatus') THEN
    CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled');
  END IF;
END $$;

-- Add startedAt and finishedAt to Campaign model (aligned with Retail)
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);

-- Add failedAt to CampaignRecipient model (aligned with Retail)
ALTER TABLE "CampaignRecipient" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);

-- Add paused and completed to CampaignStatus enum (aligned with Retail)
-- Note: sent is kept for backward compatibility
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'completed';

-- Add indexes for new fields (if needed)
CREATE INDEX IF NOT EXISTS "Campaign_startedAt_idx" ON "Campaign"("startedAt");
CREATE INDEX IF NOT EXISTS "Campaign_finishedAt_idx" ON "Campaign"("finishedAt");
CREATE INDEX IF NOT EXISTS "CampaignRecipient_failedAt_idx" ON "CampaignRecipient"("failedAt");

