-- Customer events + automation library
DO $$ BEGIN
  CREATE TYPE "BusinessProfile" AS ENUM ('retail', 'gym', 'appointments', 'hotel', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerEventType" AS ENUM ('appointment', 'membership', 'stay', 'purchase', 'visit', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerEventStatus" AS ENUM ('scheduled', 'completed', 'canceled', 'no_show');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationTriggerType" AS ENUM ('event', 'inactivity', 'birthday');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationEventTimeField" AS ENUM ('startAt', 'endAt');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "businessProfile" "BusinessProfile" NOT NULL DEFAULT 'retail';
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "serviceAllowed" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "CustomerEvent" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL,
  "contactId" INTEGER,
  "phoneE164" TEXT,
  "externalRef" VARCHAR(120),
  "eventType" "CustomerEventType" NOT NULL,
  "status" "CustomerEventStatus" NOT NULL DEFAULT 'scheduled',
  "startAt" TIMESTAMP,
  "endAt" TIMESTAMP,
  "meta" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "CustomerEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "CustomerEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "CustomerEvent_ownerId_idx" ON "CustomerEvent"("ownerId");
CREATE INDEX IF NOT EXISTS "CustomerEvent_contactId_idx" ON "CustomerEvent"("contactId");
CREATE INDEX IF NOT EXISTS "CustomerEvent_eventType_idx" ON "CustomerEvent"("eventType");
CREATE INDEX IF NOT EXISTS "CustomerEvent_status_idx" ON "CustomerEvent"("status");
CREATE INDEX IF NOT EXISTS "CustomerEvent_startAt_idx" ON "CustomerEvent"("startAt");
CREATE INDEX IF NOT EXISTS "CustomerEvent_endAt_idx" ON "CustomerEvent"("endAt");
CREATE INDEX IF NOT EXISTS "CustomerEvent_ownerId_eventType_idx" ON "CustomerEvent"("ownerId", "eventType");
CREATE INDEX IF NOT EXISTS "CustomerEvent_ownerId_status_idx" ON "CustomerEvent"("ownerId", "status");

CREATE TABLE IF NOT EXISTS "AutomationRule" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL,
  "presetKey" VARCHAR(120) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "description" VARCHAR(400),
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "messageType" "MessageType" NOT NULL DEFAULT 'marketing',
  "messageBody" TEXT NOT NULL,
  "triggerType" "AutomationTriggerType" NOT NULL,
  "eventType" "CustomerEventType",
  "eventStatus" "CustomerEventStatus",
  "eventTimeField" "AutomationEventTimeField" NOT NULL DEFAULT 'startAt',
  "offsetMinutes" INTEGER NOT NULL DEFAULT 0,
  "inactivityDays" INTEGER,
  "dedupeWindowMinutes" INTEGER NOT NULL DEFAULT 1440,
  "maxPerContactPerDay" INTEGER NOT NULL DEFAULT 1,
  "lastRunAt" TIMESTAMP,
  "meta" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "AutomationRule_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationRule_ownerId_presetKey_key" ON "AutomationRule"("ownerId", "presetKey");
CREATE INDEX IF NOT EXISTS "AutomationRule_ownerId_idx" ON "AutomationRule"("ownerId");
CREATE INDEX IF NOT EXISTS "AutomationRule_ownerId_isActive_idx" ON "AutomationRule"("ownerId", "isActive");
CREATE INDEX IF NOT EXISTS "AutomationRule_triggerType_idx" ON "AutomationRule"("triggerType");
CREATE INDEX IF NOT EXISTS "AutomationRule_eventType_idx" ON "AutomationRule"("eventType");

CREATE TABLE IF NOT EXISTS "AutomationSend" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL,
  "ruleId" INTEGER NOT NULL,
  "contactId" INTEGER NOT NULL,
  "eventId" INTEGER,
  "messageType" "MessageType" NOT NULL DEFAULT 'marketing',
  "messageBody" TEXT NOT NULL,
  "status" "MessageStatus" NOT NULL DEFAULT 'queued',
  "scheduledFor" TIMESTAMP NOT NULL,
  "providerMessageId" TEXT,
  "error" TEXT,
  "sentAt" TIMESTAMP,
  "failedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "AutomationSend_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "AutomationSend_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE,
  CONSTRAINT "AutomationSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE,
  CONSTRAINT "AutomationSend_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CustomerEvent"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationSend_ruleId_contactId_scheduledFor_key" ON "AutomationSend"("ruleId", "contactId", "scheduledFor");
CREATE INDEX IF NOT EXISTS "AutomationSend_ownerId_idx" ON "AutomationSend"("ownerId");
CREATE INDEX IF NOT EXISTS "AutomationSend_ruleId_idx" ON "AutomationSend"("ruleId");
CREATE INDEX IF NOT EXISTS "AutomationSend_contactId_idx" ON "AutomationSend"("contactId");
CREATE INDEX IF NOT EXISTS "AutomationSend_eventId_idx" ON "AutomationSend"("eventId");
CREATE INDEX IF NOT EXISTS "AutomationSend_status_idx" ON "AutomationSend"("status");
CREATE INDEX IF NOT EXISTS "AutomationSend_scheduledFor_idx" ON "AutomationSend"("scheduledFor");
CREATE INDEX IF NOT EXISTS "AutomationSend_ownerId_status_idx" ON "AutomationSend"("ownerId", "status");
