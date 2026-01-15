-- Retail schema squash init
-- Generated from prisma migrate diff --from-empty on 2026-01-14T23:31:35Z

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'sending', 'paused', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('cafe', 'restaurant', 'gym', 'sports_club', 'generic', 'hotels');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('age_18_24', 'age_25_39', 'age_40_plus');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('queued', 'processing', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('pending', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "CreditTxnType" AS ENUM ('credit', 'debit', 'refund');

-- CreateEnum
CREATE TYPE "SubscriptionPlanType" AS ENUM ('starter', 'pro');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused', 'inactive', 'cancelled');

-- CreateEnum
CREATE TYPE "SubscriptionInterval" AS ENUM ('month', 'year');

-- CreateEnum
CREATE TYPE "BillingCurrency" AS ENUM ('EUR', 'USD');

-- CreateEnum
CREATE TYPE "NfcTagStatus" AS ENUM ('active', 'inactive', 'test');

-- CreateEnum
CREATE TYPE "NfcTagType" AS ENUM ('opt_in', 'conversion');

-- CreateEnum
CREATE TYPE "NfcScanStatus" AS ENUM ('opened', 'submitted', 'error');

-- CreateEnum
CREATE TYPE "AutomationType" AS ENUM ('welcome_message', 'birthday_message');

-- CreateTable
CREATE TABLE "Bootstrap" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bootstrap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "senderName" VARCHAR(11),
    "company" VARCHAR(160),
    "timezone" VARCHAR(50),
    "stripeCustomerId" VARCHAR(255),
    "stripeSubscriptionId" VARCHAR(255),
    "planType" "SubscriptionPlanType",
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'inactive',
    "lastFreeCreditsAllocatedAt" TIMESTAMP(3),
    "billingCurrency" "BillingCurrency" NOT NULL DEFAULT 'EUR',
    "subscriptionInterval" "SubscriptionInterval",
    "subscriptionCurrentPeriodStart" TIMESTAMP(3),
    "subscriptionCurrentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "includedSmsPerPeriod" INTEGER NOT NULL DEFAULT 0,
    "usedSmsThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "lastBillingError" VARCHAR(255),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "email" VARCHAR(320),
    "firstName" VARCHAR(120),
    "lastName" VARCHAR(120),
    "gender" "Gender",
    "birthday" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gdprConsentAt" TIMESTAMP(3),
    "gdprConsentSource" VARCHAR(80),
    "gdprConsentVersion" VARCHAR(80),
    "smsConsentStatus" VARCHAR(40),
    "smsConsentAt" TIMESTAMP(3),
    "smsConsentSource" VARCHAR(80),
    "consentEvidence" JSONB,
    "isSubscribed" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribeTokenHash" VARCHAR(64),
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "List" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(400),
    "filterGender" "Gender",
    "filterAgeMin" INTEGER,
    "filterAgeMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListMembership" (
    "id" SERIAL NOT NULL,
    "listId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL DEFAULT 'generic',
    "goal" VARCHAR(200),
    "suggestedMetrics" VARCHAR(500),
    "language" TEXT NOT NULL DEFAULT 'en',
    "conversionRate" DOUBLE PRECISION,
    "productViewsIncrease" DOUBLE PRECISION,
    "clickThroughRate" DOUBLE PRECISION,
    "averageOrderValue" DOUBLE PRECISION,
    "customerRetention" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "listId" INTEGER,
    "filterGender" "Gender",
    "filterAgeGroup" "AgeGroup",
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "deliverySlaSeconds" INTEGER,
    "deliveryCompletedAt" TIMESTAMP(3),
    "lastDeliverySweepAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMessage" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "to" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "trackingId" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'queued',
    "sendClaimedAt" TIMESTAMP(3),
    "sendClaimToken" TEXT,
    "providerMessageId" TEXT,
    "bulkId" TEXT,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "deliveryStatus" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveryLastCheckedAt" TIMESTAMP(3),
    "billingStatus" "BillingStatus",
    "billingError" TEXT,
    "billedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortLink" (
    "id" SERIAL NOT NULL,
    "shortCode" TEXT NOT NULL,
    "kind" TEXT,
    "targetUrl" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "ownerId" INTEGER,
    "campaignId" INTEGER,
    "campaignMessageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicLinkToken" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'signup',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rotationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "PublicLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailBranding" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "storeName" TEXT NOT NULL,
    "storeDisplayName" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "backgroundStyle" TEXT,
    "headline" TEXT,
    "subheadline" TEXT,
    "benefits" JSONB,
    "benefitsJson" JSONB,
    "incentiveText" TEXT,
    "merchantBlurb" TEXT,
    "legalText" TEXT,
    "privacyUrl" TEXT,
    "termsUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailAsset" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailJoinBranding" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "storeDisplayName" TEXT NOT NULL,
    "logoAssetId" INTEGER,
    "ogImageAssetId" INTEGER,
    "logoUrl" TEXT,
    "ogImageUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#111827',
    "secondaryColor" TEXT NOT NULL DEFAULT '#4B5563',
    "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "textColor" TEXT NOT NULL DEFAULT '#111827',
    "accentColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "marketingHeadline" TEXT,
    "marketingBullets" JSONB,
    "merchantBlurb" TEXT,
    "headlineEn" TEXT,
    "headlineEl" TEXT,
    "subheadlineEn" TEXT,
    "subheadlineEl" TEXT,
    "bulletsEn" JSONB,
    "bulletsEl" JSONB,
    "merchantBlurbEn" TEXT,
    "merchantBlurbEl" TEXT,
    "pageTitle" TEXT,
    "pageDescription" TEXT,
    "websiteUrl" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "rotateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "showPoweredBy" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailJoinBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicSignupEvent" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "ip" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "PublicSignupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "messageId" INTEGER NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedByUserId" INTEGER,
    "evidenceJson" JSONB,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT,
    "ownerId" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'received',
    "payload" JSONB,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingProfile" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "legalName" TEXT,
    "vatNumber" VARCHAR(32),
    "vatCountry" VARCHAR(2),
    "billingEmail" VARCHAR(255),
    "billingAddress" JSONB,
    "currency" "BillingCurrency" NOT NULL DEFAULT 'EUR',
    "taxStatus" VARCHAR(32),
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
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

-- CreateTable
CREATE TABLE "InvoiceRecord" (
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

-- CreateTable
CREATE TABLE "TaxEvidence" (
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

-- CreateTable
CREATE TABLE "BillingTransaction" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "creditsAdded" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "BillingCurrency" NOT NULL DEFAULT 'EUR',
    "packageType" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentId" TEXT,
    "idempotencyKey" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "type" "CreditTxnType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" VARCHAR(200),
    "campaignId" INTEGER,
    "messageId" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "priceCentsUsd" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripePriceIdEur" VARCHAR(255),
    "stripePriceIdUsd" VARCHAR(255),

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "packageId" INTEGER NOT NULL,
    "units" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeSessionId" VARCHAR(255),
    "stripePaymentIntentId" VARCHAR(255),
    "stripeCustomerId" VARCHAR(255),
    "stripePriceId" VARCHAR(255),
    "currency" VARCHAR(3),
    "idempotencyKey" VARCHAR(128),

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfcTag" (
    "id" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "campaignId" INTEGER,
    "label" VARCHAR(200) NOT NULL,
    "type" "NfcTagType" NOT NULL DEFAULT 'opt_in',
    "status" "NfcTagStatus" NOT NULL DEFAULT 'active',
    "formConfigId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "NfcTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfcScan" (
    "id" SERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "status" "NfcScanStatus" NOT NULL DEFAULT 'opened',
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "deviceType" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfcScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionEvent" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "campaignId" INTEGER,
    "campaignMessageId" INTEGER,
    "nfcTagId" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferViewEvent" (
    "id" SERIAL NOT NULL,
    "campaignMessageId" INTEGER NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "deviceType" VARCHAR(50),
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferViewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormConfig" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "fields" JSONB NOT NULL,
    "consentText" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "type" "AutomationType" NOT NULL DEFAULT 'welcome_message',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "messageBody" TEXT NOT NULL DEFAULT 'Hello!',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationMessage" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "automationId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "to" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "trackingId" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'queued',
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRedemption" (
    "messageId" INTEGER NOT NULL,
    "automationId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedByUserId" INTEGER,
    "evidenceJson" JSONB,

    CONSTRAINT "AutomationRedemption_pkey" PRIMARY KEY ("messageId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_stripeSubscriptionId_idx" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "User_subscriptionStatus_idx" ON "User"("subscriptionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- CreateIndex
CREATE INDEX "Contact_unsubscribeTokenHash_idx" ON "Contact"("unsubscribeTokenHash");

-- CreateIndex
CREATE INDEX "Contact_ownerId_idx" ON "Contact"("ownerId");

-- CreateIndex
CREATE INDEX "Contact_unsubscribedAt_idx" ON "Contact"("unsubscribedAt");

-- CreateIndex
CREATE INDEX "Contact_isSubscribed_idx" ON "Contact"("isSubscribed");

-- CreateIndex
CREATE INDEX "Contact_gender_idx" ON "Contact"("gender");

-- CreateIndex
CREATE INDEX "Contact_birthday_idx" ON "Contact"("birthday");

-- CreateIndex
CREATE INDEX "Contact_ownerId_gender_idx" ON "Contact"("ownerId", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ownerId_phone_key" ON "Contact"("ownerId", "phone");

-- CreateIndex
CREATE INDEX "List_ownerId_idx" ON "List"("ownerId");

-- CreateIndex
CREATE INDEX "List_ownerId_filterGender_idx" ON "List"("ownerId", "filterGender");

-- CreateIndex
CREATE UNIQUE INDEX "List_ownerId_name_key" ON "List"("ownerId", "name");

-- CreateIndex
CREATE INDEX "ListMembership_contactId_idx" ON "ListMembership"("contactId");

-- CreateIndex
CREATE INDEX "ListMembership_listId_idx" ON "ListMembership"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "ListMembership_listId_contactId_key" ON "ListMembership"("listId", "contactId");

-- CreateIndex
CREATE INDEX "MessageTemplate_ownerId_idx" ON "MessageTemplate"("ownerId");

-- CreateIndex
CREATE INDEX "MessageTemplate_category_idx" ON "MessageTemplate"("category");

-- CreateIndex
CREATE INDEX "MessageTemplate_language_idx" ON "MessageTemplate"("language");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_ownerId_name_key" ON "MessageTemplate"("ownerId", "name");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_scheduledAt_idx" ON "Campaign"("scheduledAt");

-- CreateIndex
CREATE INDEX "Campaign_createdAt_idx" ON "Campaign"("createdAt");

-- CreateIndex
CREATE INDEX "Campaign_ownerId_idx" ON "Campaign"("ownerId");

-- CreateIndex
CREATE INDEX "Campaign_ownerId_status_idx" ON "Campaign"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Campaign_filterGender_idx" ON "Campaign"("filterGender");

-- CreateIndex
CREATE INDEX "Campaign_filterAgeGroup_idx" ON "Campaign"("filterAgeGroup");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMessage_trackingId_key" ON "CampaignMessage"("trackingId");

-- CreateIndex
CREATE INDEX "CampaignMessage_campaignId_idx" ON "CampaignMessage"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMessage_contactId_idx" ON "CampaignMessage"("contactId");

-- CreateIndex
CREATE INDEX "CampaignMessage_status_idx" ON "CampaignMessage"("status");

-- CreateIndex
CREATE INDEX "CampaignMessage_providerMessageId_idx" ON "CampaignMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "CampaignMessage_bulkId_idx" ON "CampaignMessage"("bulkId");

-- CreateIndex
CREATE INDEX "CampaignMessage_ownerId_idx" ON "CampaignMessage"("ownerId");

-- CreateIndex
CREATE INDEX "CampaignMessage_sentAt_idx" ON "CampaignMessage"("sentAt");

-- CreateIndex
CREATE INDEX "CampaignMessage_failedAt_idx" ON "CampaignMessage"("failedAt");

-- CreateIndex
CREATE INDEX "CampaignMessage_ownerId_campaignId_idx" ON "CampaignMessage"("ownerId", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignMessage_ownerId_status_idx" ON "CampaignMessage"("ownerId", "status");

-- CreateIndex
CREATE INDEX "CampaignMessage_sendClaimToken_idx" ON "CampaignMessage"("sendClaimToken");

-- CreateIndex
CREATE INDEX "CampaignMessage_sendClaimedAt_idx" ON "CampaignMessage"("sendClaimedAt");

-- CreateIndex
CREATE INDEX "CampaignMessage_deliveryStatus_idx" ON "CampaignMessage"("deliveryStatus");

-- CreateIndex
CREATE INDEX "CampaignMessage_billingStatus_idx" ON "CampaignMessage"("billingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_shortCode_key" ON "ShortLink"("shortCode");

-- CreateIndex
CREATE INDEX "ShortLink_shortCode_idx" ON "ShortLink"("shortCode");

-- CreateIndex
CREATE INDEX "ShortLink_ownerId_idx" ON "ShortLink"("ownerId");

-- CreateIndex
CREATE INDEX "ShortLink_campaignId_idx" ON "ShortLink"("campaignId");

-- CreateIndex
CREATE INDEX "ShortLink_campaignMessageId_idx" ON "ShortLink"("campaignMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicLinkToken_token_key" ON "PublicLinkToken"("token");

-- CreateIndex
CREATE INDEX "PublicLinkToken_ownerId_idx" ON "PublicLinkToken"("ownerId");

-- CreateIndex
CREATE INDEX "PublicLinkToken_type_isActive_idx" ON "PublicLinkToken"("type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RetailBranding_ownerId_key" ON "RetailBranding"("ownerId");

-- CreateIndex
CREATE INDEX "RetailAsset_ownerId_idx" ON "RetailAsset"("ownerId");

-- CreateIndex
CREATE INDEX "RetailAsset_kind_idx" ON "RetailAsset"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "RetailJoinBranding_ownerId_key" ON "RetailJoinBranding"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "RetailJoinBranding_logoAssetId_key" ON "RetailJoinBranding"("logoAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "RetailJoinBranding_ogImageAssetId_key" ON "RetailJoinBranding"("ogImageAssetId");

-- CreateIndex
CREATE INDEX "RetailJoinBranding_ownerId_idx" ON "RetailJoinBranding"("ownerId");

-- CreateIndex
CREATE INDEX "PublicSignupEvent_tokenId_createdAt_idx" ON "PublicSignupEvent"("tokenId", "createdAt");

-- CreateIndex
CREATE INDEX "PublicSignupEvent_ownerId_createdAt_idx" ON "PublicSignupEvent"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Redemption_campaignId_idx" ON "Redemption"("campaignId");

-- CreateIndex
CREATE INDEX "Redemption_contactId_idx" ON "Redemption"("contactId");

-- CreateIndex
CREATE INDEX "Redemption_ownerId_idx" ON "Redemption"("ownerId");

-- CreateIndex
CREATE INDEX "Redemption_ownerId_campaignId_idx" ON "Redemption"("ownerId", "campaignId");

-- CreateIndex
CREATE INDEX "WebhookEvent_ownerId_idx" ON "WebhookEvent"("ownerId");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_status_idx" ON "WebhookEvent"("provider", "status");

-- CreateIndex
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingProfile_ownerId_key" ON "BillingProfile"("ownerId");

-- CreateIndex
CREATE INDEX "BillingProfile_vatNumber_idx" ON "BillingProfile"("vatNumber");

-- CreateIndex
CREATE INDEX "BillingProfile_vatCountry_idx" ON "BillingProfile"("vatCountry");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_ownerId_key" ON "Subscription"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceRecord_stripeInvoiceId_key" ON "InvoiceRecord"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "InvoiceRecord_ownerId_idx" ON "InvoiceRecord"("ownerId");

-- CreateIndex
CREATE INDEX "InvoiceRecord_stripeCustomerId_idx" ON "InvoiceRecord"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "InvoiceRecord_stripeSubscriptionId_idx" ON "InvoiceRecord"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "InvoiceRecord_issuedAt_idx" ON "InvoiceRecord"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxEvidence_invoiceId_key" ON "TaxEvidence"("invoiceId");

-- CreateIndex
CREATE INDEX "TaxEvidence_ownerId_idx" ON "TaxEvidence"("ownerId");

-- CreateIndex
CREATE INDEX "TaxEvidence_billingCountry_idx" ON "TaxEvidence"("billingCountry");

-- CreateIndex
CREATE INDEX "TaxEvidence_taxTreatment_idx" ON "TaxEvidence"("taxTreatment");

-- CreateIndex
CREATE INDEX "BillingTransaction_ownerId_createdAt_idx" ON "BillingTransaction"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingTransaction_stripeSessionId_idx" ON "BillingTransaction"("stripeSessionId");

-- CreateIndex
CREATE INDEX "BillingTransaction_stripePaymentId_idx" ON "BillingTransaction"("stripePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingTransaction_ownerId_idempotencyKey_key" ON "BillingTransaction"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_ownerId_key" ON "Wallet"("ownerId");

-- CreateIndex
CREATE INDEX "CreditTransaction_ownerId_idx" ON "CreditTransaction"("ownerId");

-- CreateIndex
CREATE INDEX "CreditTransaction_campaignId_idx" ON "CreditTransaction"("campaignId");

-- CreateIndex
CREATE INDEX "CreditTransaction_messageId_idx" ON "CreditTransaction"("messageId");

-- CreateIndex
CREATE INDEX "CreditTransaction_walletId_idx" ON "CreditTransaction"("walletId");

-- CreateIndex
CREATE INDEX "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Package_name_key" ON "Package"("name");

-- CreateIndex
CREATE INDEX "Package_stripePriceIdEur_idx" ON "Package"("stripePriceIdEur");

-- CreateIndex
CREATE INDEX "Package_stripePriceIdUsd_idx" ON "Package"("stripePriceIdUsd");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_stripeSessionId_key" ON "Purchase"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Purchase_ownerId_idx" ON "Purchase"("ownerId");

-- CreateIndex
CREATE INDEX "Purchase_packageId_idx" ON "Purchase"("packageId");

-- CreateIndex
CREATE INDEX "Purchase_stripeSessionId_idx" ON "Purchase"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Purchase_stripePaymentIntentId_idx" ON "Purchase"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- CreateIndex
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

-- CreateIndex
CREATE INDEX "Purchase_ownerId_status_idx" ON "Purchase"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_ownerId_idempotencyKey_key" ON "Purchase"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "NfcTag_publicId_key" ON "NfcTag"("publicId");

-- CreateIndex
CREATE INDEX "NfcTag_storeId_idx" ON "NfcTag"("storeId");

-- CreateIndex
CREATE INDEX "NfcTag_publicId_idx" ON "NfcTag"("publicId");

-- CreateIndex
CREATE INDEX "NfcTag_status_idx" ON "NfcTag"("status");

-- CreateIndex
CREATE INDEX "NfcTag_campaignId_idx" ON "NfcTag"("campaignId");

-- CreateIndex
CREATE INDEX "NfcTag_type_idx" ON "NfcTag"("type");

-- CreateIndex
CREATE INDEX "NfcScan_tagId_idx" ON "NfcScan"("tagId");

-- CreateIndex
CREATE INDEX "NfcScan_storeId_idx" ON "NfcScan"("storeId");

-- CreateIndex
CREATE INDEX "NfcScan_contactId_idx" ON "NfcScan"("contactId");

-- CreateIndex
CREATE INDEX "NfcScan_status_idx" ON "NfcScan"("status");

-- CreateIndex
CREATE INDEX "NfcScan_createdAt_idx" ON "NfcScan"("createdAt");

-- CreateIndex
CREATE INDEX "ConversionEvent_storeId_idx" ON "ConversionEvent"("storeId");

-- CreateIndex
CREATE INDEX "ConversionEvent_campaignId_idx" ON "ConversionEvent"("campaignId");

-- CreateIndex
CREATE INDEX "ConversionEvent_contactId_idx" ON "ConversionEvent"("contactId");

-- CreateIndex
CREATE INDEX "ConversionEvent_nfcTagId_idx" ON "ConversionEvent"("nfcTagId");

-- CreateIndex
CREATE INDEX "ConversionEvent_occurredAt_idx" ON "ConversionEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "ConversionEvent_storeId_campaignId_idx" ON "ConversionEvent"("storeId", "campaignId");

-- CreateIndex
CREATE INDEX "OfferViewEvent_campaignMessageId_idx" ON "OfferViewEvent"("campaignMessageId");

-- CreateIndex
CREATE INDEX "OfferViewEvent_campaignId_idx" ON "OfferViewEvent"("campaignId");

-- CreateIndex
CREATE INDEX "OfferViewEvent_contactId_idx" ON "OfferViewEvent"("contactId");

-- CreateIndex
CREATE INDEX "OfferViewEvent_ownerId_idx" ON "OfferViewEvent"("ownerId");

-- CreateIndex
CREATE INDEX "OfferViewEvent_viewedAt_idx" ON "OfferViewEvent"("viewedAt");

-- CreateIndex
CREATE INDEX "OfferViewEvent_ownerId_campaignId_idx" ON "OfferViewEvent"("ownerId", "campaignId");

-- CreateIndex
CREATE INDEX "FormConfig_storeId_idx" ON "FormConfig"("storeId");

-- CreateIndex
CREATE INDEX "Automation_ownerId_idx" ON "Automation"("ownerId");

-- CreateIndex
CREATE INDEX "Automation_ownerId_isActive_idx" ON "Automation"("ownerId", "isActive");

-- CreateIndex
CREATE INDEX "Automation_type_idx" ON "Automation"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Automation_ownerId_type_key" ON "Automation"("ownerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationMessage_trackingId_key" ON "AutomationMessage"("trackingId");

-- CreateIndex
CREATE INDEX "AutomationMessage_automationId_idx" ON "AutomationMessage"("automationId");

-- CreateIndex
CREATE INDEX "AutomationMessage_contactId_idx" ON "AutomationMessage"("contactId");

-- CreateIndex
CREATE INDEX "AutomationMessage_status_idx" ON "AutomationMessage"("status");

-- CreateIndex
CREATE INDEX "AutomationMessage_providerMessageId_idx" ON "AutomationMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "AutomationMessage_ownerId_idx" ON "AutomationMessage"("ownerId");

-- CreateIndex
CREATE INDEX "AutomationMessage_sentAt_idx" ON "AutomationMessage"("sentAt");

-- CreateIndex
CREATE INDEX "AutomationMessage_failedAt_idx" ON "AutomationMessage"("failedAt");

-- CreateIndex
CREATE INDEX "AutomationMessage_ownerId_automationId_idx" ON "AutomationMessage"("ownerId", "automationId");

-- CreateIndex
CREATE INDEX "AutomationMessage_ownerId_status_idx" ON "AutomationMessage"("ownerId", "status");

-- CreateIndex
CREATE INDEX "AutomationRedemption_automationId_idx" ON "AutomationRedemption"("automationId");

-- CreateIndex
CREATE INDEX "AutomationRedemption_contactId_idx" ON "AutomationRedemption"("contactId");

-- CreateIndex
CREATE INDEX "AutomationRedemption_ownerId_idx" ON "AutomationRedemption"("ownerId");

-- CreateIndex
CREATE INDEX "AutomationRedemption_ownerId_automationId_idx" ON "AutomationRedemption"("ownerId", "automationId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListMembership" ADD CONSTRAINT "ListMembership_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListMembership" ADD CONSTRAINT "ListMembership_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_campaignMessageId_fkey" FOREIGN KEY ("campaignMessageId") REFERENCES "CampaignMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicLinkToken" ADD CONSTRAINT "PublicLinkToken_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailBranding" ADD CONSTRAINT "RetailBranding_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailAsset" ADD CONSTRAINT "RetailAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailJoinBranding" ADD CONSTRAINT "RetailJoinBranding_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailJoinBranding" ADD CONSTRAINT "RetailJoinBranding_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "RetailAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailJoinBranding" ADD CONSTRAINT "RetailJoinBranding_ogImageAssetId_fkey" FOREIGN KEY ("ogImageAssetId") REFERENCES "RetailAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicSignupEvent" ADD CONSTRAINT "PublicSignupEvent_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "PublicLinkToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicSignupEvent" ADD CONSTRAINT "PublicSignupEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CampaignMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceRecord" ADD CONSTRAINT "InvoiceRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEvidence" ADD CONSTRAINT "TaxEvidence_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEvidence" ADD CONSTRAINT "TaxEvidence_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "InvoiceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingTransaction" ADD CONSTRAINT "BillingTransaction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcTag" ADD CONSTRAINT "NfcTag_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcTag" ADD CONSTRAINT "NfcTag_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcTag" ADD CONSTRAINT "NfcTag_formConfigId_fkey" FOREIGN KEY ("formConfigId") REFERENCES "FormConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcTag" ADD CONSTRAINT "NfcTag_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcScan" ADD CONSTRAINT "NfcScan_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "NfcTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcScan" ADD CONSTRAINT "NfcScan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcScan" ADD CONSTRAINT "NfcScan_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_campaignMessageId_fkey" FOREIGN KEY ("campaignMessageId") REFERENCES "CampaignMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_nfcTagId_fkey" FOREIGN KEY ("nfcTagId") REFERENCES "NfcTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferViewEvent" ADD CONSTRAINT "OfferViewEvent_campaignMessageId_fkey" FOREIGN KEY ("campaignMessageId") REFERENCES "CampaignMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferViewEvent" ADD CONSTRAINT "OfferViewEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferViewEvent" ADD CONSTRAINT "OfferViewEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferViewEvent" ADD CONSTRAINT "OfferViewEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormConfig" ADD CONSTRAINT "FormConfig_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRedemption" ADD CONSTRAINT "AutomationRedemption_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AutomationMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRedemption" ADD CONSTRAINT "AutomationRedemption_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

