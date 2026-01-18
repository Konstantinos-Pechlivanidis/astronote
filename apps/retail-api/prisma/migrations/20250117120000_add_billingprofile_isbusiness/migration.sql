-- Add missing BillingProfile.isBusiness column (nullable to match Prisma schema)
ALTER TABLE "BillingProfile" ADD COLUMN IF NOT EXISTS "isBusiness" BOOLEAN;
