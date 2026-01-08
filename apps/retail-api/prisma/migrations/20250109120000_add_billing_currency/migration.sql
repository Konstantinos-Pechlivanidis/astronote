-- Add billing currency preference for tenants
CREATE TYPE "BillingCurrency" AS ENUM ('EUR', 'USD');

ALTER TABLE "User"
ADD COLUMN "billingCurrency" "BillingCurrency" NOT NULL DEFAULT 'EUR';

ALTER TABLE "Package"
ADD COLUMN "priceCentsUsd" INTEGER;

UPDATE "Package"
SET "priceCentsUsd" = "priceCents"
WHERE "priceCentsUsd" IS NULL;
