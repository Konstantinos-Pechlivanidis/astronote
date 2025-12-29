-- Add unique constraint to prevent duplicate messages to same phone in same campaign
-- This ensures idempotency at the database level

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_phoneE164_key" ON "CampaignRecipient"("campaignId", "phoneE164");

