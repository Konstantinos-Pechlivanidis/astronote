-- Add subscription interval + allowance tracking fields

-- Extend SubscriptionStatus enum (safe no-op if already added)
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'trialing';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'past_due';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'unpaid';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'incomplete';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'paused';

-- New enum for billing interval
DO $$ BEGIN
  CREATE TYPE "SubscriptionInterval" AS ENUM ('month', 'year');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "subscriptionInterval" "SubscriptionInterval",
  ADD COLUMN IF NOT EXISTS "subscriptionCurrentPeriodStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionCurrentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "includedSmsPerPeriod" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "usedSmsThisPeriod" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastBillingError" VARCHAR(255);

-- Best-effort backfill for interval + allowance based on planType
UPDATE "User"
SET "subscriptionInterval" = CASE
    WHEN "planType" = 'starter' THEN 'month'::"SubscriptionInterval"
    WHEN "planType" = 'pro' THEN 'year'::"SubscriptionInterval"
    ELSE "subscriptionInterval"
  END,
  "includedSmsPerPeriod" = CASE
    WHEN "planType" = 'starter' THEN 100
    WHEN "planType" = 'pro' THEN 500
    ELSE "includedSmsPerPeriod"
  END
WHERE "planType" IS NOT NULL;
