-- Add export runs, payment adjustments, and refund/dispute metadata

-- CreateEnum
CREATE TYPE "PaymentAdjustmentType" AS ENUM ('refund', 'dispute');

-- CreateEnum
CREATE TYPE "ExportRunKind" AS ENUM ('weekly', 'on_demand');

-- CreateEnum
CREATE TYPE "ExportRunStatus" AS ENUM ('pending', 'completed', 'failed');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN     "billingHoldReason" VARCHAR(255);
ALTER TABLE "User" ADD COLUMN     "billingHoldAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'paid';
ALTER TABLE "Payment" ADD COLUMN     "refundedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN     "refundedAmount" INTEGER;
ALTER TABLE "Payment" ADD COLUMN     "stripeChargeId" VARCHAR(255);
ALTER TABLE "Payment" ADD COLUMN     "stripeDisputeId" VARCHAR(255);
ALTER TABLE "Payment" ADD COLUMN     "disputeStatus" VARCHAR(64);
ALTER TABLE "Payment" ADD COLUMN     "disputeReason" VARCHAR(128);
ALTER TABLE "Payment" ADD COLUMN     "disputeAmount" INTEGER;
ALTER TABLE "Payment" ADD COLUMN     "disputedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_stripeChargeId_idx" ON "Payment"("stripeChargeId");

-- CreateIndex
CREATE INDEX "Payment_stripeDisputeId_idx" ON "Payment"("stripeDisputeId");

-- CreateTable
CREATE TABLE "PaymentAdjustment" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "type" "PaymentAdjustmentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "BillingCurrency" NOT NULL DEFAULT 'EUR',
    "stripeChargeId" VARCHAR(255),
    "stripeRefundId" VARCHAR(255),
    "stripeDisputeId" VARCHAR(255),
    "status" VARCHAR(64),
    "reason" VARCHAR(255),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAdjustment_ownerId_idx" ON "PaymentAdjustment"("ownerId");

-- CreateIndex
CREATE INDEX "PaymentAdjustment_paymentId_idx" ON "PaymentAdjustment"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAdjustment_type_idx" ON "PaymentAdjustment"("type");

-- CreateIndex
CREATE INDEX "PaymentAdjustment_stripeChargeId_idx" ON "PaymentAdjustment"("stripeChargeId");

-- CreateIndex
CREATE INDEX "PaymentAdjustment_stripeRefundId_idx" ON "PaymentAdjustment"("stripeRefundId");

-- CreateIndex
CREATE INDEX "PaymentAdjustment_stripeDisputeId_idx" ON "PaymentAdjustment"("stripeDisputeId");

-- CreateIndex
CREATE INDEX "PaymentAdjustment_occurredAt_idx" ON "PaymentAdjustment"("occurredAt");

-- CreateTable
CREATE TABLE "ExportRun" (
    "id" SERIAL NOT NULL,
    "kind" "ExportRunKind" NOT NULL,
    "status" "ExportRunStatus" NOT NULL DEFAULT 'pending',
    "rangeStart" TIMESTAMP(3) NOT NULL,
    "rangeEnd" TIMESTAMP(3) NOT NULL,
    "recipientEmail" VARCHAR(255),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExportRun_kind_rangeStart_rangeEnd_key" ON "ExportRun"("kind", "rangeStart", "rangeEnd");

-- CreateIndex
CREATE INDEX "ExportRun_status_idx" ON "ExportRun"("status");

-- CreateIndex
CREATE INDEX "ExportRun_rangeStart_idx" ON "ExportRun"("rangeStart");

-- CreateIndex
CREATE INDEX "ExportRun_rangeEnd_idx" ON "ExportRun"("rangeEnd");

-- AddForeignKey
ALTER TABLE "PaymentAdjustment" ADD CONSTRAINT "PaymentAdjustment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAdjustment" ADD CONSTRAINT "PaymentAdjustment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
