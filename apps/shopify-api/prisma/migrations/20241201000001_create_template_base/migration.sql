-- Create base Template table (missing from init migration)
-- This migration is intentionally placed before subsequent Template ALTER migrations.
-- It creates the minimal table shape needed so later migrations can add/modify columns safely.

CREATE TABLE IF NOT EXISTS "Template" (
  "id" TEXT NOT NULL,
  "title" TEXT,
  "name" TEXT,
  "content" TEXT,
  "text" TEXT,
  "category" TEXT NOT NULL DEFAULT 'generic',
  "previewImage" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Template_category_idx" ON "Template"("category");
CREATE INDEX IF NOT EXISTS "Template_isPublic_idx" ON "Template"("isPublic");


