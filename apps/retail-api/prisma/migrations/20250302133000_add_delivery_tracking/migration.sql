-- Delivery tracking fields
ALTER TABLE "CampaignMessage"
  ADD COLUMN "acceptedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN "deliveryLastCheckedAt" TIMESTAMP WITH TIME ZONE;

ALTER TABLE "Campaign"
  ADD COLUMN "deliverySlaSeconds" INTEGER,
  ADD COLUMN "deliveryCompletedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN "lastDeliverySweepAt" TIMESTAMP WITH TIME ZONE;
