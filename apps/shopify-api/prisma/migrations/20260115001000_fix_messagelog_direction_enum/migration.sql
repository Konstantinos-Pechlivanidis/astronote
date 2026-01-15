-- Fix Postgres type mismatch: MessageLog.direction is TEXT in DB but Prisma uses enum MessageDirection.
-- Preferred alignment: convert DB column to USER-DEFINED enum "MessageDirection".

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageDirection') THEN
    CREATE TYPE "MessageDirection" AS ENUM ('outbound', 'inbound');
  END IF;
END $$;

-- Normalize existing values (safe even if 0 rows)
UPDATE "MessageLog"
SET "direction" = LOWER("direction")
WHERE "direction" IS NOT NULL;

-- Map common synonyms if any exist
UPDATE "MessageLog" SET "direction" = 'outbound' WHERE "direction" IN ('out', 'outgoing', 'send');
UPDATE "MessageLog" SET "direction" = 'inbound' WHERE "direction" IN ('in', 'incoming', 'receive', 'received');

-- Fail fast if unexpected values remain (prevents silent bad casts / data loss)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "MessageLog"
    WHERE "direction" IS NOT NULL
      AND "direction" NOT IN ('outbound', 'inbound')
  ) THEN
    RAISE EXCEPTION 'Invalid MessageLog.direction values present; cannot cast to MessageDirection enum';
  END IF;
END $$;

ALTER TABLE "MessageLog"
ALTER COLUMN "direction" TYPE "MessageDirection"
USING "direction"::"MessageDirection";


