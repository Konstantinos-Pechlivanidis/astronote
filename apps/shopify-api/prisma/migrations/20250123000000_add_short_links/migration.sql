-- CreateTable
CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "shopId" TEXT,
    "campaignId" TEXT,
    "contactId" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastClickedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "meta" JSONB,

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_token_key" ON "ShortLink"("token");

-- CreateIndex
CREATE INDEX "ShortLink_shopId_idx" ON "ShortLink"("shopId");

-- CreateIndex
CREATE INDEX "ShortLink_campaignId_idx" ON "ShortLink"("campaignId");

-- CreateIndex
CREATE INDEX "ShortLink_contactId_idx" ON "ShortLink"("contactId");

-- CreateIndex
CREATE INDEX "ShortLink_token_idx" ON "ShortLink"("token");

-- CreateIndex
CREATE INDEX "ShortLink_expiresAt_idx" ON "ShortLink"("expiresAt");

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

