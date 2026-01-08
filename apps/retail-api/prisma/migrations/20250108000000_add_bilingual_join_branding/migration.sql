-- Add bilingual fields to RetailJoinBranding
ALTER TABLE "RetailJoinBranding"
  ADD COLUMN "headlineEn" TEXT,
  ADD COLUMN "headlineEl" TEXT,
  ADD COLUMN "subheadlineEn" TEXT,
  ADD COLUMN "subheadlineEl" TEXT,
  ADD COLUMN "bulletsEn" JSONB,
  ADD COLUMN "bulletsEl" JSONB,
  ADD COLUMN "merchantBlurbEn" TEXT,
  ADD COLUMN "merchantBlurbEl" TEXT;

-- Migrate existing data to EN fields
UPDATE "RetailJoinBranding"
SET
  "headlineEn" = "marketingHeadline",
  "bulletsEn" = "marketingBullets",
  "merchantBlurbEn" = "merchantBlurb"
WHERE "marketingHeadline" IS NOT NULL
  OR "marketingBullets" IS NOT NULL
  OR "merchantBlurb" IS NOT NULL;

