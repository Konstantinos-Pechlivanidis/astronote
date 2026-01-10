-- Add Retail-aligned fields to Contact model for contacts parity
-- Migration: 20250127000001_add_contacts_parity_fields

-- Add smsConsentStatus (string field for Retail alignment)
ALTER TABLE "Contact" ADD COLUMN "smsConsentStatus" VARCHAR(40);

-- Add smsConsentAt (timestamp when consent was given/revoked)
ALTER TABLE "Contact" ADD COLUMN "smsConsentAt" TIMESTAMP(3);

-- Add smsConsentSource (source of consent, e.g., "manual", "import", "unsubscribe_link")
ALTER TABLE "Contact" ADD COLUMN "smsConsentSource" VARCHAR(80);

-- Add isSubscribed (boolean subscription state, aligned with Retail)
ALTER TABLE "Contact" ADD COLUMN "isSubscribed" BOOLEAN NOT NULL DEFAULT true;

-- Add unsubscribeTokenHash (hash for secure unsubscribe links, aligned with Retail)
ALTER TABLE "Contact" ADD COLUMN "unsubscribeTokenHash" VARCHAR(64);

-- Add unsubscribedAt (timestamp when contact unsubscribed)
ALTER TABLE "Contact" ADD COLUMN "unsubscribedAt" TIMESTAMP(3);

-- Create indexes for new fields (aligned with Retail)
CREATE INDEX "Contact_shopId_smsConsentStatus_idx" ON "Contact"("shopId", "smsConsentStatus");
CREATE INDEX "Contact_shopId_isSubscribed_idx" ON "Contact"("shopId", "isSubscribed");
CREATE INDEX "Contact_unsubscribeTokenHash_idx" ON "Contact"("unsubscribeTokenHash");

-- Backfill existing data:
-- Set isSubscribed based on smsConsent enum
UPDATE "Contact" SET "isSubscribed" = true WHERE "smsConsent" = 'opted_in';
UPDATE "Contact" SET "isSubscribed" = false WHERE "smsConsent" = 'opted_out';
-- Set smsConsentStatus based on smsConsent enum
UPDATE "Contact" SET "smsConsentStatus" = 'opted_in' WHERE "smsConsent" = 'opted_in';
UPDATE "Contact" SET "smsConsentStatus" = 'opted_out' WHERE "smsConsent" = 'opted_out';
-- Leave smsConsentStatus as NULL for 'unknown' (no explicit consent)

