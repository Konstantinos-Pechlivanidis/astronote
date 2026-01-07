CREATE TABLE "PublicLinkToken" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'signup',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "rotatedAt" TIMESTAMP,
  "lastUsedAt" TIMESTAMP
);

CREATE UNIQUE INDEX "PublicLinkToken_token_key" ON "PublicLinkToken"("token");
CREATE INDEX "PublicLinkToken_ownerId_idx" ON "PublicLinkToken"("ownerId");
CREATE INDEX "PublicLinkToken_type_isActive_idx" ON "PublicLinkToken"("type", "isActive");

ALTER TABLE "PublicLinkToken"
  ADD CONSTRAINT "PublicLinkToken_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RetailBranding" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL UNIQUE,
  "storeName" TEXT NOT NULL,
  "logoUrl" TEXT,
  "primaryColor" TEXT,
  "accentColor" TEXT,
  "headline" TEXT,
  "benefits" JSONB,
  "privacyUrl" TEXT,
  "termsUrl" TEXT,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE "RetailBranding"
  ADD CONSTRAINT "RetailBranding_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PublicSignupEvent" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL,
  "tokenId" INTEGER NOT NULL,
  "contactId" INTEGER,
  "ip" VARCHAR(45),
  "userAgent" VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "meta" JSONB
);

CREATE INDEX "PublicSignupEvent_tokenId_createdAt_idx" ON "PublicSignupEvent"("tokenId", "createdAt");
CREATE INDEX "PublicSignupEvent_ownerId_createdAt_idx" ON "PublicSignupEvent"("ownerId", "createdAt");

ALTER TABLE "PublicSignupEvent"
  ADD CONSTRAINT "PublicSignupEvent_tokenId_fkey"
  FOREIGN KEY ("tokenId") REFERENCES "PublicLinkToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicSignupEvent"
  ADD CONSTRAINT "PublicSignupEvent_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
