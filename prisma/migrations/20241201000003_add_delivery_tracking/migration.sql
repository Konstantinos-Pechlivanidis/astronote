-- AddShopSettingsTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "senderNumber" TEXT,
    "senderName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ShopSettings" ADD CONSTRAINT "ShopSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddUniqueConstraint
ALTER TABLE "ShopSettings" ADD CONSTRAINT "ShopSettings_shopId_key" UNIQUE ("shopId");

-- AddDeliveryTrackingFields
ALTER TABLE "CampaignRecipient" ADD COLUMN "deliveryStatus" TEXT;
ALTER TABLE "CampaignRecipient" ADD COLUMN "senderNumber" TEXT;

-- AddDeliveryTrackingFieldsToMessageLog
ALTER TABLE "MessageLog" ADD COLUMN "deliveryStatus" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN "senderNumber" TEXT;
