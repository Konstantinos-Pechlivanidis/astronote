import prisma from './prisma.js';
import { credit } from './wallet.js';
import { logger } from '../utils/logger.js';
import {
  SubscriptionStatus,
  SubscriptionPlanType,
} from '../utils/prismaEnums.js';
import Stripe from 'stripe';

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

// Credit top-up pricing
export const CREDIT_PRICE_EUR = 0.045; // Base price per credit
export const VAT_RATE = 0.24; // 24% VAT

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

    if (!shop) {
      return {
        active: false,
        planType: null,
        status: SubscriptionStatus.inactive,
      };
    }

    return {
      active: shop.subscriptionStatus === SubscriptionStatus.active,
      planType: shop.planType,
      status: shop.subscriptionStatus,
      stripeCustomerId: shop.stripeCustomerId,
      stripeSubscriptionId: shop.stripeSubscriptionId,
      lastFreeCreditsAllocatedAt: shop.lastFreeCreditsAllocatedAt,
      billingCurrency: shop.currency || 'EUR',
      interval: shop.subscriptionInterval || null,
      currentPeriodStart: shop.currentPeriodStart || null,
      currentPeriodEnd: shop.currentPeriodEnd || null,
      cancelAtPeriodEnd: shop.cancelAtPeriodEnd ?? false,
      includedSmsPerPeriod: shop.includedSmsPerPeriod || 0,
      usedSmsThisPeriod: shop.usedSmsThisPeriod || 0,
      remainingSmsThisPeriod: Math.max(
        0,
        (shop.subscriptionStatus === SubscriptionStatus.active
          ? shop.includedSmsPerPeriod || 0
          : 0) - (shop.usedSmsThisPeriod || 0),
      ),
      lastBillingError: shop.lastBillingError || null,
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
    let interval = null;
    let currentPeriodStart = null;
    let currentPeriodEnd = null;
    let cancelAtPeriodEnd = false;
    let includedSms = null;

    if (stripeSubscription) {
      if (stripeSubscription.items?.data?.[0]?.price?.recurring) {
        interval = stripeSubscription.items.data[0].price.recurring.interval;
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
        ...(interval && { subscriptionInterval: interval }),
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
      },
    });

    logger.info(
      { shopId, planType, stripeSubscriptionId, interval, includedSms },
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
export function calculateTopupPrice(credits) {
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error('Invalid credits amount');
  }

  const basePrice = credits * CREDIT_PRICE_EUR;
  const vatAmount = basePrice * VAT_RATE;
  const totalPrice = basePrice + vatAmount;

  return {
    credits,
    priceEur: Number(basePrice.toFixed(2)),
    vatAmount: Number(vatAmount.toFixed(2)),
    priceEurWithVat: Number(totalPrice.toFixed(2)),
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
 * Switch subscription interval (monthly/yearly)
 * @param {string} shopId - Shop ID
 * @param {string} interval - 'month' or 'year'
 * @returns {Promise<Object>} Switch result
 */
export async function switchSubscriptionInterval(shopId, interval) {
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

    // Map interval to plan: month = starter, year = pro (aligned with Retail)
    const intervalToPlan = {
      month: SubscriptionPlanType.starter,
      year: SubscriptionPlanType.pro,
    };
    const newPlanType = intervalToPlan[interval];

    // If already on the correct plan for this interval, no change needed
    if (subscription.planType === newPlanType) {
      logger.info(
        { shopId, interval, planType: newPlanType },
        'Subscription already on correct plan for interval',
      );
      return {
        interval,
        planType: newPlanType,
        alreadyUpdated: true,
      };
    }

    // Get shop currency
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { currency: true },
    });
    const currency = shop?.currency || 'EUR';

    // Update Stripe subscription with new plan's price ID
    const { updateSubscription } = await import('./stripe.js');
    await updateSubscription(
      subscription.stripeSubscriptionId,
      newPlanType,
      currency,
    );

    // Update local DB immediately (webhook will also update, but this prevents race conditions)
    await activateSubscription(
      shopId,
      subscription.stripeCustomerId,
      subscription.stripeSubscriptionId,
      newPlanType,
    );

    logger.info(
      { shopId, interval, oldPlan: subscription.planType, newPlan: newPlanType },
      'Subscription interval switched',
    );

    return {
      interval,
      planType: newPlanType,
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
};
