-- Add deliveryStatus and deliveredAt to CampaignMessage
ALTER TABLE "CampaignMessage"
  ADD COLUMN IF NOT EXISTS "deliveryStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP;

CREATE INDEX IF NOT EXISTS "CampaignMessage_deliveryStatus_idx" ON "CampaignMessage"("deliveryStatus");
