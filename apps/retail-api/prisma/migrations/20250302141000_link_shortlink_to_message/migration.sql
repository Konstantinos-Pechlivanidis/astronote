ALTER TABLE "ShortLink"
  ADD COLUMN "campaignMessageId" INTEGER;

ALTER TABLE "ShortLink"
  ADD CONSTRAINT "ShortLink_campaignMessageId_fkey"
  FOREIGN KEY ("campaignMessageId") REFERENCES "CampaignMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ShortLink_campaignMessageId_idx" ON "ShortLink"("campaignMessageId");
