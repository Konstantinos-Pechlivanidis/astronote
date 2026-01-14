-- Non-destructive Contact parity fix (Shopify)
-- Adds missing Contact columns that are used by API + FE (birthDate) and related analytics fields.
-- Safe on existing DBs (IF NOT EXISTS). Unique indexes are created only if data is compatible.

ALTER TABLE "Contact"
  ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hasPurchased" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "firstPurchaseAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastOrderAt" TIMESTAMP(3);

-- Indexes (safe)
CREATE INDEX IF NOT EXISTS "Contact_shopId_birthDate_idx" ON "Contact"("shopId", "birthDate");
CREATE INDEX IF NOT EXISTS "Contact_shopId_createdAt_idx" ON "Contact"("shopId", "createdAt");
CREATE INDEX IF NOT EXISTS "Contact_shopId_gender_idx" ON "Contact"("shopId", "gender");
CREATE INDEX IF NOT EXISTS "Contact_shopId_hasPurchased_idx" ON "Contact"("shopId", "hasPurchased");
CREATE INDEX IF NOT EXISTS "Contact_shopId_lastOrderAt_idx" ON "Contact"("shopId", "lastOrderAt");

-- Unique constraints: create only if no duplicates exist to avoid deploy failures.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Contact_shopId_phoneE164_key') THEN
    IF (SELECT COUNT(*) FROM (
      SELECT "shopId", "phoneE164" FROM "Contact"
      WHERE "phoneE164" IS NOT NULL
      GROUP BY "shopId", "phoneE164"
      HAVING COUNT(*) > 1
    ) dups) = 0 THEN
      CREATE UNIQUE INDEX "Contact_shopId_phoneE164_key" ON "Contact"("shopId", "phoneE164");
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Contact_shopId_email_key') THEN
    IF (SELECT COUNT(*) FROM (
      SELECT "shopId", "email" FROM "Contact"
      WHERE "email" IS NOT NULL
      GROUP BY "shopId", "email"
      HAVING COUNT(*) > 1
    ) dups) = 0 THEN
      CREATE UNIQUE INDEX "Contact_shopId_email_key" ON "Contact"("shopId", "email");
    END IF;
  END IF;
END $$;


