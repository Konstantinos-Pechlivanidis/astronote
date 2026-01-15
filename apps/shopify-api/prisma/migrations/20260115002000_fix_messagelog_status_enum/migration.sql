-- Fix Postgres type mismatch: MessageLog.status is TEXT in DB but Prisma uses enum MessageStatus.
-- Preferred alignment: convert DB column to USER-DEFINED enum "MessageStatus".

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageStatus') THEN
    CREATE TYPE "MessageStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'received');
  END IF;
END $$;

-- Normalize existing values (safe even if 0 rows)
UPDATE "MessageLog"
SET "status" = LOWER("status")
WHERE "status" IS NOT NULL;

-- Map common synonyms if any exist
UPDATE "MessageLog" SET "status" = 'sent' WHERE "status" IN ('accepted');

-- Fail fast if unexpected values remain (prevents silent bad casts / data loss)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "MessageLog"
    WHERE "status" IS NOT NULL
      AND "status" NOT IN ('queued', 'sent', 'delivered', 'failed', 'received')
  ) THEN
    RAISE EXCEPTION 'Invalid MessageLog.status values present; cannot cast to MessageStatus enum';
  END IF;
END $$;

ALTER TABLE "MessageLog"
ALTER COLUMN "status" TYPE "MessageStatus"
USING "status"::"MessageStatus";


