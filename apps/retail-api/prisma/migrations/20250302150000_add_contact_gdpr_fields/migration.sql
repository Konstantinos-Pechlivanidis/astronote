ALTER TABLE "Contact"
  ADD COLUMN "gdprConsentAt" TIMESTAMP,
  ADD COLUMN "gdprConsentSource" VARCHAR(80),
  ADD COLUMN "gdprConsentVersion" VARCHAR(80);
