ALTER TABLE "PublicLinkToken"
  ADD COLUMN "rotationEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "RetailBranding"
  ADD COLUMN "storeDisplayName" TEXT,
  ADD COLUMN "backgroundStyle" TEXT,
  ADD COLUMN "subheadline" TEXT,
  ADD COLUMN "benefitsJson" JSONB,
  ADD COLUMN "incentiveText" TEXT,
  ADD COLUMN "legalText" TEXT;
