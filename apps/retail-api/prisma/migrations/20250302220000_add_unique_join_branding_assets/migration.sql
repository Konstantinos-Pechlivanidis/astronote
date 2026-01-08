-- Add unique constraints for join branding asset references
ALTER TABLE "RetailJoinBranding"
ADD CONSTRAINT "RetailJoinBranding_logoAssetId_key" UNIQUE ("logoAssetId");

ALTER TABLE "RetailJoinBranding"
ADD CONSTRAINT "RetailJoinBranding_ogImageAssetId_key" UNIQUE ("ogImageAssetId");
