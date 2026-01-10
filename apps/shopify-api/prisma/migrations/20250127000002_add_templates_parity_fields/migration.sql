-- Add Templates Parity Fields Migration
-- Migration: 20250127000002_add_templates_parity_fields
-- Aligns Shopify templates with Retail architecture + adds Shopify-specific eShop type categorization

-- Step 1: Create EshopType enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EshopType') THEN
    CREATE TYPE "EshopType" AS ENUM ('fashion', 'beauty', 'electronics', 'food', 'services', 'home', 'sports', 'books', 'toys', 'generic');
  END IF;
END $$;

-- Step 2: Add eshopType to Shop model
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "eshopType" "EshopType";
CREATE INDEX IF NOT EXISTS "Shop_eshopType_idx" ON "Shop"("eshopType");

-- Step 3: Add tenant scoping and Retail-aligned fields to Template model
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "eshopType" "EshopType";
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "templateKey" TEXT;
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "text" TEXT;
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "goal" VARCHAR(200);
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "suggestedMetrics" VARCHAR(500);

-- Step 4: Backfill name/text from title/content for existing templates
UPDATE "Template" SET "name" = "title" WHERE "name" IS NULL AND "title" IS NOT NULL;
UPDATE "Template" SET "text" = "content" WHERE "text" IS NULL AND "content" IS NOT NULL;

-- Step 5: Generate templateKey for existing templates (if missing)
-- Use a slugified version of title as templateKey
UPDATE "Template" SET "templateKey" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("title", '[^a-zA-Z0-9]+', '_', 'g'), '^_|_$', '', 'g'))
WHERE "templateKey" IS NULL AND "title" IS NOT NULL;

-- Step 6: Set default eshopType for existing templates (if missing)
-- Default to 'generic' for existing templates
UPDATE "Template" SET "eshopType" = 'generic' WHERE "eshopType" IS NULL;

-- Step 7: Set default shopId for existing templates (if missing)
-- Note: This is a data migration concern. For existing public templates, we need to decide:
-- Option A: Assign to a system shop (if exists)
-- Option B: Mark as orphaned and require manual assignment
-- For now, we'll set shopId to NULL and require manual assignment (safer)
-- Templates without shopId will need to be migrated manually or assigned during ensure-defaults

-- Step 8: Make shopId required for new templates (but allow NULL for migration period)
-- We'll add NOT NULL constraint after data migration is complete

-- Step 9: Create unique constraint for (shopId, eshopType, templateKey)
-- Note: This will fail if duplicates exist. Handle duplicates first if needed.
-- For now, we create a partial unique index that allows NULL shopId (for migration period)
CREATE UNIQUE INDEX IF NOT EXISTS "Template_shopId_eshopType_templateKey_key" 
ON "Template"("shopId", "eshopType", "templateKey") 
WHERE "shopId" IS NOT NULL AND "eshopType" IS NOT NULL AND "templateKey" IS NOT NULL;

-- Step 10: Create indexes for filtering
CREATE INDEX IF NOT EXISTS "Template_shopId_eshopType_idx" ON "Template"("shopId", "eshopType");
CREATE INDEX IF NOT EXISTS "Template_eshopType_idx" ON "Template"("eshopType");
CREATE INDEX IF NOT EXISTS "Template_language_idx" ON "Template"("language");
CREATE INDEX IF NOT EXISTS "Template_category_idx" ON "Template"("category");

-- Step 11: Update isPublic default to false (templates are now tenant-scoped)
-- Note: Existing templates will keep their current isPublic value
-- New templates will default to false

-- Step 12: Add foreign key constraint for shopId (after ensuring Shop table exists)
-- Note: This assumes Shop table already exists. If not, create it first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Template_shopId_fkey'
  ) THEN
    ALTER TABLE "Template" 
    ADD CONSTRAINT "Template_shopId_fkey" 
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- Step 13: Update TemplateUsage relation name (if needed)
-- The relation name change from "templates" to "templateUsage" in Shop model is handled by Prisma
-- No SQL migration needed for relation name changes

