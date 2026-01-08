-- Retail assets for join branding
CREATE TABLE "RetailAsset" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetailAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RetailAsset_ownerId_idx" ON "RetailAsset"("ownerId");
CREATE INDEX "RetailAsset_kind_idx" ON "RetailAsset"("kind");

CREATE TABLE "RetailJoinBranding" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL UNIQUE,
  "storeDisplayName" TEXT NOT NULL,
  "logoAssetId" INTEGER,
  "ogImageAssetId" INTEGER,
  "logoUrl" TEXT,
  "ogImageUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#111827',
  "secondaryColor" TEXT NOT NULL DEFAULT '#4B5563',
  "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
  "textColor" TEXT NOT NULL DEFAULT '#111827',
  "accentColor" TEXT NOT NULL DEFAULT '#3B82F6',
  "marketingHeadline" TEXT,
  "marketingBullets" JSONB,
  "merchantBlurb" TEXT,
  "pageTitle" TEXT,
  "pageDescription" TEXT,
  "websiteUrl" TEXT,
  "facebookUrl" TEXT,
  "instagramUrl" TEXT,
  "rotateEnabled" BOOLEAN NOT NULL DEFAULT false,
  "showPoweredBy" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetailJoinBranding_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RetailJoinBranding_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "RetailAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RetailJoinBranding_ogImageAssetId_fkey" FOREIGN KEY ("ogImageAssetId") REFERENCES "RetailAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "RetailJoinBranding_ownerId_idx" ON "RetailJoinBranding"("ownerId");
