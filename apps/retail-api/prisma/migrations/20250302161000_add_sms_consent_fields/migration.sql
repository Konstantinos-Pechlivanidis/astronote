ALTER TABLE "Contact"
  ADD COLUMN "smsConsentStatus" VARCHAR(40) NOT NULL DEFAULT 'unknown',
  ADD COLUMN "smsConsentAt" TIMESTAMP,
  ADD COLUMN "smsConsentSource" VARCHAR(80),
  ADD COLUMN "consentEvidence" JSONB;
