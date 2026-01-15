-- Add missing BillingTransaction.packageType (Prisma expects String, required)
-- Safe additive migration: uses IF NOT EXISTS and a default for existing rows.

ALTER TABLE "BillingTransaction"
ADD COLUMN IF NOT EXISTS "packageType" TEXT NOT NULL DEFAULT 'unknown';


