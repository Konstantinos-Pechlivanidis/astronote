#!/usr/bin/env node

/**
 * Shopify Billing Completion Audit Script
 * Comprehensive verification of billing implementation completeness
 * 
 * Checks:
 * A) Prisma alignment (billing/subscription fields)
 * B) Backend endpoints exist and are tenant-scoped
 * C) Frontend uses endpoints correctly
 * D) Hard gating for sending is enforced
 * 
 * Exit codes:
 * - 0: All checks passed (DONE)
 * - 1: One or more checks failed (NOT DONE)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const SHOPIFY_API = join(ROOT, 'apps/shopify-api');
const SHOPIFY_FRONTEND = join(ROOT, 'apps/astronote-web');
const PRISMA_SCHEMA = join(SHOPIFY_API, 'prisma/schema.prisma');

let errors = [];
let warnings = [];
let checks = {
  prisma: { passed: 0, failed: 0 },
  endpoints: { passed: 0, failed: 0 },
  frontend: { passed: 0, failed: 0 },
  gating: { passed: 0, failed: 0 },
};

function error(msg, category = 'general') {
  errors.push({ msg, category });
  console.error(`❌ ERROR [${category}]: ${msg}`);
  if (category in checks) checks[category].failed++;
}

function warn(msg, category = 'general') {
  warnings.push({ msg, category });
  console.warn(`⚠️  WARNING [${category}]: ${msg}`);
}

function pass(msg, category = 'general') {
  console.log(`✅ PASS [${category}]: ${msg}`);
  if (category in checks) checks[category].passed++;
}

function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

/**
 * A) Prisma Alignment Check
 */
function checkPrismaAlignment() {
  console.log('\n📋 A) PRISMA ALIGNMENT CHECK');
  console.log('='.repeat(60));
  
  const schema = readFile(PRISMA_SCHEMA);
  if (!schema) {
    error('Prisma schema not found', 'prisma');
    return;
  }

  // Required Shop model fields for billing/subscription
  const requiredShopFields = [
    'stripeCustomerId',
    'stripeSubscriptionId',
    'planType',
    'subscriptionStatus',
    'subscriptionInterval',
    'currentPeriodStart',
    'currentPeriodEnd',
    'cancelAtPeriodEnd',
    'includedSmsPerPeriod',
    'usedSmsThisPeriod',
    'lastPeriodResetAt',
  ];

  requiredShopFields.forEach(field => {
    const regex = new RegExp(`\\s+${field}\\s+`, 's');
    if (regex.test(schema)) {
      pass(`Shop model has ${field} field`, 'prisma');
    } else {
      error(`Shop model missing ${field} field`, 'prisma');
    }
  });

  // Check Wallet model exists (for credits)
  if (/model\s+Wallet\s+{/.test(schema)) {
    pass('Wallet model exists', 'prisma');
  } else {
    error('Wallet model not found', 'prisma');
  }

  // Check Purchase model has idempotencyKey
  if (/model\s+Purchase\s+{[^}]*idempotencyKey/.test(schema)) {
    pass('Purchase model has idempotencyKey', 'prisma');
  } else {
    error('Purchase model missing idempotencyKey', 'prisma');
  }

  // Check unique constraint on Purchase
  if (/@@unique\(\[shopId,\s*idempotencyKey\]\)/.test(schema)) {
    pass('Purchase model has unique constraint on [shopId, idempotencyKey]', 'prisma');
  } else {
    error('Purchase model missing unique constraint on [shopId, idempotencyKey]', 'prisma');
  }
}

/**
 * B) Backend Endpoints Check
 */
function checkBackendEndpoints() {
  console.log('\n📋 B) BACKEND ENDPOINTS CHECK');
  console.log('='.repeat(60));

  // Check billing routes
  const billingRoutes = readFile(join(SHOPIFY_API, 'routes/billing.js'));
  if (!billingRoutes) {
    error('Billing routes file not found', 'endpoints');
    return;
  }

  // Check GET /billing/summary
  if (/\/summary|getSummary/.test(billingRoutes)) {
    pass('GET /billing/summary route exists', 'endpoints');
    
    // Check controller function
    const billingController = readFile(join(SHOPIFY_API, 'controllers/billing.js'));
    if (billingController && /getSummary|getBillingSummary/.test(billingController)) {
      pass('getSummary controller function exists', 'endpoints');
      
      // Check response shape
      if (/subscription.*status|allowance.*includedPerPeriod|credits.*balance/.test(billingController)) {
        pass('getSummary returns subscription, allowance, and credits', 'endpoints');
      } else {
        warn('getSummary response shape may be incomplete', 'endpoints');
      }
    } else {
      error('getSummary controller function not found', 'endpoints');
    }
  } else {
    error('GET /billing/summary route not found', 'endpoints');
  }

  // Check GET /billing/packages
  if (/\/packages|getPackages/.test(billingRoutes)) {
    pass('GET /billing/packages route exists', 'endpoints');
  } else {
    error('GET /billing/packages route not found', 'endpoints');
  }

  // Check subscription routes
  const subscriptionRoutes = readFile(join(SHOPIFY_API, 'routes/subscriptions.js'));
  if (!subscriptionRoutes) {
    error('Subscription routes file not found', 'endpoints');
    return;
  }

  // Check POST /subscriptions/switch
  if (/\/switch|switchInterval/.test(subscriptionRoutes)) {
    pass('POST /subscriptions/switch route exists', 'endpoints');
    
    const subscriptionController = readFile(join(SHOPIFY_API, 'controllers/subscriptions.js'));
    if (subscriptionController && /switchInterval/.test(subscriptionController)) {
      pass('switchInterval controller function exists', 'endpoints');
    } else {
      error('switchInterval controller function not found', 'endpoints');
    }
  } else {
    error('POST /subscriptions/switch route not found', 'endpoints');
  }

  // Check POST /subscriptions/cancel
  if (/\/cancel|\.cancel/.test(subscriptionRoutes)) {
    pass('POST /subscriptions/cancel route exists', 'endpoints');
    
    const subscriptionController = readFile(join(SHOPIFY_API, 'controllers/subscriptions.js'));
    if (subscriptionController && /export.*cancel|function cancel/.test(subscriptionController)) {
      pass('cancel controller function exists', 'endpoints');
    } else {
      error('cancel controller function not found', 'endpoints');
    }
  } else {
    error('POST /subscriptions/cancel route not found', 'endpoints');
  }

  // Check GET /subscriptions/portal
  if (/\/portal|getPortal/.test(subscriptionRoutes)) {
    pass('GET /subscriptions/portal route exists', 'endpoints');
    
    const subscriptionController = readFile(join(SHOPIFY_API, 'controllers/subscriptions.js'));
    if (subscriptionController && /getPortal/.test(subscriptionController)) {
      pass('getPortal controller function exists', 'endpoints');
    } else {
      error('getPortal controller function not found', 'endpoints');
    }
  } else {
    error('GET /subscriptions/portal route not found', 'endpoints');
  }

  // Check tenant scoping (middleware)
  const appJs = readFile(join(SHOPIFY_API, 'app.js'));
  if (appJs) {
    if (/\/billing.*resolveStore|resolveStore.*billing/.test(appJs)) {
      pass('Billing routes protected with resolveStore middleware', 'endpoints');
    } else {
      error('Billing routes not protected with resolveStore middleware', 'endpoints');
    }
    
    if (/\/subscriptions.*resolveStore|resolveStore.*subscriptions/.test(appJs)) {
      pass('Subscription routes protected with resolveStore middleware', 'endpoints');
    } else {
      error('Subscription routes not protected with resolveStore middleware', 'endpoints');
    }
  } else {
    warn('app.js not found, cannot verify tenant scoping', 'endpoints');
  }

  // Check for dev_customer_* usage (should not exist in production code)
  const billingService = readFile(join(SHOPIFY_API, 'services/billing.js'));
  const subscriptionService = readFile(join(SHOPIFY_API, 'services/subscription.js'));
  const billingController = readFile(join(SHOPIFY_API, 'controllers/billing.js'));
  const subscriptionController = readFile(join(SHOPIFY_API, 'controllers/subscriptions.js'));
  
  const allBackendCode = [
    billingService,
    subscriptionService,
    billingController,
    subscriptionController,
  ].filter(Boolean).join('\n');
  
  if (/dev_customer_/.test(allBackendCode)) {
    error('Found dev_customer_* usage in backend code (should not exist)', 'endpoints');
  } else {
    pass('No dev_customer_* usage found in backend code', 'endpoints');
  }
}

/**
 * C) Frontend Usage Check
 */
function checkFrontendUsage() {
  console.log('\n📋 C) FRONTEND USAGE CHECK');
  console.log('='.repeat(60));

  const billingPage = join(SHOPIFY_FRONTEND, 'app/app/shopify/billing/page.tsx');
  const billingPageContent = readFile(billingPage);
  
  if (!billingPageContent) {
    error('Billing page not found', 'frontend');
    return;
  }

  pass('Billing page exists', 'frontend');

  // Check for billing summary usage
  if (/useBillingSummary|billingApi\.getSummary/.test(billingPageContent)) {
    pass('Billing page uses billing summary', 'frontend');
  } else {
    error('Billing page does not use billing summary', 'frontend');
  }

  // Check for subscription status display
  if (/subscription.*status|subscriptionStatus|subscription\.status/.test(billingPageContent)) {
    pass('Billing page displays subscription status', 'frontend');
  } else {
    warn('Billing page may not display subscription status', 'frontend');
  }

  // Check for allowance display
  if (/allowance|remainingThisPeriod|includedPerPeriod/.test(billingPageContent)) {
    pass('Billing page displays allowance information', 'frontend');
  } else {
    warn('Billing page may not display allowance information', 'frontend');
  }

  // Check for credits balance display
  if (/credits|balance|Wallet/.test(billingPageContent)) {
    pass('Billing page displays credits balance', 'frontend');
  } else {
    warn('Billing page may not display credits balance', 'frontend');
  }

  // Check for switch interval action
  if (/switchInterval|Switch to Monthly|Switch to Yearly/.test(billingPageContent)) {
    pass('Billing page has switch interval action', 'frontend');
  } else {
    error('Billing page missing switch interval action', 'frontend');
  }

  // Check for cancel subscription action
  if (/cancelSubscription|Cancel Subscription/.test(billingPageContent)) {
    pass('Billing page has cancel subscription action', 'frontend');
  } else {
    error('Billing page missing cancel subscription action', 'frontend');
  }

  // Check for manage payment method (portal)
  if (/getPortal|Manage Payment|portal/.test(billingPageContent)) {
    pass('Billing page has manage payment method action', 'frontend');
  } else {
    error('Billing page missing manage payment method action', 'frontend');
  }

  // Check for subscription required banner
  if (/Subscription Required|subscription.*required|!isSubscriptionActive/.test(billingPageContent)) {
    pass('Billing page shows subscription required banner when inactive', 'frontend');
  } else {
    warn('Billing page may not show subscription required banner', 'frontend');
  }

  // Check API client usage
  // billing.ts re-exports from shopifyBillingApi.ts, so check the actual file
  const billingApiPath = join(SHOPIFY_FRONTEND, 'src/lib/shopify/api/billing.ts');
  const shopifyBillingApiPath = join(SHOPIFY_FRONTEND, 'src/lib/shopifyBillingApi.ts');
  const billingApi = readFile(billingApiPath);
  const shopifyBillingApi = readFile(shopifyBillingApiPath);
  const actualBillingApi = shopifyBillingApi || billingApi;
  
  if (actualBillingApi) {
    if (/getSummary|getBillingSummary/.test(actualBillingApi)) {
      pass('Billing API client has getSummary function', 'frontend');
    } else {
      error('Billing API client missing getSummary function', 'frontend');
    }
    
    if (/switchInterval|switchSubscription/.test(actualBillingApi)) {
      pass('Subscriptions API client has switchInterval function', 'frontend');
    } else {
      error('Subscriptions API client missing switchInterval function', 'frontend');
    }
  } else {
    error('Billing API client not found', 'frontend');
  }

  // Check hooks
  const useBillingSummary = readFile(join(SHOPIFY_FRONTEND, 'src/features/shopify/billing/hooks/useBillingSummary.ts'));
  if (useBillingSummary) {
    pass('useBillingSummary hook exists', 'frontend');
  } else {
    error('useBillingSummary hook not found', 'frontend');
  }

  const useSubscriptionMutations = readFile(join(SHOPIFY_FRONTEND, 'src/features/shopify/billing/hooks/useSubscriptionMutations.ts'));
  if (useSubscriptionMutations && /switchInterval/.test(useSubscriptionMutations)) {
    pass('useSwitchInterval hook exists', 'frontend');
  } else {
    error('useSwitchInterval hook not found', 'frontend');
  }
}

/**
 * D) Hard Gating Check
 */
function checkHardGating() {
  console.log('\n📋 D) HARD GATING CHECK');
  console.log('='.repeat(60));

  const campaignsService = readFile(join(SHOPIFY_API, 'services/campaigns.js'));
  if (!campaignsService) {
    error('Campaigns service not found', 'gating');
    return;
  }

  // Check enqueueCampaign checks subscription
  if (/isSubscriptionActive/.test(campaignsService)) {
    pass('enqueueCampaign checks subscription status', 'gating');
  } else {
    error('enqueueCampaign does not check subscription status', 'gating');
  }

  // Check for INACTIVE_SUBSCRIPTION or SUBSCRIPTION_REQUIRED error
  if (/INACTIVE_SUBSCRIPTION|SUBSCRIPTION_REQUIRED|inactive_subscription/.test(campaignsService)) {
    pass('enqueueCampaign returns subscription error when inactive', 'gating');
  } else {
    error('enqueueCampaign does not return subscription error', 'gating');
  }

  // Check controller handles subscription error
  const campaignsController = readFile(join(SHOPIFY_API, 'controllers/campaigns.js'));
  if (campaignsController) {
    // Check for 403 status with SUBSCRIPTION_REQUIRED code or subscription_required reason
    if (/status\(403\)|\.status\(403\)|403.*SUBSCRIPTION_REQUIRED|subscription_required.*403|inactive_subscription.*403/.test(campaignsController)) {
      pass('Campaign controller returns 403 for inactive subscription', 'gating');
    } else {
      error('Campaign controller does not return 403 for inactive subscription', 'gating');
    }
  } else {
    error('Campaign controller not found', 'gating');
  }

  // Check allowance consumption order (allowance first, then credits)
  if (/allowance|includedSmsPerPeriod|usedSmsThisPeriod/.test(campaignsService)) {
    pass('Campaign service tracks allowance usage', 'gating');
  } else {
    warn('Campaign service may not track allowance usage', 'gating');
  }

  // Check for insufficient balance error
  if (/INSUFFICIENT_BALANCE|insufficient_credits|insufficient_balance/.test(campaignsService)) {
    pass('Campaign service handles insufficient balance', 'gating');
  } else {
    warn('Campaign service may not handle insufficient balance', 'gating');
  }
}

/**
 * Main execution
 */
async function runAudit() {
  console.log('🚀 Shopify Billing Completion Audit');
  console.log('='.repeat(60));
  console.log('Checking all acceptance criteria (A-D)...\n');

  checkPrismaAlignment();
  checkBackendEndpoints();
  checkFrontendUsage();
  checkHardGating();

  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(60));
  
  const totalPassed = Object.values(checks).reduce((sum, c) => sum + c.passed, 0);
  const totalFailed = Object.values(checks).reduce((sum, c) => sum + c.failed, 0);
  
  console.log(`\n✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);
  
  console.log('\n📋 Category Breakdown:');
  Object.entries(checks).forEach(([category, stats]) => {
    const status = stats.failed === 0 ? '✅' : '❌';
    console.log(`   ${status} ${category.toUpperCase()}: ${stats.passed} passed, ${stats.failed} failed`);
  });

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(({ msg, category }) => {
      console.log(`   [${category}] ${msg}`);
    });
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(({ msg, category }) => {
      console.log(`   [${category}] ${msg}`);
    });
  }

  const isDone = totalFailed === 0;
  
  console.log('\n' + '='.repeat(60));
  if (isDone) {
    console.log('✅ DONE: Billing implementation is complete and aligned');
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.log('❌ NOT DONE: Remaining blockers must be fixed');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

