-- Add interval and pendingChange fields to Subscription table
-- Migration: 20250206000000_add_subscription_interval_fields
-- Adds fields for billing interval, pending changes, and reconciliation tracking

-- Step 1: Add interval field (nullable, will be backfilled from Shop.subscriptionInterval or inferred from priceId)
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "interval" VARCHAR(10);

-- Step 2: Add pending change tracking fields
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "pendingChangePlanCode" VARCHAR(50);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "pendingChangeInterval" VARCHAR(10);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "pendingChangeCurrency" VARCHAR(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "pendingChangeEffectiveAt" TIMESTAMP(3);

-- Step 3: Add reconciliation tracking fields
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "sourceOfTruth" VARCHAR(20);

-- Step 4: Add index for interval queries
CREATE INDEX IF NOT EXISTS "Subscription_interval_idx" ON "Subscription"("interval");

-- Step 5: Backfill interval from Shop.subscriptionInterval where available
-- This is safe because Shop.subscriptionInterval was added in an earlier migration
UPDATE "Subscription" s
SET "interval" = shop."subscriptionInterval"
FROM "Shop" shop
WHERE s."shopId" = shop.id
  AND shop."subscriptionInterval" IS NOT NULL
  AND s."interval" IS NULL;

-- Step 6: Set default interval to 'month' for any remaining NULL values
-- This is a safe default that matches legacy behavior (starter = monthly)
UPDATE "Subscription"
SET "interval" = 'month'
WHERE "interval" IS NULL;

