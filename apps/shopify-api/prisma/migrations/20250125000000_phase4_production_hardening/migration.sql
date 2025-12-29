-- Phase 4 Production Hardening Migration
-- P0: Idempotency keys for financial operations
-- P0: Webhook replay protection
-- P0: Enqueue request tracking

-- Add idempotency key to CreditTransaction (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CreditTransaction') THEN
    ALTER TABLE "CreditTransaction" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "CreditTransaction_shopId_idempotencyKey_key" 
      ON "CreditTransaction"("shopId", "idempotencyKey") 
      WHERE "idempotencyKey" IS NOT NULL;
  END IF;
END $$;

-- Add idempotency key to BillingTransaction (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'BillingTransaction') THEN
    ALTER TABLE "BillingTransaction" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "BillingTransaction_shopId_idempotencyKey_key" 
      ON "BillingTransaction"("shopId", "idempotencyKey") 
      WHERE "idempotencyKey" IS NOT NULL;
  END IF;
END $$;

-- Add reservationKey to CreditReservation for idempotency (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CreditReservation') THEN
    ALTER TABLE "CreditReservation" ADD COLUMN IF NOT EXISTS "reservationKey" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "CreditReservation_shopId_reservationKey_key" 
      ON "CreditReservation"("shopId", "reservationKey") 
      WHERE "reservationKey" IS NOT NULL;
  END IF;
END $$;

-- Create WebhookEvent table for replay protection
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventHash" TEXT,
  "shopId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'received',
  "payload" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_eventId_key" 
  ON "WebhookEvent"("provider", "eventId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_shopId_idx" ON "WebhookEvent"("shopId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_status_idx" ON "WebhookEvent"("provider", "status");
CREATE INDEX IF NOT EXISTS "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

-- Create EnqueueRequest table for endpoint-level idempotency
CREATE TABLE IF NOT EXISTS "EnqueueRequest" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EnqueueRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EnqueueRequest_shopId_campaignId_idempotencyKey_key" 
  ON "EnqueueRequest"("shopId", "campaignId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "EnqueueRequest_campaignId_idx" ON "EnqueueRequest"("campaignId");
CREATE INDEX IF NOT EXISTS "EnqueueRequest_shopId_createdAt_idx" ON "EnqueueRequest"("shopId", "createdAt");

