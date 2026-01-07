-- Add conversions counter to Campaign
ALTER TABLE "Campaign" ADD COLUMN "conversions" INTEGER NOT NULL DEFAULT 0;

-- ShortLink table for public short URLs
CREATE TABLE "ShortLink" (
    "id" SERIAL PRIMARY KEY,
    "shortCode" TEXT NOT NULL UNIQUE,
    "originalUrl" TEXT NOT NULL,
    "ownerId" INTEGER,
    "campaignId" INTEGER,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP WITH TIME ZONE,
    CONSTRAINT "ShortLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL
);

CREATE INDEX "ShortLink_shortCode_idx" ON "ShortLink"("shortCode");
CREATE INDEX "ShortLink_ownerId_idx" ON "ShortLink"("ownerId");
CREATE INDEX "ShortLink_campaignId_idx" ON "ShortLink"("campaignId");
