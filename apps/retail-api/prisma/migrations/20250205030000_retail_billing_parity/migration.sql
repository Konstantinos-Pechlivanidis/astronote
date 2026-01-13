-- Ensure Stripe identifiers are unique per user
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "public"."User"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeSubscriptionId_key" ON "public"."User"("stripeSubscriptionId");

-- Billing profile
CREATE TABLE IF NOT EXISTS "public"."BillingProfile" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "legalName" TEXT,
    "vatNumber" VARCHAR(32),
    "vatCountry" VARCHAR(2),
    "billingEmail" VARCHAR(255),
    "billingAddress" JSONB,
    "currency" "public"."BillingCurrency" NOT NULL DEFAULT 'EUR',
    "taxStatus" VARCHAR(32),
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingProfile_ownerId_key" ON "public"."BillingProfile"("ownerId");
CREATE INDEX IF NOT EXISTS "BillingProfile_vatNumber_idx" ON "public"."BillingProfile"("vatNumber");
CREATE INDEX IF NOT EXISTS "BillingProfile_vatCountry_idx" ON "public"."BillingProfile"("vatCountry");

DO $$ BEGIN
    ALTER TABLE "public"."BillingProfile"
    ADD CONSTRAINT "BillingProfile_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Subscription records
CREATE TABLE IF NOT EXISTS "public"."Subscription" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
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

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_ownerId_key" ON "public"."Subscription"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "public"."Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_stripeCustomerId_idx" ON "public"."Subscription"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_idx" ON "public"."Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "public"."Subscription"("status");

DO $$ BEGIN
    ALTER TABLE "public"."Subscription"
    ADD CONSTRAINT "Subscription_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice records
CREATE TABLE IF NOT EXISTS "public"."InvoiceRecord" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
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

    CONSTRAINT "InvoiceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceRecord_stripeInvoiceId_key" ON "public"."InvoiceRecord"("stripeInvoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceRecord_ownerId_idx" ON "public"."InvoiceRecord"("ownerId");
CREATE INDEX IF NOT EXISTS "InvoiceRecord_stripeCustomerId_idx" ON "public"."InvoiceRecord"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "InvoiceRecord_stripeSubscriptionId_idx" ON "public"."InvoiceRecord"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "InvoiceRecord_issuedAt_idx" ON "public"."InvoiceRecord"("issuedAt");

DO $$ BEGIN
    ALTER TABLE "public"."InvoiceRecord"
    ADD CONSTRAINT "InvoiceRecord_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tax evidence
CREATE TABLE IF NOT EXISTS "public"."TaxEvidence" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "invoiceId" INTEGER,
    "ipCountry" VARCHAR(2),
    "billingCountry" VARCHAR(2),
    "vatIdProvided" VARCHAR(32),
    "vatIdValidated" BOOLEAN,
    "taxRateApplied" DOUBLE PRECISION,
    "taxJurisdiction" VARCHAR(64),
    "taxTreatment" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaxEvidence_invoiceId_key" ON "public"."TaxEvidence"("invoiceId");
CREATE INDEX IF NOT EXISTS "TaxEvidence_ownerId_idx" ON "public"."TaxEvidence"("ownerId");
CREATE INDEX IF NOT EXISTS "TaxEvidence_billingCountry_idx" ON "public"."TaxEvidence"("billingCountry");
CREATE INDEX IF NOT EXISTS "TaxEvidence_taxTreatment_idx" ON "public"."TaxEvidence"("taxTreatment");

DO $$ BEGIN
    ALTER TABLE "public"."TaxEvidence"
    ADD CONSTRAINT "TaxEvidence_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."TaxEvidence"
    ADD CONSTRAINT "TaxEvidence_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "public"."InvoiceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Billing transactions
CREATE TABLE IF NOT EXISTS "public"."BillingTransaction" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "creditsAdded" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "public"."BillingCurrency" NOT NULL DEFAULT 'EUR',
    "packageType" TEXT NOT NULL,
    "stripeSessionId" VARCHAR(255),
    "stripePaymentId" VARCHAR(255),
    "idempotencyKey" VARCHAR(255),
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingTransaction_ownerId_idempotencyKey_key" ON "public"."BillingTransaction"("ownerId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "BillingTransaction_ownerId_createdAt_idx" ON "public"."BillingTransaction"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "BillingTransaction_stripeSessionId_idx" ON "public"."BillingTransaction"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "BillingTransaction_stripePaymentId_idx" ON "public"."BillingTransaction"("stripePaymentId");

DO $$ BEGIN
    ALTER TABLE "public"."BillingTransaction"
    ADD CONSTRAINT "BillingTransaction_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Webhook event enhancements
ALTER TABLE "public"."WebhookEvent" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "public"."WebhookEvent" ADD COLUMN IF NOT EXISTS "payloadHash" TEXT;
ALTER TABLE "public"."WebhookEvent" ADD COLUMN IF NOT EXISTS "ownerId" INTEGER;
ALTER TABLE "public"."WebhookEvent" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);
ALTER TABLE "public"."WebhookEvent" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'received';
ALTER TABLE "public"."WebhookEvent" ADD COLUMN IF NOT EXISTS "error" TEXT;
ALTER TABLE "public"."WebhookEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "public"."WebhookEvent" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "public"."WebhookEvent" ALTER COLUMN "payload" DROP NOT NULL;

UPDATE "public"."WebhookEvent"
SET "eventId" = COALESCE("eventId", "providerMessageId", 'legacy_' || "id"::text)
WHERE "eventId" IS NULL;

ALTER TABLE "public"."WebhookEvent" ALTER COLUMN "eventId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_eventId_key" ON "public"."WebhookEvent"("provider", "eventId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_ownerId_idx" ON "public"."WebhookEvent"("ownerId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_status_idx" ON "public"."WebhookEvent"("provider", "status");
CREATE INDEX IF NOT EXISTS "WebhookEvent_receivedAt_idx" ON "public"."WebhookEvent"("receivedAt");

DO $$ BEGIN
    ALTER TABLE "public"."WebhookEvent"
    ADD CONSTRAINT "WebhookEvent_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
