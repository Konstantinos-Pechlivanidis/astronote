-- Add credit reservations and wallet reserved balance

-- CreateEnum
CREATE TYPE "CreditReservationStatus" AS ENUM ('reserved', 'committed', 'released', 'expired');

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "reservedBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CreditReservation" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "CreditReservationStatus" NOT NULL DEFAULT 'reserved',
    "reason" VARCHAR(200),
    "campaignId" INTEGER,
    "messageId" INTEGER,
    "idempotencyKey" VARCHAR(128),
    "meta" JSONB,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditReservation_messageId_key" ON "CreditReservation"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditReservation_ownerId_idempotencyKey_key" ON "CreditReservation"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditReservation_ownerId_idx" ON "CreditReservation"("ownerId");

-- CreateIndex
CREATE INDEX "CreditReservation_status_idx" ON "CreditReservation"("status");

-- CreateIndex
CREATE INDEX "CreditReservation_campaignId_idx" ON "CreditReservation"("campaignId");

-- CreateIndex
CREATE INDEX "CreditReservation_reservedAt_idx" ON "CreditReservation"("reservedAt");

-- CreateIndex
CREATE INDEX "CreditReservation_expiresAt_idx" ON "CreditReservation"("expiresAt");

-- AddForeignKey
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
