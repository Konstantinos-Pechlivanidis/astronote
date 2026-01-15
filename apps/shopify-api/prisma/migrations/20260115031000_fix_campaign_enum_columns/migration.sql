-- Fix Prisma ↔ DB enum mismatches for Campaign.status and Campaign.scheduleType
-- Root cause: DB columns were TEXT, but Prisma schema expects Postgres enums.
-- This breaks queries that compare/filter enum fields (e.g. enqueue transaction status transition).

-- 1) Ensure enums exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE lower(typname) = 'campaignstatus') THEN
    CREATE TYPE "CampaignStatus" AS ENUM (
      'draft',
      'scheduled',
      'sending',
      'sent',
      'failed',
      'cancelled',
      'paused',
      'completed'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE lower(typname) = 'scheduletype') THEN
    CREATE TYPE "ScheduleType" AS ENUM ('immediate', 'scheduled', 'recurring');
  END IF;
END
$$;

-- 2) Ensure enum values exist (older DBs may have enum but be missing newer values)
DO $$
BEGIN
  BEGIN
    ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'paused';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'completed';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;

-- 3) Convert TEXT columns to enums (only if not already enums)
DO $$
DECLARE
  status_data_type TEXT;
  status_udt TEXT;
  schedule_data_type TEXT;
  schedule_udt TEXT;
BEGIN
  SELECT data_type, udt_name
    INTO status_data_type, status_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'Campaign'
    AND column_name = 'status';

  IF status_data_type IS NOT NULL AND (status_data_type <> 'USER-DEFINED' OR lower(status_udt) <> 'campaignstatus') THEN
    -- Normalize unknown values to a safe default before casting.
    UPDATE "Campaign"
      SET "status" = 'draft'
    WHERE "status" IS NULL;

    UPDATE "Campaign"
      SET "status" = 'draft'
    WHERE "status" NOT IN ('draft','scheduled','sending','sent','failed','cancelled','paused','completed');

    ALTER TABLE "Campaign"
      ALTER COLUMN "status" TYPE "CampaignStatus"
      USING "status"::"CampaignStatus";

    ALTER TABLE "Campaign"
      ALTER COLUMN "status" SET DEFAULT 'draft';
  END IF;

  SELECT data_type, udt_name
    INTO schedule_data_type, schedule_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'Campaign'
    AND column_name = 'scheduleType';

  IF schedule_data_type IS NOT NULL AND (schedule_data_type <> 'USER-DEFINED' OR lower(schedule_udt) <> 'scheduletype') THEN
    UPDATE "Campaign"
      SET "scheduleType" = 'immediate'
    WHERE "scheduleType" IS NULL;

    UPDATE "Campaign"
      SET "scheduleType" = 'immediate'
    WHERE "scheduleType" NOT IN ('immediate','scheduled','recurring');

    ALTER TABLE "Campaign"
      ALTER COLUMN "scheduleType" TYPE "ScheduleType"
      USING "scheduleType"::"ScheduleType";

    ALTER TABLE "Campaign"
      ALTER COLUMN "scheduleType" SET DEFAULT 'immediate';
  END IF;
END
$$;


