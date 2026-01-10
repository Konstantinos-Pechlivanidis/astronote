#!/usr/bin/env node

/**
 * Audit script for Shopify billing/subscription implementation
 * Verifies:
 * 1) Required endpoints exist in shopify-api
 * 2) Prisma includes allowance tracking fields
 * 3) Shopify billing page calls correct endpoints
 * 4) Protected calls include tenant headers
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const errors = [];
const warnings = [];

function checkFileExists(path, description) {
  if (!existsSync(path)) {
    errors.push(`Missing: ${description} (${path})`);
    return false;
  }
  return true;
}

function checkFileContains(filePath, pattern, description, isError = true) {
  if (!existsSync(filePath)) {
    if (isError) {
      errors.push(`File not found: ${filePath}`);
    }
    return false;
  }
  const content = readFileSync(filePath, 'utf-8');
  const regex = new RegExp(pattern, 'i');
  if (!regex.test(content)) {
    if (isError) {
      errors.push(`Missing in ${filePath}: ${description}`);
    } else {
      warnings.push(`Missing in ${filePath}: ${description}`);
    }
    return false;
  }
  return true;
}

console.log('🔍 Auditing Shopify billing/subscription implementation...\n');

// 1) Check Prisma schema has allowance fields
console.log('1. Checking Prisma schema...');
const schemaPath = join(rootDir, 'apps/shopify-api/prisma/schema.prisma');
if (checkFileExists(schemaPath, 'Prisma schema')) {
  checkFileContains(
    schemaPath,
    'includedSmsPerPeriod',
    'includedSmsPerPeriod field',
  );
  checkFileContains(
    schemaPath,
    'usedSmsThisPeriod',
    'usedSmsThisPeriod field',
  );
  checkFileContains(
    schemaPath,
    'subscriptionInterval',
    'subscriptionInterval field',
  );
  checkFileContains(
    schemaPath,
    'currentPeriodStart',
    'currentPeriodStart field',
  );
  checkFileContains(
    schemaPath,
    'currentPeriodEnd',
    'currentPeriodEnd field',
  );
  checkFileContains(
    schemaPath,
    'cancelAtPeriodEnd',
    'cancelAtPeriodEnd field',
  );
  checkFileContains(
    schemaPath,
    'lastBillingError',
    'lastBillingError field',
  );
}

// 2) Check backend endpoints exist
console.log('2. Checking backend endpoints...');
const subscriptionsRoutesPath = join(rootDir, 'apps/shopify-api/routes/subscriptions.js');
if (checkFileExists(subscriptionsRoutesPath, 'Subscriptions routes')) {
  checkFileContains(
    subscriptionsRoutesPath,
    '/switch',
    'POST /subscriptions/switch endpoint',
  );
  checkFileContains(
    subscriptionsRoutesPath,
    '/cancel',
    'POST /subscriptions/cancel endpoint',
  );
  checkFileContains(
    subscriptionsRoutesPath,
    '/portal',
    'GET /subscriptions/portal endpoint',
  );
}

const billingRoutesPath = join(rootDir, 'apps/shopify-api/routes/billing.js');
if (checkFileExists(billingRoutesPath, 'Billing routes')) {
  checkFileContains(
    billingRoutesPath,
    '/summary',
    'GET /billing/summary endpoint',
  );
}

// 3) Check subscription gating in campaigns
console.log('3. Checking subscription gating...');
const campaignsServicePath = join(rootDir, 'apps/shopify-api/services/campaigns.js');
if (checkFileExists(campaignsServicePath, 'Campaigns service')) {
  checkFileContains(
    campaignsServicePath,
    'isSubscriptionActive|subscription_required',
    'Subscription check in enqueueCampaign',
  );
}

const campaignsControllerPath = join(rootDir, 'apps/shopify-api/controllers/campaigns.js');
if (checkFileExists(campaignsControllerPath, 'Campaigns controller')) {
  checkFileContains(
    campaignsControllerPath,
    'SUBSCRIPTION_REQUIRED',
    'SUBSCRIPTION_REQUIRED error code',
  );
}

// 4) Check frontend billing page
console.log('4. Checking frontend billing page...');
const billingPagePath = join(rootDir, 'apps/astronote-web/app/app/shopify/billing/page.tsx');
if (checkFileExists(billingPagePath, 'Billing page')) {
  checkFileContains(
    billingPagePath,
    'useBillingSummary|useSubscriptionStatus',
    'Billing summary hook usage',
  );
  checkFileContains(
    billingPagePath,
    'useSwitchInterval|switchInterval',
    'Switch interval hook usage',
  );
  checkFileContains(
    billingPagePath,
    'useCancelSubscription|cancelSubscription',
    'Cancel subscription hook usage',
  );
  checkFileContains(
    billingPagePath,
    'allowance|remainingThisPeriod',
    'Allowance display',
  );
  checkFileContains(
    billingPagePath,
    'lastBillingError',
    'Last billing error display',
  );
}

// 5) Check frontend API client
console.log('5. Checking frontend API client...');
const billingApiPath = join(rootDir, 'apps/astronote-web/src/lib/shopify/api/billing.ts');
const shopifyBillingApiPath = join(rootDir, 'apps/astronote-web/src/lib/shopifyBillingApi.ts');
// billing.ts re-exports from shopifyBillingApi.ts, so check the actual file
const actualBillingApiPath = existsSync(shopifyBillingApiPath) ? shopifyBillingApiPath : billingApiPath;
if (checkFileExists(actualBillingApiPath, 'Billing API client')) {
  checkFileContains(
    actualBillingApiPath,
    'subscriptionsApi|subscriptions.*api',
    'Subscriptions API export',
  );
  checkFileContains(
    actualBillingApiPath,
    'switchInterval|switchSubscription',
    'Switch interval API function',
  );
  checkFileContains(
    actualBillingApiPath,
    'cancel|cancelSubscription',
    'Cancel subscription API function',
  );
  checkFileContains(
    actualBillingApiPath,
    'getPortal|getBillingPortalUrl',
    'Get portal API function',
  );
}

// 5.1) Check tenant headers in Shopify API client
console.log('5.1. Checking tenant headers...');
const shopifyAxiosPath = join(rootDir, 'apps/astronote-web/src/lib/shopify/api/axios.ts');
if (checkFileExists(shopifyAxiosPath, 'Shopify API client')) {
  checkFileContains(
    shopifyAxiosPath,
    'X-Shopify-Shop-Domain',
    'X-Shopify-Shop-Domain header',
  );
  checkFileContains(
    shopifyAxiosPath,
    'Authorization',
    'Authorization header',
  );
}

// 6) Check Stripe webhook handlers
console.log('6. Checking Stripe webhook handlers...');
const stripeWebhooksPath = join(rootDir, 'apps/shopify-api/controllers/stripe-webhooks.js');
if (checkFileExists(stripeWebhooksPath, 'Stripe webhooks controller')) {
  checkFileContains(
    stripeWebhooksPath,
    'customer\\.subscription\\.updated',
    'Subscription updated webhook handler',
  );
  checkFileContains(
    stripeWebhooksPath,
    'customer\\.subscription\\.deleted',
    'Subscription deleted webhook handler',
  );
  checkFileContains(
    stripeWebhooksPath,
    'invoice\\.payment_succeeded',
    'Invoice payment succeeded webhook handler',
  );
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('AUDIT SUMMARY');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ PASS: All checks passed');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length}):`);
    errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }
  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
    warnings.forEach((warn, i) => console.log(`  ${i + 1}. ${warn}`));
  }
  console.log('\n❌ FAIL: Some checks failed');
  process.exit(1);
}
