-- Shopify billing hardening: billing profile, subscription record, invoices, tax evidence

-- 1) ShopBillingProfile
CREATE TABLE IF NOT EXISTS "ShopBillingProfile" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "legalName" TEXT,
  "vatNumber" VARCHAR(32),
  "vatCountry" VARCHAR(2),
  "billingEmail" VARCHAR(255),
  "billingAddress" JSONB,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "taxStatus" VARCHAR(32),
  "taxExempt" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShopBillingProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopBillingProfile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingProfile_shopId_key" ON "ShopBillingProfile"("shopId");
CREATE INDEX IF NOT EXISTS "ShopBillingProfile_vatNumber_idx" ON "ShopBillingProfile"("vatNumber");
CREATE INDEX IF NOT EXISTS "ShopBillingProfile_vatCountry_idx" ON "ShopBillingProfile"("vatCountry");

-- 2) Subscription (Shop-level)
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "stripeCustomerId" VARCHAR(255),
  "stripeSubscriptionId" VARCHAR(255),
  "planCode" VARCHAR(50),
  "status" VARCHAR(40),
  "currency" VARCHAR(3),
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "trialEndsAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Subscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_shopId_key" ON "Subscription"("shopId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");

-- 3) InvoiceRecord
CREATE TABLE IF NOT EXISTS "InvoiceRecord" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "stripeInvoiceId" VARCHAR(255) NOT NULL,
  "stripeCustomerId" VARCHAR(255),
  "stripeSubscriptionId" VARCHAR(255),
  "invoiceNumber" VARCHAR(64),
  "subtotal" INTEGER,
  "tax" INTEGER,
  "total" INTEGER,
  "currency" VARCHAR(3),
  "pdfUrl" TEXT,
  "hostedInvoiceUrl" TEXT,
  "status" VARCHAR(40),
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvoiceRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceRecord_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceRecord_stripeInvoiceId_key" ON "InvoiceRecord"("stripeInvoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceRecord_shopId_idx" ON "InvoiceRecord"("shopId");
CREATE INDEX IF NOT EXISTS "InvoiceRecord_stripeCustomerId_idx" ON "InvoiceRecord"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "InvoiceRecord_stripeSubscriptionId_idx" ON "InvoiceRecord"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "InvoiceRecord_issuedAt_idx" ON "InvoiceRecord"("issuedAt");

-- 4) TaxEvidence
CREATE TABLE IF NOT EXISTS "TaxEvidence" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "ipCountry" VARCHAR(2),
  "billingCountry" VARCHAR(2),
  "vatIdProvided" VARCHAR(32),
  "vatIdValidated" BOOLEAN,
  "taxRateApplied" DOUBLE PRECISION,
  "taxJurisdiction" VARCHAR(64),
  "taxTreatment" VARCHAR(32),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaxEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxEvidence_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaxEvidence_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "InvoiceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaxEvidence_invoiceId_key" ON "TaxEvidence"("invoiceId");
CREATE INDEX IF NOT EXISTS "TaxEvidence_shopId_idx" ON "TaxEvidence"("shopId");
CREATE INDEX IF NOT EXISTS "TaxEvidence_billingCountry_idx" ON "TaxEvidence"("billingCountry");
CREATE INDEX IF NOT EXISTS "TaxEvidence_taxTreatment_idx" ON "TaxEvidence"("taxTreatment");

-- 5) WebhookEvent enhancements
ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "payloadHash" TEXT;
ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "eventType" TEXT;
CREATE INDEX IF NOT EXISTS "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");
CREATE INDEX IF NOT EXISTS "WebhookEvent_payloadHash_idx" ON "WebhookEvent"("payloadHash");
