-- Add direct messages (1-to-1 SMS)

-- CreateEnum
CREATE TYPE "DirectMessageStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('marketing', 'service');

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "phoneE164" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL DEFAULT '',
    "messageType" "MessageType" NOT NULL DEFAULT 'marketing',
    "status" "DirectMessageStatus" NOT NULL DEFAULT 'pending',
    "providerMessageId" TEXT,
    "deliveryStatus" TEXT,
    "deliveryLastCheckedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "creditsCharged" INTEGER,
    "reservationId" INTEGER,
    "transactionId" INTEGER,
    "idempotencyKey" VARCHAR(128),

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectMessage_ownerId_idx" ON "DirectMessage"("ownerId");

-- CreateIndex
CREATE INDEX "DirectMessage_contactId_idx" ON "DirectMessage"("contactId");

-- CreateIndex
CREATE INDEX "DirectMessage_providerMessageId_idx" ON "DirectMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "DirectMessage_status_idx" ON "DirectMessage"("status");

-- CreateIndex
CREATE INDEX "DirectMessage_deliveryStatus_idx" ON "DirectMessage"("deliveryStatus");

-- CreateIndex
CREATE INDEX "DirectMessage_ownerId_createdAt_idx" ON "DirectMessage"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessage_ownerId_idempotencyKey_key" ON "DirectMessage"("ownerId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
