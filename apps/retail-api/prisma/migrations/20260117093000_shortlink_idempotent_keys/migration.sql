-- Add hash-based idempotency and usage metadata for ShortLink
ALTER TABLE "ShortLink"
ADD COLUMN "longUrlHash" VARCHAR(64),
ADD COLUMN "longUrlNormalized" TEXT,
ADD COLUMN "lastUsedAt" TIMESTAMP;

CREATE INDEX "ShortLink_longUrlHash_idx" ON "ShortLink"("longUrlHash");
CREATE UNIQUE INDEX "ShortLink_ownerId_kind_longUrlHash_key" ON "ShortLink"("ownerId", "kind", "longUrlHash");
