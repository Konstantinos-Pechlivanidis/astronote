#!/usr/bin/env node
/**
 * Purge Billing Data for a Specific Shop
 * 
 * SAFETY: This script only deletes billing data for ONE shop (sms-blossom-dev.myshopify.com).
 * It requires explicit --confirm flag and will refuse to run in production without ALLOW_PROD_PURGE.
 * 
 * Usage:
 *   node apps/shopify-api/scripts/purge-billing-for-shop.js --shopDomain sms-blossom-dev.myshopify.com --confirm
 */

import prisma from '../services/prisma.js';
import { logger } from '../utils/logger.js';
import Stripe from 'stripe';

// Parse command line arguments
const args = process.argv.slice(2);
let shopDomainArg = args.find(arg => arg.startsWith('--shopDomain='))?.split('=')[1];
const confirmArg = args.includes('--confirm');

// Support both --shopDomain=value and --shopDomain value formats
if (!shopDomainArg) {
  const shopDomainIndex = args.findIndex(arg => arg === '--shopDomain');
  if (shopDomainIndex !== -1 && args[shopDomainIndex + 1]) {
    shopDomainArg = args[shopDomainIndex + 1];
  }
}

// Safety guards
const TARGET_SHOP_DOMAIN = 'sms-blossom-dev.myshopify.com';
const isProduction = process.env.NODE_ENV === 'production';
const allowProdPurge = process.env.ALLOW_PROD_PURGE === 'true';

if (!shopDomainArg) {
  console.error('❌ ERROR: --shopDomain is required');
  console.error('Usage: node apps/shopify-api/scripts/purge-billing-for-shop.js --shopDomain sms-blossom-dev.myshopify.com --confirm');
  process.exit(1);
}

if (shopDomainArg !== TARGET_SHOP_DOMAIN) {
  console.error(`❌ ERROR: Shop domain must be exactly "${TARGET_SHOP_DOMAIN}"`);
  console.error(`Received: "${shopDomainArg}"`);
  process.exit(1);
}

if (!confirmArg) {
  console.error('❌ ERROR: --confirm flag is required to run this destructive operation');
  console.error('Usage: node apps/shopify-api/scripts/purge-billing-for-shop.js --shopDomain sms-blossom-dev.myshopify.com --confirm');
  process.exit(1);
}

if (isProduction && !allowProdPurge) {
  console.error('❌ ERROR: Cannot run in production without ALLOW_PROD_PURGE=true');
  console.error('This is a safety guard to prevent accidental data loss in production.');
  process.exit(1);
}

// Initialize Stripe (test/dev only)
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });
} else {
  console.warn('⚠️  WARNING: STRIPE_SECRET_KEY not set. Stripe cleanup will be skipped.');
}

async function purgeBillingForShop() {
  console.log('🔍 Finding shop...');
  
  // Step 1: Find the shop
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: shopDomainArg },
    select: {
      id: true,
      shopDomain: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!shop) {
    console.error(`❌ ERROR: Shop "${shopDomainArg}" not found`);
    process.exit(1);
  }

  console.log(`✅ Found shop: ${shop.shopDomain} (ID: ${shop.id})`);
  console.log(`   Stripe Customer ID: ${shop.stripeCustomerId || 'none'}`);
  console.log(`   Stripe Subscription ID: ${shop.stripeSubscriptionId || 'none'}`);
  console.log('');

  const shopId = shop.id;
  const stripeCustomerId = shop.stripeCustomerId;
  const stripeSubscriptionId = shop.stripeSubscriptionId;

  const deletionSummary = {
    stripe: {
      subscriptionsCancelled: 0,
      customerDeleted: false,
      errors: [],
    },
    database: {
      Subscription: 0,
      ShopBillingProfile: 0,
      InvoiceRecord: 0,
      TaxEvidence: 0,
      BillingTransaction: 0,
      Purchase: 0,
      WebhookEvent: 0, // Only Stripe webhooks for this shop
      ShopFieldsCleared: false,
    },
  };

  // Step 2: Purge Stripe data (test/dev only)
  if (stripe && stripeCustomerId) {
    console.log('🗑️  Purging Stripe data...');
    
    try {
      // Cancel all subscriptions for this customer
      if (stripeSubscriptionId) {
        try {
          await stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: false, // Cancel immediately
          });
          await stripe.subscriptions.cancel(stripeSubscriptionId);
          deletionSummary.stripe.subscriptionsCancelled = 1;
          console.log(`   ✅ Cancelled subscription: ${stripeSubscriptionId}`);
        } catch (err) {
          if (err.code === 'resource_missing') {
            console.log(`   ⚠️  Subscription ${stripeSubscriptionId} not found in Stripe (already deleted)`);
          } else {
            deletionSummary.stripe.errors.push(`Failed to cancel subscription: ${err.message}`);
            console.error(`   ❌ Failed to cancel subscription: ${err.message}`);
          }
        }
      }

      // List all subscriptions for this customer (in case there are more)
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          limit: 100,
        });

        for (const sub of subscriptions.data) {
          if (sub.id !== stripeSubscriptionId) {
            try {
              await stripe.subscriptions.cancel(sub.id);
              deletionSummary.stripe.subscriptionsCancelled++;
              console.log(`   ✅ Cancelled additional subscription: ${sub.id}`);
            } catch (err) {
              deletionSummary.stripe.errors.push(`Failed to cancel subscription ${sub.id}: ${err.message}`);
              console.error(`   ❌ Failed to cancel subscription ${sub.id}: ${err.message}`);
            }
          }
        }
      } catch (err) {
        deletionSummary.stripe.errors.push(`Failed to list subscriptions: ${err.message}`);
        console.error(`   ❌ Failed to list subscriptions: ${err.message}`);
      }

      // Note: We do NOT delete the Stripe customer itself, as it may be needed for future testing
      // If you need a complete reset, you can manually delete the customer in Stripe Dashboard
      console.log(`   ℹ️  Stripe customer ${stripeCustomerId} kept (can be manually deleted if needed)`);
      
    } catch (err) {
      deletionSummary.stripe.errors.push(`Stripe purge error: ${err.message}`);
      console.error(`   ❌ Stripe purge error: ${err.message}`);
    }
  } else {
    console.log('   ⚠️  Skipping Stripe purge (no customer ID or Stripe not configured)');
  }

  console.log('');

  // Step 3: Purge DB data (using individual operations to handle missing tables gracefully)
  console.log('🗑️  Purging database billing data...');
  
  try {
    // Delete Subscription record
    try {
      const subscriptionDeleted = await prisma.subscription.deleteMany({
        where: { shopId },
      });
      deletionSummary.database.Subscription = subscriptionDeleted.count;
      console.log(`   ✅ Deleted ${subscriptionDeleted.count} Subscription record(s)`);
    } catch (err) {
      console.error(`   ❌ Failed to delete Subscription: ${err.message}`);
      throw err;
    }

    // Delete ShopBillingProfile
    try {
      const billingProfileDeleted = await prisma.shopBillingProfile.deleteMany({
        where: { shopId },
      });
      deletionSummary.database.ShopBillingProfile = billingProfileDeleted.count;
      console.log(`   ✅ Deleted ${billingProfileDeleted.count} ShopBillingProfile record(s)`);
    } catch (err) {
      console.error(`   ❌ Failed to delete ShopBillingProfile: ${err.message}`);
      throw err;
    }

    // Delete InvoiceRecord
    try {
      const invoiceDeleted = await prisma.invoiceRecord.deleteMany({
        where: { shopId },
      });
      deletionSummary.database.InvoiceRecord = invoiceDeleted.count;
      console.log(`   ✅ Deleted ${invoiceDeleted.count} InvoiceRecord record(s)`);
    } catch (err) {
      console.error(`   ❌ Failed to delete InvoiceRecord: ${err.message}`);
      throw err;
    }

    // Delete TaxEvidence (in case any are orphaned)
    try {
      const taxEvidenceDeleted = await prisma.taxEvidence.deleteMany({
        where: { shopId },
      });
      deletionSummary.database.TaxEvidence = taxEvidenceDeleted.count;
      console.log(`   ✅ Deleted ${taxEvidenceDeleted.count} TaxEvidence record(s)`);
    } catch (err) {
      console.error(`   ❌ Failed to delete TaxEvidence: ${err.message}`);
      throw err;
    }

    // Delete BillingTransaction (if table exists)
    try {
      const billingTxnDeleted = await prisma.billingTransaction.deleteMany({
        where: { shopId },
      });
      deletionSummary.database.BillingTransaction = billingTxnDeleted.count;
      console.log(`   ✅ Deleted ${billingTxnDeleted.count} BillingTransaction record(s)`);
    } catch (err) {
      if (err.message?.includes('does not exist') || err.code === 'P2021') {
        console.log(`   ⚠️  BillingTransaction table does not exist (skipping)`);
      } else {
        console.error(`   ❌ Failed to delete BillingTransaction: ${err.message}`);
        throw err;
      }
    }

    // Delete Purchase records (billing-related, if table exists)
    try {
      const purchaseDeleted = await prisma.purchase.deleteMany({
        where: { shopId },
      });
      deletionSummary.database.Purchase = purchaseDeleted.count;
      console.log(`   ✅ Deleted ${purchaseDeleted.count} Purchase record(s)`);
    } catch (err) {
      if (err.message?.includes('does not exist') || err.code === 'P2021') {
        console.log(`   ⚠️  Purchase table does not exist (skipping)`);
      } else {
        console.error(`   ❌ Failed to delete Purchase: ${err.message}`);
        throw err;
      }
    }

    // Delete Stripe webhook events for this shop
    try {
      const webhookDeleted = await prisma.webhookEvent.deleteMany({
        where: {
          shopId,
          provider: 'stripe',
        },
      });
      deletionSummary.database.WebhookEvent = webhookDeleted.count;
      console.log(`   ✅ Deleted ${webhookDeleted.count} Stripe WebhookEvent record(s)`);
    } catch (err) {
      console.error(`   ❌ Failed to delete WebhookEvent: ${err.message}`);
      throw err;
    }

    // Clear Shop billing fields (but keep the Shop record)
    try {
      await prisma.shop.update({
        where: { id: shopId },
        data: {
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          planType: null,
          subscriptionStatus: 'inactive',
          subscriptionInterval: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          includedSmsPerPeriod: null,
          usedSmsThisPeriod: 0,
          lastPeriodResetAt: null,
          lastFreeCreditsAllocatedAt: null,
          lastBillingError: null,
        },
      });
      deletionSummary.database.ShopFieldsCleared = true;
      console.log(`   ✅ Cleared all billing fields on Shop record`);
    } catch (err) {
      console.error(`   ❌ Failed to clear Shop billing fields: ${err.message}`);
      throw err;
    }

    console.log('   ✅ Database purge completed successfully');
  } catch (err) {
    console.error(`   ❌ Database purge error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }

  console.log('');

  // Step 4: Verify deletion
  console.log('🔍 Verifying deletion...');
  
  // Build select object, excluding relations that might not exist
  const verificationSelect = {
    shopDomain: true,
    stripeCustomerId: true,
    stripeSubscriptionId: true,
    planType: true,
    subscriptionStatus: true,
    subscriptionInterval: true,
    billingProfile: {
      select: { id: true },
    },
    subscriptionRecord: {
      select: { id: true },
    },
    invoiceRecords: {
      select: { id: true },
      take: 1,
    },
  };

  // Only include billingTransactions if the table exists (check via separate query)
  let hasBillingTransactions = false;
  try {
    await prisma.$queryRaw`SELECT 1 FROM "BillingTransaction" LIMIT 1`;
    hasBillingTransactions = true;
    verificationSelect.billingTransactions = {
      select: { id: true },
      take: 1,
    };
  } catch (err) {
    // Table doesn't exist, skip this relation
  }

  const verification = await prisma.shop.findUnique({
    where: { id: shopId },
    select: verificationSelect,
  });

  if (!verification) {
    console.error('❌ ERROR: Shop not found after purge (this should not happen)');
    process.exit(1);
  }

  const allCleared = 
    !verification.stripeCustomerId &&
    !verification.stripeSubscriptionId &&
    !verification.planType &&
    verification.subscriptionStatus === 'inactive' &&
    !verification.billingProfile &&
    !verification.subscriptionRecord &&
    verification.invoiceRecords.length === 0 &&
    (!hasBillingTransactions || (verification.billingTransactions && verification.billingTransactions.length === 0));

  if (allCleared) {
    console.log('   ✅ All billing data successfully purged');
  } else {
    console.warn('   ⚠️  Some billing data may still exist:');
    if (verification.stripeCustomerId) console.warn(`      - stripeCustomerId: ${verification.stripeCustomerId}`);
    if (verification.stripeSubscriptionId) console.warn(`      - stripeSubscriptionId: ${verification.stripeSubscriptionId}`);
    if (verification.planType) console.warn(`      - planType: ${verification.planType}`);
    if (verification.billingProfile) console.warn(`      - billingProfile still exists`);
    if (verification.subscriptionRecord) console.warn(`      - subscriptionRecord still exists`);
    if (verification.invoiceRecords.length > 0) console.warn(`      - ${verification.invoiceRecords.length} invoiceRecord(s) still exist`);
    if (hasBillingTransactions && verification.billingTransactions && verification.billingTransactions.length > 0) {
      console.warn(`      - ${verification.billingTransactions.length} billingTransaction(s) still exist`);
    }
  }

  console.log('');

  // Step 5: Print summary
  console.log('📊 DELETION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Shop: ${shopDomainArg} (ID: ${shopId})`);
  console.log('');
  console.log('Stripe:');
  console.log(`  - Subscriptions cancelled: ${deletionSummary.stripe.subscriptionsCancelled}`);
  console.log(`  - Customer deleted: ${deletionSummary.stripe.customerDeleted ? 'Yes' : 'No (kept for future use)'}`);
  if (deletionSummary.stripe.errors.length > 0) {
    console.log(`  - Errors: ${deletionSummary.stripe.errors.length}`);
    deletionSummary.stripe.errors.forEach(err => console.log(`    - ${err}`));
  }
  console.log('');
  console.log('Database:');
  console.log(`  - Subscription: ${deletionSummary.database.Subscription} record(s)`);
  console.log(`  - ShopBillingProfile: ${deletionSummary.database.ShopBillingProfile} record(s)`);
  console.log(`  - InvoiceRecord: ${deletionSummary.database.InvoiceRecord} record(s)`);
  console.log(`  - TaxEvidence: ${deletionSummary.database.TaxEvidence} record(s)`);
  console.log(`  - BillingTransaction: ${deletionSummary.database.BillingTransaction} record(s)`);
  console.log(`  - Purchase: ${deletionSummary.database.Purchase} record(s)`);
  console.log(`  - WebhookEvent (Stripe): ${deletionSummary.database.WebhookEvent} record(s)`);
  console.log(`  - Shop billing fields cleared: ${deletionSummary.database.ShopFieldsCleared ? 'Yes' : 'No'}`);
  console.log('');
  console.log('✅ Purge completed successfully!');
  console.log('═══════════════════════════════════════════════════════════');
}

// Run the purge
purgeBillingForShop()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

