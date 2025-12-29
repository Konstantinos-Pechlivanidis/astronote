-- Add new fields to Segment model
ALTER TABLE "Segment" ADD COLUMN IF NOT EXISTS "key" TEXT;
ALTER TABLE "Segment" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'custom';
ALTER TABLE "Segment" ADD COLUMN IF NOT EXISTS "criteriaJson" JSONB;
ALTER TABLE "Segment" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;

-- Add unique constraint for system segments (shopId + key)
CREATE UNIQUE INDEX IF NOT EXISTS "Segment_shopId_key_key" ON "Segment"("shopId", "key") WHERE "key" IS NOT NULL;

-- Add index for type
CREATE INDEX IF NOT EXISTS "Segment_shopId_type_idx" ON "Segment"("shopId", "type");

-- Add index for key
CREATE INDEX IF NOT EXISTS "Segment_shopId_key_idx" ON "Segment"("shopId", "key") WHERE "key" IS NOT NULL;

-- Add meta field to Campaign
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "meta" JSONB;

-- Add baseUrl to ShopSettings
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "baseUrl" TEXT;

