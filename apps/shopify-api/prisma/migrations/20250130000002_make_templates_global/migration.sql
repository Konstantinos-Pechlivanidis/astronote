-- Make Templates Global/Public
-- Migration: 20250130000002_make_templates_global
--
-- This migration enables global/public templates that are visible to all shops.
-- Global templates have shopId = NULL and isPublic = true.
-- Shop-specific templates have shopId set and can be isPublic = false or true.

-- Step 1: Make shopId nullable for global templates
ALTER TABLE "Template" ALTER COLUMN "shopId" DROP NOT NULL;

-- Step 2: Update foreign key constraint to allow NULL shopId
-- Drop the existing foreign key constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Template_shopId_fkey'
  ) THEN
    ALTER TABLE "Template" DROP CONSTRAINT "Template_shopId_fkey";
  END IF;
END $$;

-- Recreate foreign key with ON DELETE SET NULL for global templates
ALTER TABLE "Template" 
ADD CONSTRAINT "Template_shopId_fkey" 
FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL;

-- Step 3: Update unique constraint to handle NULL shopId
-- Drop the constraint first (which will also drop the index)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Template_shopId_eshopType_templateKey_key'
  ) THEN
    ALTER TABLE "Template" DROP CONSTRAINT "Template_shopId_eshopType_templateKey_key";
  END IF;
END $$;

-- Drop the index if it exists as a separate index (not part of constraint)
DROP INDEX IF EXISTS "Template_shopId_eshopType_templateKey_key";

-- Create new unique constraint that allows NULL shopId for global templates
-- For global templates (shopId IS NULL): unique on (eshopType, templateKey)
-- For shop-specific templates (shopId IS NOT NULL): unique on (shopId, eshopType, templateKey)
-- We use a partial unique index for global templates and a constraint for shop-specific
CREATE UNIQUE INDEX "Template_global_eshopType_templateKey_key" 
ON "Template"("eshopType", "templateKey") 
WHERE "shopId" IS NULL;

-- For shop-specific templates, use a regular unique constraint
ALTER TABLE "Template" 
ADD CONSTRAINT "Template_shopId_eshopType_templateKey_key" 
UNIQUE ("shopId", "eshopType", "templateKey");

-- Step 4: Set isPublic = true for existing templates that should be global
-- (This is a data migration - you may want to review existing templates)
-- For now, we'll leave existing templates as-is (shop-specific)
-- New global templates will be created with shopId = NULL and isPublic = true

-- Step 5: Add index for isPublic to speed up global template queries
CREATE INDEX IF NOT EXISTS "Template_isPublic_idx" ON "Template"("isPublic");

-- Step 6: Add index for global template queries (shopId IS NULL)
CREATE INDEX IF NOT EXISTS "Template_shopId_null_idx" ON "Template"("shopId") 
WHERE "shopId" IS NULL;

