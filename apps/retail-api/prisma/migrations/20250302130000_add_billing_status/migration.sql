-- Add billing tracking fields to CampaignMessage
CREATE TYPE "BillingStatus" AS ENUM ('pending', 'paid', 'failed');

ALTER TABLE "CampaignMessage"
  ADD COLUMN "billingStatus" "BillingStatus",
  ADD COLUMN "billingError" TEXT,
  ADD COLUMN "billedAt" TIMESTAMP WITH TIME ZONE;

-- Optional index to quickly find pending/failed billing messages
CREATE INDEX "CampaignMessage_billingStatus_idx" ON "CampaignMessage"("billingStatus");
