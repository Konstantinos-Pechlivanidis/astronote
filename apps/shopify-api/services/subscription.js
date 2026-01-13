import prisma from './prisma.js';
import { credit } from './wallet.js';
import { logger } from '../utils/logger.js';
import {
  SubscriptionStatus,
  SubscriptionPlanType,
} from '../utils/prismaEnums.js';
import Stripe from 'stripe';
import { resolveTaxTreatment } from './tax-resolver.js';

// Initialize Stripe (only if API key is available)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  })
  : null;

/**
 * Subscription Service
 * Handles subscription management for Shopify stores
 * Adapted for shopId-based instead of userId-based
 */

// Plan configuration
// Note: Billing periods are configured in Stripe (monthly for Starter, yearly for Pro)
// The priceEur values here are for reference/display purposes only
export const PLANS = {
  starter: {
    priceEur: 40, // €40/month - configured in Stripe as recurring monthly price
    freeCredits: 100, // 100 credits allocated on each billing cycle (monthly)
    stripePriceIdEnv: 'STRIPE_PRICE_ID_SUB_STARTER_EUR',
  },
  pro: {
    priceEur: 240, // €240/year - configured in Stripe as recurring yearly price
    freeCredits: 500, // 500 credits allocated on each billing cycle (yearly)
    stripePriceIdEnv: 'STRIPE_PRICE_ID_SUB_PRO_EUR',
  },
};

const normalizeStripeStatus = (status) => {
  if (!status) return null;
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due') return 'past_due';
  if (status === 'unpaid') return 'unpaid';
  if (status === 'incomplete') return 'incomplete';
  if (status === 'paused') return 'paused';
  if (status === 'canceled' || status === 'incomplete_expired') {
    return 'cancelled';
  }
  return null;
};

// Deprecated: Use plan-catalog.resolvePlanFromPriceId() instead
// eslint-disable-next-line no-unused-vars
const resolvePlanTypeFromStripeSubscription = (subscription) => {
  const metadataPlanType = subscription?.metadata?.planType;
  if (metadataPlanType && ['starter', 'pro'].includes(metadataPlanType)) {
    return metadataPlanType;
  }

  const priceId = subscription?.items?.data?.[0]?.price?.id;
  if (!priceId) return null;

  const starterPriceIds = [
    process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR,
    process.env.STRIPE_PRICE_ID_SUB_STARTER_USD,
  ].filter(Boolean);
  const proPriceIds = [
    process.env.STRIPE_PRICE_ID_SUB_PRO_EUR,
    process.env.STRIPE_PRICE_ID_SUB_PRO_USD,
  ].filter(Boolean);

  if (starterPriceIds.includes(priceId)) return 'starter';
  if (proPriceIds.includes(priceId)) return 'pro';
  return null;
};

// Credit top-up pricing
export const CREDIT_PRICE_EUR = Number.parseFloat(
  process.env.CREDIT_PRICE_EUR || '0.045',
);
export const CREDIT_PRICE_USD = Number.parseFloat(
  process.env.CREDIT_PRICE_USD || process.env.CREDIT_PRICE_EUR || '0.045',
);
export const VAT_RATE = 0.24; // Legacy fallback (GR default)

/**
 * Get free credits for a plan
 * @param {string} planType - 'starter' or 'pro'
 * @returns {number} Number of free credits
 */
export function getFreeCreditsForPlan(planType) {
  const plan = PLANS[planType];
  if (!plan) {
    logger.warn({ planType }, 'Unknown plan type');
    return 0;
  }
  return plan.freeCredits;
}

/**
 * Get plan configuration
 * @param {string} planType - 'starter' or 'pro'
 * @returns {Object|null} Plan configuration
 */
export function getPlanConfig(planType) {
  return PLANS[planType] || null;
}

/**
 * Check if shop has active subscription
 * @param {string} shopId - Shop ID
 * @returns {Promise<boolean>} True if subscription is active
 */
export async function isSubscriptionActive(shopId) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { subscriptionStatus: true },
    });
    return shop?.subscriptionStatus === 'active';
  } catch (err) {
    logger.error(
      { shopId, err: err.message },
      'Failed to check subscription status',
    );
    return false;
  }
}

/**
 * Get current subscription status
 * @param {string} shopId - Shop ID
 * @returns {Promise<Object>} Subscription status object
 */
export async function getSubscriptionStatus(shopId) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        planType: true,
        subscriptionStatus: true,
        lastFreeCreditsAllocatedAt: true,
        subscriptionInterval: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        includedSmsPerPeriod: true,
        usedSmsThisPeriod: true,
        currency: true,
        lastBillingError: true,
      },
    });

    // Also get Subscription model for pendingChange and reconciliation tracking
    // TODO: Remove try-catch once migration 20250206000000_add_subscription_interval_fields is deployed
    // Temporary backward-compatible query to prevent crashes if DB doesn't have new columns yet
    let subscriptionRecord = null;
    try {
      subscriptionRecord = await prisma.subscription.findUnique({
        where: { shopId },
        select: {
          planCode: true,
          interval: true,
          currency: true,
          status: true,
          pendingChangePlanCode: true,
          pendingChangeInterval: true,
          pendingChangeCurrency: true,
          pendingChangeEffectiveAt: true,
          lastSyncedAt: true,
          sourceOfTruth: true,
        },
      });
    } catch (err) {
      // If columns don't exist yet, fallback to basic query
      if (err.message?.includes('does not exist')) {
        logger.warn('Subscription interval fields not yet migrated, using fallback query', { shopId });
        subscriptionRecord = await prisma.subscription.findUnique({
          where: { shopId },
          select: {
            planCode: true,
            currency: true,
            status: true,
          },
        });
        // Set defaults for missing fields
        if (subscriptionRecord) {
          subscriptionRecord.interval = null;
          subscriptionRecord.pendingChangePlanCode = null;
          subscriptionRecord.pendingChangeInterval = null;
          subscriptionRecord.pendingChangeCurrency = null;
          subscriptionRecord.pendingChangeEffectiveAt = null;
          subscriptionRecord.lastSyncedAt = null;
          subscriptionRecord.sourceOfTruth = null;
        }
      } else {
        throw err;
      }
    }

    if (!shop) {
      return {
        active: false,
        planType: null,
        status: SubscriptionStatus.inactive,
      };
    }

    // Prefer Subscription model fields if available (more accurate)
    const planCode = subscriptionRecord?.planCode || shop.planType;
    const interval = subscriptionRecord?.interval || shop.subscriptionInterval || null;
    const currency = subscriptionRecord?.currency || shop.currency || 'EUR';
    const status = subscriptionRecord?.status || shop.subscriptionStatus;

    // Build pendingChange object if exists
    const pendingChange = subscriptionRecord?.pendingChangePlanCode
      ? {
        planCode: subscriptionRecord.pendingChangePlanCode,
        interval: subscriptionRecord.pendingChangeInterval || null,
        currency: subscriptionRecord.pendingChangeCurrency || null,
        effectiveAt: subscriptionRecord.pendingChangeEffectiveAt || null,
      }
      : null;

    // Determine source of truth for debugging
    let derivedFrom = 'db_fallback';
    if (subscriptionRecord?.sourceOfTruth) {
      derivedFrom = subscriptionRecord.sourceOfTruth;
    } else if (subscriptionRecord?.planCode || subscriptionRecord?.interval) {
      derivedFrom = 'subscription_record';
    } else if (shop.planType || shop.subscriptionInterval) {
      derivedFrom = 'shop_record';
    }

    // Mismatch detection: If we have Stripe subscription ID, verify against Stripe
    let stripeTruth = null;
    if (shop.stripeSubscriptionId && stripe) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(shop.stripeSubscriptionId, {
          expand: ['items.data.price'],
        });
        const priceId = stripeSub.items?.data?.[0]?.price?.id;
        if (priceId) {
          const planCatalog = await import('./plan-catalog.js');
          const resolved = planCatalog.resolvePlanFromPriceId(priceId);
          if (resolved) {
            stripeTruth = {
              planCode: resolved.planCode,
              interval: resolved.interval,
              currency: resolved.currency,
            };
            // Check for mismatches
            if (
              stripeTruth.planCode !== planCode ||
              stripeTruth.interval !== interval ||
              stripeTruth.currency !== currency
            ) {
              logger.warn('Subscription mismatch detected between DB and Stripe', {
                shopId,
                db: { planCode, interval, currency },
                stripe: stripeTruth,
              });
              // Update DB to match Stripe (source of truth)
              await prisma.shop.update({
                where: { id: shopId },
                data: {
                  planType: stripeTruth.planCode,
                  subscriptionInterval: stripeTruth.interval,
                  currency: stripeTruth.currency,
                },
              });
              // Update Subscription record if it exists
              try {
                await prisma.subscription.updateMany({
                  where: { shopId },
                  data: {
                    planCode: stripeTruth.planCode,
                    interval: stripeTruth.interval,
                    currency: stripeTruth.currency,
                    lastSyncedAt: new Date(),
                    sourceOfTruth: 'mismatch_correction',
                  },
                });
              } catch (updateErr) {
                // Ignore if Subscription table doesn't have these columns yet
                logger.debug('Could not update Subscription record for mismatch correction', {
                  shopId,
                  error: updateErr.message,
                });
              }
              // Return Stripe truth
              return {
                active: status === SubscriptionStatus.active,
                planType: stripeTruth.planCode,
                planCode: stripeTruth.planCode,
                status,
                stripeCustomerId: shop.stripeCustomerId,
                stripeSubscriptionId: shop.stripeSubscriptionId,
                lastFreeCreditsAllocatedAt: shop.lastFreeCreditsAllocatedAt,
                billingCurrency: stripeTruth.currency,
                currency: stripeTruth.currency,
                interval: stripeTruth.interval,
                currentPeriodStart: shop.currentPeriodStart || null,
                currentPeriodEnd: shop.currentPeriodEnd || null,
                cancelAtPeriodEnd: shop.cancelAtPeriodEnd ?? false,
                includedSmsPerPeriod: shop.includedSmsPerPeriod || 0,
                usedSmsThisPeriod: shop.usedSmsThisPeriod || 0,
                remainingSmsThisPeriod: Math.max(
                  0,
                  (status === SubscriptionStatus.active
                    ? shop.includedSmsPerPeriod || 0
                    : 0) - (shop.usedSmsThisPeriod || 0),
                ),
                lastBillingError: shop.lastBillingError || null,
                pendingChange,
                lastSyncedAt: new Date(),
                sourceOfTruth: 'mismatch_correction',
                derivedFrom: 'stripe_priceId',
                mismatchDetected: true,
              };
            }
          }
        }
      } catch (stripeErr) {
        // If Stripe retrieval fails, continue with DB values
        logger.debug('Could not verify subscription against Stripe', {
          shopId,
          error: stripeErr.message,
        });
      }
    }

    return {
      active: status === SubscriptionStatus.active,
      planType: planCode,
      planCode, // Alias for consistency
      status,
      stripeCustomerId: shop.stripeCustomerId,
      stripeSubscriptionId: shop.stripeSubscriptionId,
      lastFreeCreditsAllocatedAt: shop.lastFreeCreditsAllocatedAt,
      billingCurrency: currency,
      currency, // Alias for consistency
      interval,
      currentPeriodStart: shop.currentPeriodStart || null,
      currentPeriodEnd: shop.currentPeriodEnd || null,
      cancelAtPeriodEnd: shop.cancelAtPeriodEnd ?? false,
      includedSmsPerPeriod: shop.includedSmsPerPeriod || 0,
      usedSmsThisPeriod: shop.usedSmsThisPeriod || 0,
      remainingSmsThisPeriod: Math.max(
        0,
        (status === SubscriptionStatus.active
          ? shop.includedSmsPerPeriod || 0
          : 0) - (shop.usedSmsThisPeriod || 0),
      ),
      lastBillingError: shop.lastBillingError || null,
      pendingChange,
      lastSyncedAt: subscriptionRecord?.lastSyncedAt || null,
      sourceOfTruth: subscriptionRecord?.sourceOfTruth || null,
      derivedFrom,
      mismatchDetected: false,
    };
  } catch (err) {
    logger.error(
      { shopId, err: err.message },
      'Failed to get subscription status',
    );
    throw err;
  }
}

/**
 * Get billing period start date from Stripe subscription
 * @param {Object} stripeSubscription - Stripe subscription object
 * @param {Date} now - Current date
 * @returns {Date} Billing period start date
 */
export function getBillingPeriodStart(stripeSubscription, now = new Date()) {
  if (!stripeSubscription || !stripeSubscription.current_period_start) {
    // If no subscription data, assume monthly billing starting from now
    const start = new Date(now);
    start.setDate(1); // First day of current month
    start.setHours(0, 0, 0, 0);
    return start;
  }

  // Convert Stripe timestamp (seconds) to Date
  return new Date(stripeSubscription.current_period_start * 1000);
}

/**
 * Allocate free credits for a billing cycle (idempotent)
 * @param {string} shopId - Shop ID
 * @param {string} planType - 'starter' or 'pro'
 * @param {string} invoiceId - Stripe invoice ID (for idempotency)
 * @param {Object} stripeSubscription - Stripe subscription object (optional)
 * @returns {Promise<Object>} Result with allocated credits and status
 */
export async function allocateFreeCredits(
  shopId,
  planType,
  invoiceId,
  stripeSubscription = null,
) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        planType: true,
        subscriptionStatus: true,
        lastFreeCreditsAllocatedAt: true,
      },
    });

    if (!shop) {
      throw new Error('Shop not found');
    }

    // Verify subscription is active (required for credit allocation)
    if (shop.subscriptionStatus !== SubscriptionStatus.active) {
      logger.warn(
        { shopId, subscriptionStatus: shop.subscriptionStatus },
        'Subscription not active',
      );
      return { allocated: false, reason: 'subscription_not_active' };
    }

    // Trust the planType parameter passed in (it was set by activateSubscription)
    // Only warn if there's a mismatch, but don't block allocation
    if (shop.planType && shop.planType !== planType) {
      logger.warn(
        { shopId, shopPlanType: shop.planType, requestedPlanType: planType },
        'Plan type mismatch, but proceeding with requested planType',
      );
    }

    // Get free credits for plan
    const freeCredits = getFreeCreditsForPlan(planType);
    if (freeCredits === 0) {
      logger.warn({ shopId, planType }, 'No free credits for plan');
      return { allocated: false, reason: 'no_free_credits' };
    }

    // Check if credits already allocated for current billing period
    const now = new Date();
    let billingPeriodStart = null;

    if (stripeSubscription) {
      billingPeriodStart = getBillingPeriodStart(stripeSubscription, now);
    } else if (shop.lastFreeCreditsAllocatedAt) {
      // If no subscription data, assume monthly billing
      // Check if last allocation was in current month
      const lastAllocated = new Date(shop.lastFreeCreditsAllocatedAt);
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      if (lastAllocated >= currentMonthStart) {
        logger.info(
          { shopId, lastAllocated, currentMonthStart },
          'Credits already allocated for this billing period',
        );
        return {
          allocated: false,
          reason: 'already_allocated',
          credits: freeCredits,
        };
      }
      billingPeriodStart = currentMonthStart;
    }

    // Check idempotency via CreditTransaction (check if invoice already processed)
    if (invoiceId) {
      const existingTxn = await prisma.creditTransaction.findFirst({
        where: {
          shopId,
          reason: `subscription:${planType}:cycle`,
          meta: {
            path: ['invoiceId'],
            equals: invoiceId,
          },
        },
      });

      if (existingTxn) {
        logger.info(
          { shopId, invoiceId },
          'Credits already allocated for this invoice',
        );
        return {
          allocated: false,
          reason: 'invoice_already_processed',
          credits: freeCredits,
        };
      }
    }

    // Allocate credits
    await prisma.$transaction(async tx => {
      // Credit wallet
      await credit(
        shopId,
        freeCredits,
        {
          reason: `subscription:${planType}:cycle`,
          meta: {
            invoiceId: invoiceId || null,
            planType,
            allocatedAt: now.toISOString(),
            billingPeriodStart: billingPeriodStart
              ? billingPeriodStart.toISOString()
              : null,
          },
        },
        tx,
      );

      // Update last allocated timestamp
      await tx.shop.update({
        where: { id: shopId },
        data: { lastFreeCreditsAllocatedAt: now },
      });
    });

    logger.info(
      { shopId, planType, freeCredits, invoiceId },
      'Free credits allocated',
    );
    return { allocated: true, credits: freeCredits };
  } catch (err) {
    logger.error(
      { shopId, planType, err: err.message, stack: err.stack },
      'Failed to allocate free credits',
    );
    throw err;
  }
}

/**
 * Activate subscription
 * @param {string} shopId - Shop ID
 * @param {string} stripeCustomerId - Stripe customer ID
 * @param {string} stripeSubscriptionId - Stripe subscription ID
 * @param {string} planType - 'starter' or 'pro'
 * @param {Object} [stripeSubscription] - Optional Stripe subscription object for interval/period tracking
 * @returns {Promise<Object>} Updated shop object
 */
export async function activateSubscription(
  shopId,
  stripeCustomerId,
  stripeSubscriptionId,
  planType,
  interval = null,
  stripeSubscription = null,
) {
  try {
    if (
      ![
        SubscriptionPlanType.starter,
        SubscriptionPlanType.pro,
      ].includes(planType)
    ) {
      throw new Error(`Invalid plan type: ${planType}`);
    }

    // Determine interval and period dates from Stripe subscription if provided
    // Use mapping helper to ensure we never assign Stripe object to scalar fields
    let resolvedInterval = interval; // Use provided interval if available
    let currentPeriodStart = null;
    let currentPeriodEnd = null;
    let cancelAtPeriodEnd = false;
    let includedSms = null;

    if (stripeSubscription) {
      // Use mapping helper to safely extract interval (never assign object to scalar)
      const { extractIntervalFromStripeSubscription } = await import('./stripe-mapping.js');
      if (!resolvedInterval) {
        resolvedInterval = extractIntervalFromStripeSubscription(stripeSubscription);
      }
      if (stripeSubscription.current_period_start) {
        currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
      }
      if (stripeSubscription.current_period_end) {
        currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
      }
      cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end || false;
    }

    // Get allowance for plan
    const freeCredits = getFreeCreditsForPlan(planType);
    includedSms = freeCredits; // 1 credit = 1 SMS

    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: {
        stripeCustomerId,
        stripeSubscriptionId,
        planType,
        subscriptionStatus: 'active',
        lastBillingError: null,
        ...(resolvedInterval && { subscriptionInterval: resolvedInterval }),
        ...(currentPeriodStart && { currentPeriodStart }),
        ...(currentPeriodEnd && { currentPeriodEnd }),
        cancelAtPeriodEnd,
        ...(includedSms !== null && { includedSmsPerPeriod: includedSms }),
        usedSmsThisPeriod: 0, // Reset on activation
        lastPeriodResetAt: new Date(),
      },
      select: {
        id: true,
        planType: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionInterval: true,
        currency: true,
      },
    });

    const subscriptionCurrency = stripeSubscription?.items?.data?.[0]?.price?.currency
      ? String(stripeSubscription.items.data[0].price.currency).toUpperCase()
      : shop.currency || null;

    // TODO: Remove try-catch once migration 20250206000000_add_subscription_interval_fields is deployed
    // Temporary backward-compatible upsert to prevent crashes if DB doesn't have new columns yet
    try {
      await prisma.subscription.upsert({
        where: { shopId },
        update: {
          stripeCustomerId,
          stripeSubscriptionId,
          planCode: planType,
          interval: resolvedInterval,
          status: 'active',
          currency: subscriptionCurrency,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          trialEndsAt: stripeSubscription?.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          metadata: stripeSubscription?.metadata || undefined,
          lastSyncedAt: new Date(),
          sourceOfTruth: 'activateSubscription',
        },
        create: {
          shopId,
          provider: 'stripe',
          stripeCustomerId,
          stripeSubscriptionId,
          planCode: planType,
          interval: resolvedInterval,
          status: 'active',
          currency: subscriptionCurrency,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          trialEndsAt: stripeSubscription?.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          metadata: stripeSubscription?.metadata || undefined,
          lastSyncedAt: new Date(),
          sourceOfTruth: 'activateSubscription',
        },
      });
    } catch (err) {
      // If columns don't exist yet, fallback to basic upsert without new fields
      if (err.message?.includes('does not exist') || err.code === 'P2025') {
        logger.warn('Subscription interval fields not yet migrated, using fallback upsert', { shopId });
        await prisma.subscription.upsert({
          where: { shopId },
          update: {
            stripeCustomerId,
            stripeSubscriptionId,
            planCode: planType,
            status: 'active',
            currency: subscriptionCurrency,
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            trialEndsAt: stripeSubscription?.trial_end
              ? new Date(stripeSubscription.trial_end * 1000)
              : null,
            metadata: stripeSubscription?.metadata || undefined,
          },
          create: {
            shopId,
            provider: 'stripe',
            stripeCustomerId,
            stripeSubscriptionId,
            planCode: planType,
            status: 'active',
            currency: subscriptionCurrency,
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            trialEndsAt: stripeSubscription?.trial_end
              ? new Date(stripeSubscription.trial_end * 1000)
              : null,
            metadata: stripeSubscription?.metadata || undefined,
          },
        });
      } else {
        throw err;
      }
    }

    logger.info(
      { shopId, planType, stripeSubscriptionId, interval: resolvedInterval, includedSms },
      'Subscription activated with allowance tracking',
    );
    return shop;
  } catch (err) {
    logger.error(
      { shopId, err: err.message },
      'Failed to activate subscription',
    );
    throw err;
  }
}

/**
 * Deactivate subscription
 * @param {string} shopId - Shop ID
 * @param {string} reason - Reason for deactivation
 * @returns {Promise<Object>} Updated shop object
 */
export async function deactivateSubscription(shopId, reason = 'cancelled') {
  try {
    const status =
      reason === 'cancelled'
        ? SubscriptionStatus.cancelled
        : SubscriptionStatus.inactive;

    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: {
        subscriptionStatus: status,
        // Keep stripeCustomerId and stripeSubscriptionId for reference
        // Keep planType for historical reference
      },
      select: {
        id: true,
        planType: true,
        subscriptionStatus: true,
      },
    });

    await prisma.subscription.updateMany({
      where: { shopId },
      data: {
        status,
        cancelAtPeriodEnd: false,
      },
    });

    logger.info({ shopId, reason, status }, 'Subscription deactivated');
    return shop;
  } catch (err) {
    logger.error(
      { shopId, err: err.message },
      'Failed to deactivate subscription',
    );
    throw err;
  }
}

/**
 * Calculate credit top-up price
 * @param {number} credits - Number of credits
 * @returns {Object} Price breakdown
 */
export function calculateTopupPrice(credits, options = {}) {
  const { currency = 'EUR', billingCountry, vatId, vatIdValidated, ipCountry } = options;
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error('Invalid credits amount');
  }

  const normalizedCurrency = String(currency || 'EUR').toUpperCase();
  const pricePerCredit =
    normalizedCurrency === 'USD' ? CREDIT_PRICE_USD : CREDIT_PRICE_EUR;

  const basePrice = credits * pricePerCredit;
  const taxTreatment = resolveTaxTreatment({
    billingCountry,
    ipCountry,
    vatId,
    vatIdValidated,
  });
  const taxRate = taxTreatment.taxRate ?? 0;
  const taxAmount = basePrice * taxRate;
  const totalPrice = basePrice + taxAmount;

  return {
    credits,
    currency: normalizedCurrency,
    basePrice: Number(basePrice.toFixed(2)),
    taxRate,
    taxAmount: Number(taxAmount.toFixed(2)),
    totalPrice: Number(totalPrice.toFixed(2)),
    taxTreatment: taxTreatment.mode,
    taxJurisdiction: taxTreatment.taxJurisdiction,
    priceEur:
      normalizedCurrency === 'EUR' ? Number(basePrice.toFixed(2)) : undefined,
    vatAmount:
      normalizedCurrency === 'EUR' ? Number(taxAmount.toFixed(2)) : undefined,
    priceEurWithVat:
      normalizedCurrency === 'EUR'
        ? Number(totalPrice.toFixed(2))
        : undefined,
  };
}

/**
 * Get billing summary (subscription + allowance + credits)
 * @param {string} shopId - Shop ID
 * @returns {Promise<Object>} Billing summary
 */
export async function getBillingSummary(shopId) {
  try {
    const { getBalance } = await import('./wallet.js');
    const balance = await getBalance(shopId);
    const subscription = await getSubscriptionStatus(shopId);

    const remainingAllowance = subscription?.remainingSmsThisPeriod || 0;

    return {
      subscription,
      allowance: {
        includedPerPeriod: subscription?.includedSmsPerPeriod || 0,
        usedThisPeriod: subscription?.usedSmsThisPeriod || 0,
        remainingThisPeriod: remainingAllowance,
        currentPeriodStart: subscription?.currentPeriodStart || null,
        currentPeriodEnd: subscription?.currentPeriodEnd || null,
        interval: subscription?.interval || null,
      },
      credits: {
        balance,
        currency: subscription?.billingCurrency || 'EUR',
      },
      billingCurrency: subscription?.billingCurrency || 'EUR',
    };
  } catch (err) {
    logger.error(
      { shopId, err: err.message },
      'Failed to get billing summary',
    );
    throw err;
  }
}

/**
 * Track SMS usage (consumes allowance first, then credits)
 * @param {string} shopId - Shop ID
 * @param {number} count - Number of SMS sent
 * @returns {Promise<Object>} Consumption result
 */
export async function trackSmsUsage(shopId, count) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        subscriptionStatus: true,
        includedSmsPerPeriod: true,
        usedSmsThisPeriod: true,
      },
    });

    if (!shop) {
      throw new Error('Shop not found');
    }

    // Only track if subscription is active
    if (shop.subscriptionStatus !== 'active') {
      return {
        tracked: false,
        reason: 'subscription_not_active',
      };
    }

    // Update usedSmsThisPeriod
    const newUsedCount = (shop.usedSmsThisPeriod || 0) + count;
    await prisma.shop.update({
      where: { id: shopId },
      data: {
        usedSmsThisPeriod: newUsedCount,
      },
    });

    logger.info(
      { shopId, count, newUsedCount },
      'SMS usage tracked',
    );

    return {
      tracked: true,
      usedThisPeriod: newUsedCount,
      remainingAllowance: shop.includedSmsPerPeriod
        ? Math.max(0, shop.includedSmsPerPeriod - newUsedCount)
        : 0,
    };
  } catch (err) {
    logger.error(
      { shopId, count, err: err.message },
      'Failed to track SMS usage',
    );
    throw err;
  }
}

/**
 * Reset allowance for new billing period (idempotent)
 * @param {string} shopId - Shop ID
 * @param {Object} stripeSubscription - Stripe subscription object
 * @returns {Promise<Object>} Reset result
 */
export async function resetAllowanceForNewPeriod(shopId, stripeSubscription) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        subscriptionStatus: true,
        planType: true,
        subscriptionInterval: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        lastPeriodResetAt: true,
      },
    });

    if (!shop) {
      throw new Error('Shop not found');
    }

    if (shop.subscriptionStatus !== 'active') {
      return {
        reset: false,
        reason: 'subscription_not_active',
      };
    }

    // Get new period dates from Stripe
    const newPeriodStart = stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000)
      : null;
    const newPeriodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : null;

    // Check if already reset for this period (idempotency)
    if (
      shop.currentPeriodStart &&
      newPeriodStart &&
      shop.currentPeriodStart.getTime() === newPeriodStart.getTime()
    ) {
      logger.info(
        { shopId, periodStart: newPeriodStart },
        'Allowance already reset for this period',
      );
      return {
        reset: false,
        reason: 'already_reset',
      };
    }

    // Determine interval from Stripe subscription
    let interval = shop.subscriptionInterval;
    if (!interval && stripeSubscription.items?.data?.[0]?.price?.recurring) {
      interval = stripeSubscription.items.data[0].price.recurring.interval; // 'month' or 'year'
    }

    // Get allowance for plan and interval
    const freeCredits = getFreeCreditsForPlan(shop.planType);
    const includedSms = freeCredits; // 1 credit = 1 SMS

    // Reset allowance
    await prisma.shop.update({
      where: { id: shopId },
      data: {
        subscriptionInterval: interval || null,
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        includedSmsPerPeriod: includedSms,
        usedSmsThisPeriod: 0,
        lastPeriodResetAt: new Date(),
      },
    });

    logger.info(
      {
        shopId,
        planType: shop.planType,
        interval,
        includedSms,
        periodStart: newPeriodStart,
        periodEnd: newPeriodEnd,
      },
      'Allowance reset for new billing period',
    );

    return {
      reset: true,
      includedSms,
      periodStart: newPeriodStart?.toISOString() || null,
      periodEnd: newPeriodEnd?.toISOString() || null,
    };
  } catch (err) {
    logger.error(
      { shopId, err: err.message },
      'Failed to reset allowance for new period',
    );
    throw err;
  }
}

/**
 * Reconcile subscription state against Stripe (manual recovery helper)
 * @param {string} shopId - Shop ID
 * @returns {Promise<Object>} Reconciliation result
 */
export async function reconcileSubscriptionFromStripe(shopId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      planType: true,
      subscriptionStatus: true,
      subscriptionInterval: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });

  if (!shop) {
    throw new Error('Shop not found');
  }

  let subscriptionId = shop.stripeSubscriptionId;
  if (!subscriptionId) {
    const record = await prisma.subscription.findUnique({
      where: { shopId },
      select: { stripeSubscriptionId: true },
    });
    subscriptionId = record?.stripeSubscriptionId || null;
  }

  if (!subscriptionId) {
    return {
      reconciled: false,
      reason: 'missing_subscription_id',
    };
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });

  const newStatus = normalizeStripeStatus(stripeSubscription.status) || shop.subscriptionStatus;

  // Use Plan Catalog to resolve planCode, interval, currency from priceId
  const planCatalog = await import('./plan-catalog.js');
  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;

  let newPlanType = shop.planType;
  let interval = null;
  let currency = shop.currency || 'EUR';

  if (priceId) {
    const resolved = planCatalog.resolvePlanFromPriceId(priceId);
    if (resolved) {
      newPlanType = resolved.planCode;
      interval = resolved.interval;
      currency = resolved.currency;
    }
  }

  // Fallback: use metadata if Plan Catalog didn't resolve
  if (!newPlanType) {
    const metadataPlanType = stripeSubscription.metadata?.planType;
    if (metadataPlanType && ['starter', 'pro'].includes(metadataPlanType)) {
      newPlanType = metadataPlanType;
    }
  }

  // Fallback: extract interval from Stripe subscription if not resolved
  if (!interval && stripeSubscription.items?.data?.[0]?.price?.recurring) {
    interval = stripeSubscription.items.data[0].price.recurring.interval;
  }

  // Fallback: extract currency from Stripe subscription if not resolved
  if (!currency && stripeSubscription.items?.data?.[0]?.price?.currency) {
    currency = String(stripeSubscription.items.data[0].price.currency).toUpperCase();
  }
  const cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end || false;
  const currentPeriodStart = stripeSubscription.current_period_start
    ? new Date(stripeSubscription.current_period_start * 1000)
    : null;
  const currentPeriodEnd = stripeSubscription.current_period_end
    ? new Date(stripeSubscription.current_period_end * 1000)
    : null;

  const periodChanged =
    currentPeriodStart &&
    shop.currentPeriodStart &&
    currentPeriodStart.getTime() !== shop.currentPeriodStart.getTime();
  const statusChanged = newStatus && shop.subscriptionStatus !== newStatus;
  const planTypeChanged = newPlanType && shop.planType !== newPlanType;
  const intervalChanged = interval && shop.subscriptionInterval !== interval;

  if (periodChanged && stripeSubscription) {
    const resetResult = await resetAllowanceForNewPeriod(shopId, stripeSubscription);
    if (resetResult.reset) {
      logger.info(
        {
          shopId,
          periodStart: resetResult.periodStart,
          periodEnd: resetResult.periodEnd,
        },
        'Allowance reset during reconciliation',
      );
    }
  }

  if (statusChanged || planTypeChanged || intervalChanged || periodChanged) {
    await prisma.shop.update({
      where: { id: shopId },
      data: {
        ...(statusChanged && { subscriptionStatus: newStatus }),
        ...(statusChanged && newStatus === 'active' && { lastBillingError: null }),
        ...(planTypeChanged && { planType: newPlanType }),
        ...(intervalChanged && { subscriptionInterval: interval }),
        ...(periodChanged && {
          currentPeriodStart,
          currentPeriodEnd,
        }),
        cancelAtPeriodEnd,
      },
    });
  }

  const subscriptionCurrency = stripeSubscription.items?.data?.[0]?.price?.currency
    ? String(stripeSubscription.items.data[0].price.currency).toUpperCase()
    : null;

  // TODO: Remove try-catch once migration 20250206000000_add_subscription_interval_fields is deployed
  try {
    await prisma.subscription.upsert({
      where: { shopId },
      update: {
        stripeCustomerId: shop.stripeCustomerId || stripeSubscription.customer || null,
        stripeSubscriptionId: subscriptionId,
        planCode: newPlanType,
        interval: interval || undefined,
        status: newStatus,
        currency: subscriptionCurrency || currency,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        trialEndsAt: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        metadata: stripeSubscription.metadata || undefined,
        lastSyncedAt: new Date(),
        sourceOfTruth: 'reconcile',
      },
      create: {
        shopId,
        provider: 'stripe',
        stripeCustomerId: shop.stripeCustomerId || stripeSubscription.customer || null,
        stripeSubscriptionId: subscriptionId,
        planCode: newPlanType,
        interval: interval || undefined,
        status: newStatus,
        currency: subscriptionCurrency || currency,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        trialEndsAt: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        metadata: stripeSubscription.metadata || undefined,
        lastSyncedAt: new Date(),
        sourceOfTruth: 'reconcile',
      },
    });
  } catch (err) {
    // If columns don't exist yet, fallback to basic upsert without new fields
    if (err.message?.includes('does not exist') || err.code === 'P2025') {
      logger.warn('Subscription interval fields not yet migrated, using fallback upsert', { shopId });
      await prisma.subscription.upsert({
        where: { shopId },
        update: {
          stripeCustomerId: shop.stripeCustomerId || stripeSubscription.customer || null,
          stripeSubscriptionId: subscriptionId,
          planCode: newPlanType,
          status: newStatus,
          currency: subscriptionCurrency || currency,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          trialEndsAt: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          metadata: stripeSubscription.metadata || undefined,
        },
        create: {
          shopId,
          provider: 'stripe',
          stripeCustomerId: shop.stripeCustomerId || stripeSubscription.customer || null,
          stripeSubscriptionId: subscriptionId,
          planCode: newPlanType,
          status: newStatus,
          currency: subscriptionCurrency || currency,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          trialEndsAt: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          metadata: stripeSubscription.metadata || undefined,
        },
      });
    } else {
      throw err;
    }
  }

  return {
    reconciled: true,
    subscriptionId,
    status: newStatus,
    planType: newPlanType,
    interval,
    updated: statusChanged || planTypeChanged || intervalChanged || periodChanged,
  };
}

/**
 * Switch subscription interval (monthly/yearly) - KEEPS SAME PLAN CODE
 * @param {string} shopId - Shop ID
 * @param {string} interval - 'month' or 'year'
 * @param {string} behavior - 'immediate' or 'period_end' (default: 'immediate')
 * @returns {Promise<Object>} Switch result
 */
export async function switchSubscriptionInterval(shopId, interval, behavior = 'immediate') {
  try {
    if (!['month', 'year'].includes(interval)) {
      throw new Error(`Invalid interval: ${interval}. Must be 'month' or 'year'`);
    }

    const subscription = await getSubscriptionStatus(shopId);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    // Keep the same planCode, only change interval
    const currentPlanCode = subscription.planType;
    if (!currentPlanCode) {
      throw new Error('Current subscription plan code not found');
    }

    // If already on the requested interval, no change needed
    if (subscription.interval === interval) {
      logger.info(
        { shopId, interval, planCode: currentPlanCode },
        'Subscription already on requested interval',
      );
      return {
        interval,
        planCode: currentPlanCode,
        alreadyUpdated: true,
      };
    }

    // Get shop currency
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { currency: true },
    });
    const currency = shop?.currency || subscription.billingCurrency || 'EUR';

    // Update Stripe subscription with new interval's price ID (same planCode, different interval)
    const { updateSubscription } = await import('./stripe.js');
    await updateSubscription(
      subscription.stripeSubscriptionId,
      currentPlanCode,
      currency,
      interval,
      behavior,
    );

    // Update local DB immediately (webhook will also update, but this prevents race conditions)
    // Note: activateSubscription may need to be updated to accept interval
    await activateSubscription(
      shopId,
      subscription.stripeCustomerId,
      subscription.stripeSubscriptionId,
      currentPlanCode,
      interval,
    );

    logger.info(
      { shopId, interval, oldInterval: subscription.interval, planCode: currentPlanCode },
      'Subscription interval switched',
    );

    return {
      interval,
      planCode: currentPlanCode,
    };
  } catch (err) {
    logger.error(
      { shopId, interval, err: err.message },
      'Failed to switch subscription interval',
    );
    throw err;
  }
}

export default {
  PLANS,
  CREDIT_PRICE_EUR,
  CREDIT_PRICE_USD,
  VAT_RATE,
  getFreeCreditsForPlan,
  getPlanConfig,
  isSubscriptionActive,
  getSubscriptionStatus,
  allocateFreeCredits,
  activateSubscription,
  deactivateSubscription,
  calculateTopupPrice,
  getBillingPeriodStart,
  getBillingSummary,
  trackSmsUsage,
  resetAllowanceForNewPeriod,
  switchSubscriptionInterval,
  reconcileSubscriptionFromStripe,
};
