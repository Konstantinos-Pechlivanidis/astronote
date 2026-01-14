-- Shopify Prisma schema sync (additive, non-destructive)
-- Purpose:
-- - Fill gaps where historical migrations do not create newer enums/tables required by current Prisma schema.
-- - Designed to be safe on existing DBs (IF NOT EXISTS / guarded DO blocks).
-- - Does NOT drop tables/columns (production-safe posture).

-- 1) Missing enums required by current datamodel
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScheduleType') THEN
    CREATE TYPE "ScheduleType" AS ENUM ('immediate', 'scheduled', 'recurring');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageDirection') THEN
    CREATE TYPE "MessageDirection" AS ENUM ('outbound', 'inbound');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageStatus') THEN
    CREATE TYPE "MessageStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'received');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionType') THEN
    CREATE TYPE "TransactionType" AS ENUM ('purchase', 'debit', 'credit', 'refund', 'adjustment');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AutomationTrigger') THEN
    CREATE TYPE "AutomationTrigger" AS ENUM (
      'welcome',
      'abandoned_cart',
      'order_confirmation',
      'shipping_update',
      'delivery_confirmation',
      'review_request',
      'reorder_reminder',
      'birthday',
      'customer_inactive',
      'cart_abandoned',
      'order_placed',
      'order_fulfilled',
      'cross_sell',
      'upsell'
    );
  END IF;
END $$;

-- 2) Newer tables required by current datamodel (create-if-missing)
-- Note: FKs are added only when referenced tables exist.

CREATE TABLE IF NOT EXISTS "UserAutomation" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "userMessage" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserAutomation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserAutomation_shopId_automationId_key') THEN
    ALTER TABLE "UserAutomation" ADD CONSTRAINT "UserAutomation_shopId_automationId_key" UNIQUE ("shopId", "automationId");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AbandonedCheckout" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "checkoutId" TEXT NOT NULL,
  "lineItems" JSONB NOT NULL,
  "subtotalPrice" TEXT,
  "currency" TEXT,
  "abandonedCheckoutUrl" TEXT,
  "abandonedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recoveredAt" TIMESTAMP(3),
  "scheduledJobIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AbandonedCheckout_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AbandonedCheckout_shopId_checkoutId_key') THEN
    ALTER TABLE "AbandonedCheckout" ADD CONSTRAINT "AbandonedCheckout_shopId_checkoutId_key" UNIQUE ("shopId", "checkoutId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AbandonedCheckout_shopId_contactId_idx" ON "AbandonedCheckout"("shopId", "contactId");
CREATE INDEX IF NOT EXISTS "AbandonedCheckout_shopId_abandonedAt_idx" ON "AbandonedCheckout"("shopId", "abandonedAt");
CREATE INDEX IF NOT EXISTS "AbandonedCheckout_shopId_recoveredAt_idx" ON "AbandonedCheckout"("shopId", "recoveredAt");
CREATE INDEX IF NOT EXISTS "AbandonedCheckout_contactId_idx" ON "AbandonedCheckout"("contactId");

CREATE TABLE IF NOT EXISTS "ScheduledAutomation" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "automationId" TEXT,
  "automationType" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "orderId" TEXT,
  "checkoutId" TEXT,
  "data" JSONB,
  "executedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledAutomation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduledAutomation_jobId_key') THEN
    ALTER TABLE "ScheduledAutomation" ADD CONSTRAINT "ScheduledAutomation_jobId_key" UNIQUE ("jobId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ScheduledAutomation_shopId_automationType_idx" ON "ScheduledAutomation"("shopId", "automationType");
CREATE INDEX IF NOT EXISTS "ScheduledAutomation_shopId_status_idx" ON "ScheduledAutomation"("shopId", "status");
CREATE INDEX IF NOT EXISTS "ScheduledAutomation_shopId_scheduledFor_idx" ON "ScheduledAutomation"("shopId", "scheduledFor");
CREATE INDEX IF NOT EXISTS "ScheduledAutomation_contactId_idx" ON "ScheduledAutomation"("contactId");
CREATE INDEX IF NOT EXISTS "ScheduledAutomation_orderId_idx" ON "ScheduledAutomation"("orderId");
CREATE INDEX IF NOT EXISTS "ScheduledAutomation_checkoutId_idx" ON "ScheduledAutomation"("checkoutId");

CREATE TABLE IF NOT EXISTS "AutomationSequence" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "sequenceType" TEXT NOT NULL,
  "currentStep" INTEGER NOT NULL DEFAULT 1,
  "totalSteps" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "scheduledJobs" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationSequence_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AutomationSequence_shopId_contactId_sequenceType_key') THEN
    ALTER TABLE "AutomationSequence" ADD CONSTRAINT "AutomationSequence_shopId_contactId_sequenceType_key" UNIQUE ("shopId", "contactId", "sequenceType");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AutomationSequence_shopId_status_idx" ON "AutomationSequence"("shopId", "status");
CREATE INDEX IF NOT EXISTS "AutomationSequence_contactId_idx" ON "AutomationSequence"("contactId");

CREATE TABLE IF NOT EXISTS "EventProcessingState" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "automationType" TEXT NOT NULL,
  "lastEventId" TEXT,
  "lastProcessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventProcessingState_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventProcessingState_shopId_automationType_key') THEN
    ALTER TABLE "EventProcessingState" ADD CONSTRAINT "EventProcessingState_shopId_automationType_key" UNIQUE ("shopId", "automationType");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EventProcessingState_shopId_automationType_idx" ON "EventProcessingState"("shopId", "automationType");

CREATE TABLE IF NOT EXISTS "BillingTransaction" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "creditsAdded" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "stripeSessionId" TEXT,
  "stripePaymentId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingTransaction_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillingTransaction_shopId_idempotencyKey_key') THEN
    ALTER TABLE "BillingTransaction" ADD CONSTRAINT "BillingTransaction_shopId_idempotencyKey_key" UNIQUE ("shopId", "idempotencyKey");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BillingTransaction_shopId_createdAt_idx" ON "BillingTransaction"("shopId", "createdAt");
CREATE INDEX IF NOT EXISTS "BillingTransaction_stripeSessionId_idx" ON "BillingTransaction"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "BillingTransaction_stripePaymentId_idx" ON "BillingTransaction"("stripePaymentId");

CREATE TABLE IF NOT EXISTS "CreditReservation" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "reservationKey" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditReservation_shopId_reservationKey_key') THEN
    ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_shopId_reservationKey_key" UNIQUE ("shopId", "reservationKey");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CreditReservation_shopId_idx" ON "CreditReservation"("shopId");
CREATE INDEX IF NOT EXISTS "CreditReservation_campaignId_idx" ON "CreditReservation"("campaignId");
CREATE INDEX IF NOT EXISTS "CreditReservation_status_idx" ON "CreditReservation"("status");
CREATE INDEX IF NOT EXISTS "CreditReservation_expiresAt_idx" ON "CreditReservation"("expiresAt");
CREATE INDEX IF NOT EXISTS "CreditReservation_shopId_status_idx" ON "CreditReservation"("shopId", "status");


