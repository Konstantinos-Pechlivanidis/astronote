-- Align billing schema with Prisma models

-- Package: add Stripe price ID fields + indexes + unique name
ALTER TABLE "public"."Package" ADD COLUMN IF NOT EXISTS "stripePriceIdEur" VARCHAR(255);
ALTER TABLE "public"."Package" ADD COLUMN IF NOT EXISTS "stripePriceIdUsd" VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS "Package_name_key" ON "public"."Package"("name");
CREATE INDEX IF NOT EXISTS "Package_stripePriceIdEur_idx" ON "public"."Package"("stripePriceIdEur");
CREATE INDEX IF NOT EXISTS "Package_stripePriceIdUsd_idx" ON "public"."Package"("stripePriceIdUsd");

-- Purchase: add missing Stripe fields, idempotency key, updatedAt, and indexes
ALTER TABLE "public"."Purchase" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "public"."Purchase" ADD COLUMN IF NOT EXISTS "stripeSessionId" VARCHAR(255);
ALTER TABLE "public"."Purchase" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" VARCHAR(255);
ALTER TABLE "public"."Purchase" ADD COLUMN IF NOT EXISTS "stripeCustomerId" VARCHAR(255);
ALTER TABLE "public"."Purchase" ADD COLUMN IF NOT EXISTS "stripePriceId" VARCHAR(255);
ALTER TABLE "public"."Purchase" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3);
ALTER TABLE "public"."Purchase" ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(128);
ALTER TABLE "public"."Purchase" ALTER COLUMN "status" SET DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_stripeSessionId_key" ON "public"."Purchase"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "Purchase_stripeSessionId_idx" ON "public"."Purchase"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "Purchase_stripePaymentIntentId_idx" ON "public"."Purchase"("stripePaymentIntentId");
CREATE INDEX IF NOT EXISTS "Purchase_status_idx" ON "public"."Purchase"("status");
CREATE INDEX IF NOT EXISTS "Purchase_createdAt_idx" ON "public"."Purchase"("createdAt");
CREATE INDEX IF NOT EXISTS "Purchase_ownerId_status_idx" ON "public"."Purchase"("ownerId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_ownerId_idempotencyKey_key" ON "public"."Purchase"("ownerId", "idempotencyKey");

-- CreditTransaction: missing indexes
CREATE INDEX IF NOT EXISTS "CreditTransaction_walletId_idx" ON "public"."CreditTransaction"("walletId");
CREATE INDEX IF NOT EXISTS "CreditTransaction_createdAt_idx" ON "public"."CreditTransaction"("createdAt");

-- Seed default credit packages (safe no-op if already present)
INSERT INTO "public"."Package" ("name", "units", "priceCents", "active", "createdAt", "updatedAt")
VALUES
  ('Starter 500', 500, 2790, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Professional 2000', 2000, 11160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Business 5000', 5000, 27900, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
