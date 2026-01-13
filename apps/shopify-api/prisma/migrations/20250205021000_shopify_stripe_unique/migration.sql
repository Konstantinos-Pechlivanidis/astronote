-- Add unique constraints for Stripe identifiers to prevent tenant collisions
CREATE UNIQUE INDEX IF NOT EXISTS "Shop_stripeCustomerId_key" ON "Shop"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Shop_stripeSubscriptionId_key" ON "Shop"("stripeSubscriptionId");
