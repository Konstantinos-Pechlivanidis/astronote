-- Add processing status to MessageStatus enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'MessageStatus' AND e.enumlabel = 'processing'
  ) THEN
    ALTER TYPE "MessageStatus" ADD VALUE 'processing';
  END IF;
END
$$;

-- Add claim/idempotency columns to CampaignMessage
ALTER TABLE "CampaignMessage"
  ADD COLUMN IF NOT EXISTS "sendClaimedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "sendClaimToken" TEXT,
  ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;

-- Ensure indexes for claim fields
CREATE INDEX IF NOT EXISTS "CampaignMessage_sendClaimToken_idx" ON "CampaignMessage"("sendClaimToken");
CREATE INDEX IF NOT EXISTS "CampaignMessage_sendClaimedAt_idx" ON "CampaignMessage"("sendClaimedAt");
