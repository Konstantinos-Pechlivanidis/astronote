#!/usr/bin/env node
/**
 * Backfill Billing Data from Stripe for a Specific Shop
 *
 * Goal:
 * - If webhooks were missed, populate DB mirror so UI invoices + purchase history are not empty.
 * - Stripe is source of truth; DB is mirror/cache + wallet ledger truth.
 *
 * Usage:
 *   node apps/shopify-api/scripts/backfill-billing-from-stripe.js --shopDomain sms-blossom-dev.myshopify.com --confirm
 *
 * Optional:
 *   --includeCredits   (also backfill included credits grants from paid subscription invoices; idempotent)
 */

import Stripe from 'stripe';
import prisma from '../services/prisma.js';
import { logger } from '../utils/logger.js';
import { upsertInvoiceRecord, recordSubscriptionInvoiceTransaction, recordFreeCreditsGrant } from '../services/invoices.js';
import { allocateFreeCredits } from '../services/subscription.js';
import planCatalog from '../services/plan-catalog.js';

const args = process.argv.slice(2);
let shopDomainArg = args.find(arg => arg.startsWith('--shopDomain='))?.split('=')[1];
const confirmArg = args.includes('--confirm');
const includeCredits = args.includes('--includeCredits');

// Support both --shopDomain=value and --shopDomain value formats
if (!shopDomainArg) {
  const shopDomainIndex = args.findIndex(arg => arg === '--shopDomain');
  if (shopDomainIndex !== -1 && args[shopDomainIndex + 1]) {
    shopDomainArg = args[shopDomainIndex + 1];
  }
}

if (!shopDomainArg) {
  console.error('❌ ERROR: --shopDomain is required');
  process.exit(1);
}
if (!confirmArg) {
  console.error('❌ ERROR: --confirm flag is required');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && process.env.ALLOW_PROD_BACKFILL !== 'true') {
  console.error('❌ ERROR: Cannot run in production without ALLOW_PROD_BACKFILL=true');
  process.exit(1);
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ ERROR: STRIPE_SECRET_KEY is required for backfill');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

async function main() {
  console.log('🔍 Finding shop...');
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: shopDomainArg },
    select: {
      id: true,
      shopDomain: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      planType: true,
      subscriptionStatus: true,
      currency: true,
    },
  });

  if (!shop) {
    console.error(`❌ ERROR: Shop "${shopDomainArg}" not found`);
    process.exit(1);
  }

  console.log(`✅ Found shop: ${shop.shopDomain} (ID: ${shop.id})`);
  console.log(`   Stripe Customer ID: ${shop.stripeCustomerId || 'none'}`);
  console.log(`   Stripe Subscription ID: ${shop.stripeSubscriptionId || 'none'}`);
  console.log(`   Include credits backfill: ${includeCredits ? 'yes' : 'no'}`);
  console.log('');

  let stripeCustomerId = shop.stripeCustomerId || null;

  // If we don't have a customer ID but do have subscription ID, resolve customer from subscription.
  if (!stripeCustomerId && shop.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(shop.stripeSubscriptionId, {
        expand: ['customer', 'items.data.price'],
      });
      const resolvedCustomer =
        typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      if (resolvedCustomer) {
        stripeCustomerId = resolvedCustomer;
        await prisma.shop.update({
          where: { id: shop.id },
          data: { stripeCustomerId: resolvedCustomer },
        });
        console.log(`✅ Resolved Stripe customer from subscription: ${resolvedCustomer}`);
      }
    } catch (err) {
      console.warn(`⚠️  Failed to resolve Stripe customer from subscription: ${err.message}`);
    }
  }

  if (!stripeCustomerId) {
    console.error('❌ ERROR: Could not resolve stripeCustomerId (missing in DB and cannot derive)');
    process.exit(1);
  }

  console.log('📥 Fetching Stripe invoices...');
  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit: 100,
    expand: ['data.lines'],
  });

  console.log(`✅ Retrieved ${invoices.data.length} invoice(s) from Stripe`);

  let upsertedInvoices = 0;
  let recordedCharges = 0;
  let recordedIncludedCredits = 0;

  for (const invoice of invoices.data) {
    try {
      await upsertInvoiceRecord(shop.id, invoice);
      upsertedInvoices++;
    } catch (err) {
      console.warn(`⚠️  Failed to upsert invoice ${invoice.id}: ${err.message}`);
    }

    const isSubscriptionInvoice =
      invoice.billing_reason === 'subscription_create' ||
      invoice.billing_reason === 'subscription_cycle';

    if (isSubscriptionInvoice) {
      try {
        const existing = await recordSubscriptionInvoiceTransaction(shop.id, invoice, {
          creditsAdded: 0,
        });
        if (existing) recordedCharges++;
      } catch (err) {
        console.warn(`⚠️  Failed to record subscription charge for ${invoice.id}: ${err.message}`);
      }
    }

    if (includeCredits && isSubscriptionInvoice) {
      // Derive plan from invoice priceId if possible
      const priceId = invoice.lines?.data?.[0]?.price?.id || null;
      const resolved = priceId ? planCatalog.resolvePlanFromPriceId(priceId) : null;
      const planCode = resolved?.planCode || shop.planType || null;
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;

      if (planCode) {
        // Use shared idempotency strategy:
        // - subscription_create: "sub_<subscriptionId>" (matches checkout handler idempotency)
        // - subscription_cycle: invoice.id
        const idempotencyRef =
          invoice.billing_reason === 'subscription_create' && subscriptionId
            ? `sub_${subscriptionId}`
            : invoice.id;

        try {
          const result = await allocateFreeCredits(
            shop.id,
            planCode,
            idempotencyRef,
            null,
            { allowInactive: true },
          );

          if (result?.allocated) {
            const periodInfo = invoice.lines?.data?.[0]?.period
              ? {
                periodStart: invoice.lines.data[0].period.start
                  ? new Date(invoice.lines.data[0].period.start * 1000).toISOString()
                  : null,
                periodEnd: invoice.lines.data[0].period.end
                  ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
                  : null,
              }
              : {};

            await recordFreeCreditsGrant(
              shop.id,
              planCode,
              result.credits,
              idempotencyRef,
              periodInfo,
              invoice.currency?.toUpperCase() || shop.currency || 'EUR',
            );
            recordedIncludedCredits++;
          }
        } catch (err) {
          console.warn(`⚠️  Failed to backfill included credits for ${invoice.id}: ${err.message}`);
        }
      }
    }
  }

  console.log('');
  console.log('✅ Backfill complete');
  console.log(`   InvoiceRecord upserts: ${upsertedInvoices}`);
  console.log(`   BillingTransaction(subscription_charge) ensured: ${recordedCharges}`);
  console.log(`   Included credits grants ensured: ${recordedIncludedCredits}`);

  logger.info('Billing backfill from Stripe complete', {
    shopId: shop.id,
    shopDomain: shop.shopDomain,
    stripeCustomerId,
    invoices: invoices.data.length,
    includeCredits,
  });
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(`❌ Backfill failed: ${err.message}`);
    process.exit(1);
  });


