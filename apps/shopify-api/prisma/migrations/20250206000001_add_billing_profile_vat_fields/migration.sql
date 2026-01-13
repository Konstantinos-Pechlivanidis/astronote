-- Add VAT validation and business fields to ShopBillingProfile
-- Migration: 20250206000001_add_billing_profile_vat_fields

-- Add business and VAT validation fields
ALTER TABLE "ShopBillingProfile" ADD COLUMN IF NOT EXISTS "isBusiness" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopBillingProfile" ADD COLUMN IF NOT EXISTS "vatValidated" BOOLEAN;
ALTER TABLE "ShopBillingProfile" ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3);
ALTER TABLE "ShopBillingProfile" ADD COLUMN IF NOT EXISTS "validationSource" VARCHAR(32);
ALTER TABLE "ShopBillingProfile" ADD COLUMN IF NOT EXISTS "taxTreatment" VARCHAR(32);

-- Add index for business queries
CREATE INDEX IF NOT EXISTS "ShopBillingProfile_isBusiness_idx" ON "ShopBillingProfile"("isBusiness");

