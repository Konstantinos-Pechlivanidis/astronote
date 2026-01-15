-- Fix missing column: Template.isSystemDefault (Prisma expects Boolean default false)
-- Safe additive migration.

ALTER TABLE "Template"
ADD COLUMN IF NOT EXISTS "isSystemDefault" BOOLEAN NOT NULL DEFAULT false;


