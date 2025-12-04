-- Migration: Add Queue, Session, and Rate Limit models
-- Date: 2024-12-XX

-- QueueJob model for database-based queue system
CREATE TABLE IF NOT EXISTS "QueueJob" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "delay" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "result" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QueueJob_queueName_status_idx" ON "QueueJob"("queueName", "status");
CREATE INDEX IF NOT EXISTS "QueueJob_status_createdAt_idx" ON "QueueJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "QueueJob_delay_idx" ON "QueueJob"("delay") WHERE "delay" IS NOT NULL;

-- ShopifySession model for session storage
CREATE TABLE IF NOT EXISTS "ShopifySession" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT,
    "userId" TEXT,
    "sessionData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifySession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShopifySession_shop_idx" ON "ShopifySession"("shop");
CREATE INDEX IF NOT EXISTS "ShopifySession_expires_idx" ON "ShopifySession"("expires") WHERE "expires" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ShopifySession_shop_isOnline_idx" ON "ShopifySession"("shop", "isOnline");

-- RateLimitRecord model for database-based rate limiting
CREATE TABLE IF NOT EXISTS "RateLimitRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RateLimitRecord_key_createdAt_idx" ON "RateLimitRecord"("key", "createdAt");
CREATE INDEX IF NOT EXISTS "RateLimitRecord_createdAt_idx" ON "RateLimitRecord"("createdAt");

