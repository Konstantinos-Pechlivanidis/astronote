-- Add payment kind enum and payments table

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('monthly', 'yearly', 'topup');

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "BillingCurrency" NOT NULL DEFAULT 'EUR',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "priceId" VARCHAR(255),
    "stripeInvoiceId" VARCHAR(255),
    "stripeSessionId" VARCHAR(255),
    "stripePaymentIntentId" VARCHAR(255),
    "stripeCustomerId" VARCHAR(255),
    "stripeSubscriptionId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeInvoiceId_key" ON "Payment"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeSessionId_key" ON "Payment"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Payment_ownerId_idx" ON "Payment"("ownerId");

-- CreateIndex
CREATE INDEX "Payment_kind_idx" ON "Payment"("kind");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Payment_stripeCustomerId_idx" ON "Payment"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Payment_stripeSubscriptionId_idx" ON "Payment"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
