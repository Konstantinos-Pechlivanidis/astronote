-- Fix Template Unique Constraint
-- Migration: 20250130000001_fix_template_unique_constraint
-- 
-- Issue: The previous migration created a partial unique index, but Prisma's upsert
-- requires a full unique constraint. This migration fixes that.
--
-- IMPORTANT: This migration assumes shopId, eshopType, and templateKey are NOT NULL
-- for all templates that should be seeded. If there are NULL values, they need to be
-- handled separately.

-- Step 1: Drop the constraint first (which will also drop the index)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Template_shopId_eshopType_templateKey_key'
  ) THEN
    ALTER TABLE "Template" DROP CONSTRAINT "Template_shopId_eshopType_templateKey_key";
  END IF;
END $$;

-- Step 1b: Drop the partial unique index if it exists (as a separate index)
DROP INDEX IF EXISTS "Template_shopId_eshopType_templateKey_key";

-- Step 2: Ensure shopId, eshopType, and templateKey are NOT NULL for templates that should be seeded
-- (This is a safety check - if there are NULLs, we'll handle them)
UPDATE "Template" 
SET "eshopType" = 'generic' 
WHERE "eshopType" IS NULL AND "shopId" IS NOT NULL;

UPDATE "Template" 
SET "templateKey" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE("name", "title", 'template_' || "id"), '[^a-zA-Z0-9]+', '_', 'g'), '^_|_$', '', 'g'))
WHERE "templateKey" IS NULL AND "shopId" IS NOT NULL;

-- Step 3: Create the proper unique constraint (not a partial index)
-- This will fail if duplicates exist, so we need to handle duplicates first
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Check for duplicates
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "shopId", "eshopType", "templateKey", COUNT(*) as cnt
    FROM "Template"
    WHERE "shopId" IS NOT NULL 
      AND "eshopType" IS NOT NULL 
      AND "templateKey" IS NOT NULL
    GROUP BY "shopId", "eshopType", "templateKey"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate template combinations. Please resolve duplicates before running this migration.', duplicate_count;
  END IF;
END $$;

-- Step 4: Create the unique constraint
-- Note: Prisma will recognize this as the @@unique constraint defined in schema.prisma
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Template_shopId_eshopType_templateKey_key'
  ) THEN
    ALTER TABLE "Template" 
    ADD CONSTRAINT "Template_shopId_eshopType_templateKey_key" 
    UNIQUE ("shopId", "eshopType", "templateKey");
  END IF;
END $$;

-- Step 5: Verify the constraint was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Template_shopId_eshopType_templateKey_key'
  ) THEN
    RAISE EXCEPTION 'Failed to create unique constraint Template_shopId_eshopType_templateKey_key';
  END IF;
END $$;

