-- Add idempotencyKey to Purchase model (for idempotent purchase requests)
ALTER TABLE "Purchase" ADD COLUMN "idempotencyKey" VARCHAR(128);

-- Add priceCentsUsd to Package model (for USD pricing support)
ALTER TABLE "Package" ADD COLUMN "priceCentsUsd" INTEGER;

-- Create unique constraint for idempotency (shopId + idempotencyKey)
-- Note: Prisma will create this as @@unique([shopId, idempotencyKey]) which allows NULL values
-- This is correct behavior - NULL values are not considered equal, so multiple NULLs are allowed
CREATE UNIQUE INDEX "Purchase_shopId_idempotencyKey_key" ON "Purchase"("shopId", "idempotencyKey");

