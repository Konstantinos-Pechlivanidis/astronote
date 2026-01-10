-- Add Subscription Allowance Tracking Fields
-- Migration: 20250127000003_add_subscription_allowance_tracking
-- Adds fields for monthly/yearly interval, billing period tracking, and free SMS allowance

-- Step 1: Add subscription interval field
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "subscriptionInterval" TEXT;

-- Step 2: Add billing period tracking fields
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Add allowance tracking fields
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "includedSmsPerPeriod" INTEGER;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "usedSmsThisPeriod" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "lastPeriodResetAt" TIMESTAMP(3);

-- Step 4: Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS "Shop_subscriptionInterval_idx" ON "Shop"("subscriptionInterval");
CREATE INDEX IF NOT EXISTS "Shop_currentPeriodStart_idx" ON "Shop"("currentPeriodStart");
CREATE INDEX IF NOT EXISTS "Shop_currentPeriodEnd_idx" ON "Shop"("currentPeriodEnd");

