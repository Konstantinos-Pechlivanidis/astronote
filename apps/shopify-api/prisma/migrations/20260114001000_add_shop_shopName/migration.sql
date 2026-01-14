-- Add Shop.shopName (production-safe, additive)
-- This fixes sign-in/store creation failures when Prisma schema expects shopName
-- but the underlying DB schema is missing the column.

ALTER TABLE "Shop"
ADD COLUMN IF NOT EXISTS "shopName" TEXT;


