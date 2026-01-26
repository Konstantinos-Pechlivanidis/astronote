-- CreateEnum
CREATE TYPE "ConsentEventType" AS ENUM ('unsubscribed', 'resubscribed', 'service_allowed', 'service_revoked');

-- AlterEnum
ALTER TYPE "ExportRunKind" ADD VALUE 'messaging_weekly';
ALTER TYPE "ExportRunKind" ADD VALUE 'messaging_on_demand';

-- AlterTable
ALTER TABLE "CampaignMessage" ADD COLUMN "creditsCharged" INTEGER;
ALTER TABLE "CampaignMessage" ADD COLUMN "transactionId" INTEGER;

ALTER TABLE "AutomationMessage" ADD COLUMN "creditsCharged" INTEGER;
ALTER TABLE "AutomationMessage" ADD COLUMN "deliveryStatus" TEXT;
ALTER TABLE "AutomationMessage" ADD COLUMN "transactionId" INTEGER;

ALTER TABLE "AutomationSend" ADD COLUMN "creditsCharged" INTEGER;
ALTER TABLE "AutomationSend" ADD COLUMN "deliveryStatus" TEXT;
ALTER TABLE "AutomationSend" ADD COLUMN "transactionId" INTEGER;

-- CreateTable
CREATE TABLE "ConsentEvent" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "type" "ConsentEventType" NOT NULL,
    "source" VARCHAR(80),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentEvent_ownerId_idx" ON "ConsentEvent"("ownerId");
CREATE INDEX "ConsentEvent_contactId_idx" ON "ConsentEvent"("contactId");
CREATE INDEX "ConsentEvent_ownerId_type_idx" ON "ConsentEvent"("ownerId", "type");
CREATE INDEX "ConsentEvent_createdAt_idx" ON "ConsentEvent"("createdAt");

CREATE INDEX "AutomationMessage_deliveryStatus_idx" ON "AutomationMessage"("deliveryStatus");
CREATE INDEX "AutomationMessage_transactionId_idx" ON "AutomationMessage"("transactionId");

CREATE INDEX "AutomationSend_deliveryStatus_idx" ON "AutomationSend"("deliveryStatus");
CREATE INDEX "AutomationSend_transactionId_idx" ON "AutomationSend"("transactionId");

CREATE INDEX "CampaignMessage_transactionId_idx" ON "CampaignMessage"("transactionId");
CREATE UNIQUE INDEX "CampaignMessage_campaignId_contactId_key" ON "CampaignMessage"("campaignId", "contactId");

-- AddForeignKey
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
