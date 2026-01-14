-- Non-destructive DB repair for Shopify sign-in/store resolution
-- Adds missing Shop columns required by current Prisma schema and auth/store-resolution code.
-- Safe to run on existing DBs (IF NOT EXISTS).

ALTER TABLE "Shop"
  ADD COLUMN IF NOT EXISTS "accessToken" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "credits" INTEGER NOT NULL DEFAULT 0;

-- Helpful indexes used by common queries (Shop list/filters)
CREATE INDEX IF NOT EXISTS "Shop_status_createdAt_idx" ON "Shop"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Shop_country_idx" ON "Shop"("country");


