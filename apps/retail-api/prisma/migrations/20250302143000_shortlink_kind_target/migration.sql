ALTER TABLE "ShortLink"
  ADD COLUMN "kind" TEXT,
  ADD COLUMN "targetUrl" TEXT;

UPDATE "ShortLink"
SET "targetUrl" = COALESCE("targetUrl", "originalUrl");
