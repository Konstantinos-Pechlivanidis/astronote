-- Remove Campaign.templateId foreign key and column
-- Templates are now a copy-paste library only, no association with campaigns

-- Step 1: Drop foreign key constraint
ALTER TABLE "public"."Campaign" DROP CONSTRAINT IF EXISTS "Campaign_templateId_fkey";

-- Step 2: Drop the templateId column
ALTER TABLE "public"."Campaign" DROP COLUMN IF EXISTS "templateId";

-- Note: messageText is now required (NOT NULL) and should be populated from existing template text
-- If there are existing campaigns with templateId, you may need to backfill messageText:
-- UPDATE "public"."Campaign" SET "messageText" = (SELECT text FROM "public"."MessageTemplate" WHERE id = "Campaign"."templateId") WHERE "templateId" IS NOT NULL AND ("messageText" IS NULL OR "messageText" = '');

