// apps/api/src/services/subscription.service.js
// Subscription management service

const prisma = require('../lib/prisma');
const { debit } = require('./wallet.service');
const { resolveTaxTreatment } = require('./tax-resolver.service');
const pino = require('pino');

const logger = pino({ name: 'subscription-service' });

// Plan configuration
// Note: Billing periods are configured in Stripe (monthly for Starter, yearly for Pro)
// The priceEur values here are for reference/display purposes only
const PLANS = {
  starter: {
    priceEur: 40,        // €40/month - configured in Stripe as recurring monthly price
    priceUsd: 40,        // $40/month (display only; configured in Stripe)
    freeCredits: 100,    // 100 credits allocated on each billing cycle (monthly)
    stripePriceIdEnv: 'STRIPE_PRICE_ID_SUB_STARTER_EUR',
  },
  pro: {
    priceEur: 240,       // €240/year - configured in Stripe as recurring yearly price
    priceUsd: 240,       // $240/year (display only; configured in Stripe)
    freeCredits: 500,    // 500 credits allocated on each billing cycle (yearly)
    stripePriceIdEnv: 'STRIPE_PRICE_ID_SUB_PRO_EUR',
  },
};

const INTERVAL_BY_PLAN = {
  starter: 'month',
  pro: 'year',
};

const ALLOWANCE_BY_INTERVAL = {
  month: 100,
  year: 500,
};

// Credit top-up pricing
const CREDIT_PRICE_EUR = Number(process.env.CREDIT_PRICE_EUR || 0.045); // Base price per credit
const CREDIT_PRICE_USD = Number(process.env.CREDIT_PRICE_USD || CREDIT_PRICE_EUR);
const VAT_RATE = Number(process.env.CREDIT_VAT_RATE || 0.24); // 24% VAT
const VAT_RATE_USD = Number(process.env.CREDIT_VAT_RATE_USD || 0);

const normalizeStripeStatus = (status) => {
  if (!status) {return null;}
  const normalized = String(status).toLowerCase();
  switch (normalized) {
  case 'active':
    return 'active';
  case 'trialing':
    return 'trialing';
  case 'past_due':
    return 'past_due';
  case 'unpaid':
    return 'unpaid';
  case 'incomplete':
    return 'incomplete';
  case 'paused':
    return 'paused';
  case 'canceled':
  case 'cancelled':
  case 'incomplete_expired':
    return 'cancelled';
  default:
    return 'inactive';
  }
};

const resolvePlanTypeFromStripeSubscription = (stripeSubscription) => {
  if (!stripeSubscription) {return null;}
  const metadataPlan = stripeSubscription.metadata?.planType;
  if (metadataPlan && ['starter', 'pro'].includes(metadataPlan)) {
    return metadataPlan;
  }

  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
  if (!priceId) {return null;}

  // Centralized reverse lookup (Shopify parity)
  const planCatalog = require('./plan-catalog.service');
  const resolved = planCatalog.resolvePlanFromPriceId(priceId);
  return resolved?.planCode || null;
};

/**
 * Get free credits for a plan
 * @param {string} planType - 'starter' or 'pro'
 * @returns {number} Number of free credits
 */
function getFreeCreditsForPlan(planType) {
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
function getPlanConfig(planType) {
  return PLANS[planType] || null;
}

function normalizeInterval(interval) {
  return interval === 'month' || interval === 'year' ? interval : null;
}

function getIntervalForPlan(planType) {
  return INTERVAL_BY_PLAN[planType] || null;
}

function getIncludedSmsForInterval(interval) {
  return ALLOWANCE_BY_INTERVAL[interval] || 0;
}

function resolveIntervalFromStripe(stripeSubscription) {
  const interval = stripeSubscription?.items?.data?.[0]?.price?.recurring?.interval;
  return normalizeInterval(interval);
}

/**
 * Check if user has active subscription
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} True if subscription is active
 */
async function isSubscriptionActive(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    });
    return user?.subscriptionStatus === 'active';
  } catch (err) {
    logger.error({ userId, err: err.message }, 'Failed to check subscription status');
    return false;
  }
}

/**
 * Get current subscription status
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Subscription status object
 */
async function getSubscriptionStatus(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        planType: true,
        subscriptionStatus: true,
        lastFreeCreditsAllocatedAt: true,
        billingCurrency: true,
        subscriptionInterval: true,
        subscriptionCurrentPeriodStart: true,
        subscriptionCurrentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        includedSmsPerPeriod: true,
        usedSmsThisPeriod: true,
        lastBillingError: true,
      },
    });

    if (!user) {
      return {
        active: false,
        planType: null,
        status: 'inactive',
      };
    }

    return {
      active: user.subscriptionStatus === 'active',
      planType: user.planType,
      status: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      lastFreeCreditsAllocatedAt: user.lastFreeCreditsAllocatedAt,
      billingCurrency: user.billingCurrency || 'EUR',
      interval: user.subscriptionInterval,
      currentPeriodStart: user.subscriptionCurrentPeriodStart,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? false,
      includedSmsPerPeriod: user.includedSmsPerPeriod || 0,
      usedSmsThisPeriod: user.usedSmsThisPeriod || 0,
      remainingSmsThisPeriod: Math.max(
        0,
        (user.subscriptionStatus === 'active' ? user.includedSmsPerPeriod || 0 : 0) - (user.usedSmsThisPeriod || 0),
      ),
      lastBillingError: user.lastBillingError || null,
    };
  } catch (err) {
    logger.error({ userId, err: err.message }, 'Failed to get subscription status');
    throw err;
  }
}

/**
 * Get billing period start date from Stripe subscription
 * @param {Object} stripeSubscription - Stripe subscription object
 * @param {Date} now - Current date
 * @returns {Date} Billing period start date
 */
function getBillingPeriodStart(stripeSubscription, now = new Date()) {
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

function getBillingPeriodEnd(stripeSubscription, now = new Date()) {
  if (!stripeSubscription || !stripeSubscription.current_period_end) {
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
    return end;
  }
  return new Date(stripeSubscription.current_period_end * 1000);
}

/**
 * Ensure allowance is reset for the current billing period (idempotent)
 * @param {number} userId - User ID
 * @param {string} planType - 'starter' or 'pro'
 * @param {string} invoiceId - Stripe invoice ID (for idempotency)
 * @param {Object} stripeSubscription - Stripe subscription object (optional)
 * @returns {Promise<Object>} Result with allowance reset status
 */
async function resetAllowanceForPeriod(userId, planType, invoiceId, stripeSubscription = null) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planType: true,
        subscriptionStatus: true,
        lastFreeCreditsAllocatedAt: true,
        subscriptionCurrentPeriodStart: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify subscription is active (required for credit allocation)
    if (user.subscriptionStatus !== 'active') {
      logger.warn({ userId, subscriptionStatus: user.subscriptionStatus }, 'Subscription not active');
      return { allocated: false, reason: 'subscription_not_active' };
    }

    // Trust the planType parameter passed in (it was set by activateSubscription)
    // Only warn if there's a mismatch, but don't block allocation
    if (user.planType && user.planType !== planType) {
      logger.warn({ userId, userPlanType: user.planType, requestedPlanType: planType }, 'Plan type mismatch, but proceeding with requested planType');
    }

    const interval = resolveIntervalFromStripe(stripeSubscription) || getIntervalForPlan(planType) || 'month';
    const includedSmsPerPeriod = getIncludedSmsForInterval(interval);

    // Check if allowance already reset for current billing period
    const now = new Date();
    let billingPeriodStart = null;
    let billingPeriodEnd = null;

    if (stripeSubscription) {
      billingPeriodStart = getBillingPeriodStart(stripeSubscription, now);
      billingPeriodEnd = getBillingPeriodEnd(stripeSubscription, now);
    } else if (user.lastFreeCreditsAllocatedAt) {
      // If no subscription data, assume monthly billing
      // Check if last allocation was in current month
      const lastAllocated = new Date(user.lastFreeCreditsAllocatedAt);
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      if (lastAllocated >= currentMonthStart) {
        logger.info({ userId, lastAllocated, currentMonthStart }, 'Allowance already reset for this billing period');
        return { allocated: false, reason: 'already_allocated', includedSmsPerPeriod };
      }
      billingPeriodStart = currentMonthStart;
    }

    const shouldReset =
      billingPeriodStart &&
      (!user.subscriptionCurrentPeriodStart ||
        new Date(user.subscriptionCurrentPeriodStart).getTime() !== billingPeriodStart.getTime());

    if (!shouldReset && user.lastFreeCreditsAllocatedAt) {
      logger.info({ userId, invoiceId }, 'Allowance reset already processed');
      return { allocated: false, reason: 'already_allocated', includedSmsPerPeriod };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionInterval: interval,
        subscriptionCurrentPeriodStart: billingPeriodStart || null,
        subscriptionCurrentPeriodEnd: billingPeriodEnd || null,
        includedSmsPerPeriod,
        usedSmsThisPeriod: 0,
        lastFreeCreditsAllocatedAt: now,
      },
    });

    logger.info({ userId, planType, includedSmsPerPeriod, invoiceId }, 'Allowance reset for billing period');
    return { allocated: true, includedSmsPerPeriod };
  } catch (err) {
    logger.error({ userId, planType, err: err.message, stack: err.stack }, 'Failed to reset allowance');
    throw err;
  }
}

/**
 * Activate subscription
 * @param {number} userId - User ID
 * @param {string} stripeCustomerId - Stripe customer ID
 * @param {string} stripeSubscriptionId - Stripe subscription ID
 * @param {string} planType - 'starter' or 'pro'
 * @returns {Promise<Object>} Updated user object
 */
async function activateSubscription(userId, stripeCustomerId, stripeSubscriptionId, planType, options = {}) {
  try {
    if (!['starter', 'pro'].includes(planType)) {
      throw new Error(`Invalid plan type: ${planType}`);
    }

    const interval = normalizeInterval(options.interval) || getIntervalForPlan(planType) || 'month';
    const includedSmsPerPeriod = getIncludedSmsForInterval(interval);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId,
        stripeSubscriptionId,
        planType,
        subscriptionStatus: 'active',
        subscriptionInterval: interval,
        subscriptionCurrentPeriodStart: options.currentPeriodStart || null,
        subscriptionCurrentPeriodEnd: options.currentPeriodEnd || null,
        cancelAtPeriodEnd: options.cancelAtPeriodEnd ?? false,
        includedSmsPerPeriod,
        usedSmsThisPeriod: 0,
        lastFreeCreditsAllocatedAt: new Date(),
        lastBillingError: null,
      },
      select: {
        id: true,
        planType: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionInterval: true,
        subscriptionCurrentPeriodStart: true,
        subscriptionCurrentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        includedSmsPerPeriod: true,
        usedSmsThisPeriod: true,
      },
    });

    const stripeSubscription = options.stripeSubscription || null;
    const subscriptionCurrency = stripeSubscription?.items?.data?.[0]?.price?.currency
      ? String(stripeSubscription.items.data[0].price.currency).toUpperCase()
      : options.currency || null;

    try {
      await prisma.subscription.upsert({
        where: { ownerId: userId },
        update: {
          stripeCustomerId,
          stripeSubscriptionId,
          planCode: planType,
          status: 'active',
          currency: subscriptionCurrency,
          currentPeriodStart: options.currentPeriodStart || null,
          currentPeriodEnd: options.currentPeriodEnd || null,
          cancelAtPeriodEnd: options.cancelAtPeriodEnd ?? false,
          trialEndsAt: stripeSubscription?.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          metadata: stripeSubscription?.metadata || undefined,
        },
        create: {
          ownerId: userId,
          provider: 'stripe',
          stripeCustomerId,
          stripeSubscriptionId,
          planCode: planType,
          status: 'active',
          currency: subscriptionCurrency,
          currentPeriodStart: options.currentPeriodStart || null,
          currentPeriodEnd: options.currentPeriodEnd || null,
          cancelAtPeriodEnd: options.cancelAtPeriodEnd ?? false,
          trialEndsAt: stripeSubscription?.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          metadata: stripeSubscription?.metadata || undefined,
        },
      });
    } catch (err) {
      logger.warn({ userId, err: err.message }, 'Failed to upsert subscription record');
    }

    logger.info({ userId, planType, stripeSubscriptionId }, 'Subscription activated');
    return user;
  } catch (err) {
    logger.error({ userId, err: err.message }, 'Failed to activate subscription');
    throw err;
  }
}

/**
 * Deactivate subscription
 * @param {number} userId - User ID
 * @param {string} reason - Reason for deactivation
 * @returns {Promise<Object>} Updated user object
 */
async function deactivateSubscription(userId, reason = 'cancelled') {
  try {
    const status = reason === 'cancelled' ? 'cancelled' : 'inactive';

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: status,
        cancelAtPeriodEnd: false,
        // Keep stripeCustomerId and stripeSubscriptionId for reference
        // Keep planType for historical reference
      },
      select: {
        id: true,
        planType: true,
        subscriptionStatus: true,
      },
    });

    try {
      await prisma.subscription.update({
        where: { ownerId: userId },
        data: {
          status,
          cancelAtPeriodEnd: false,
        },
      });
    } catch (err) {
      if (err?.code !== 'P2025') {
        logger.warn({ userId, err: err.message }, 'Failed to update subscription record on deactivate');
      }
    }

    logger.info({ userId, reason, status }, 'Subscription deactivated');
    return user;
  } catch (err) {
    logger.error({ userId, err: err.message }, 'Failed to deactivate subscription');
    throw err;
  }
}

/**
 * Calculate credit top-up price
 * @param {number} credits - Number of credits
 * @param {string} currency - Currency code (EUR/USD)
 * @returns {Object} Price breakdown
 */
function calculateTopupPrice(credits, input = 'EUR') {
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error('Invalid credits amount');
  }

  let currency = 'EUR';
  let billingCountry = null;
  let vatId = null;
  let vatIdValidated = null;
  let ipCountry = null;

  if (input && typeof input === 'object') {
    currency = input.currency || 'EUR';
    billingCountry = input.billingCountry || null;
    vatId = input.vatId || null;
    vatIdValidated = input.vatIdValidated ?? null;
    ipCountry = input.ipCountry || null;
  } else {
    currency = input || 'EUR';
  }

  const normalizedCurrency = String(currency || 'EUR').toUpperCase();
  const pricePerCredit =
    normalizedCurrency === 'USD' ? CREDIT_PRICE_USD : CREDIT_PRICE_EUR;
  const fallbackRate = normalizedCurrency === 'USD' ? VAT_RATE_USD : VAT_RATE;
  const treatment = resolveTaxTreatment({
    billingCountry,
    vatId,
    vatIdValidated,
    ipCountry,
  });
  const vatRate = Number.isFinite(treatment.taxRate) ? treatment.taxRate : fallbackRate;

  const basePrice = credits * pricePerCredit;
  const vatAmount = basePrice * vatRate;
  const totalPrice = basePrice + vatAmount;

  return {
    credits,
    currency: normalizedCurrency,
    price: Number(basePrice.toFixed(2)),
    vatAmount: Number(vatAmount.toFixed(2)),
    priceWithVat: Number(totalPrice.toFixed(2)),
    priceCents: Math.round(basePrice * 100),
    priceCentsWithVat: Math.round(totalPrice * 100),
    priceEur: normalizedCurrency === 'EUR' ? Number(basePrice.toFixed(2)) : null,
    priceEurWithVat: normalizedCurrency === 'EUR' ? Number(totalPrice.toFixed(2)) : null,
    priceUsd: normalizedCurrency === 'USD' ? Number(basePrice.toFixed(2)) : null,
    priceUsdWithVat: normalizedCurrency === 'USD' ? Number(totalPrice.toFixed(2)) : null,
    taxRate: vatRate,
    taxTreatment: treatment.mode,
    taxJurisdiction: treatment.taxJurisdiction,
  };
}

async function getAllowanceStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      includedSmsPerPeriod: true,
      usedSmsThisPeriod: true,
      subscriptionCurrentPeriodStart: true,
      subscriptionCurrentPeriodEnd: true,
      subscriptionInterval: true,
    },
  });

  if (!user) {
    return {
      includedPerPeriod: 0,
      usedThisPeriod: 0,
      remainingThisPeriod: 0,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      interval: null,
    };
  }

  const included = user.includedSmsPerPeriod || 0;
  const used = user.usedSmsThisPeriod || 0;
  const remaining = user.subscriptionStatus === 'active'
    ? Math.max(0, included - used)
    : 0;

  return {
    includedPerPeriod: included,
    usedThisPeriod: used,
    remainingThisPeriod: remaining,
    currentPeriodStart: user.subscriptionCurrentPeriodStart,
    currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
    interval: user.subscriptionInterval,
  };
}

async function consumeAllowanceThenCredits(userId, amount, opts = {}, tx = null) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  const execute = async (client) => {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        includedSmsPerPeriod: true,
        usedSmsThisPeriod: true,
      },
    });

    const included = user?.includedSmsPerPeriod || 0;
    const used = user?.usedSmsThisPeriod || 0;
    const remaining = user?.subscriptionStatus === 'active'
      ? Math.max(0, included - used)
      : 0;

    const allowanceToUse = Math.min(amount, remaining);
    if (allowanceToUse > 0) {
      await client.user.update({
        where: { id: userId },
        data: { usedSmsThisPeriod: { increment: allowanceToUse } },
      });
    }

    const debitAmount = amount - allowanceToUse;
    let walletResult = null;
    if (debitAmount > 0) {
      walletResult = await debit(userId, debitAmount, opts, client);
    }

    return {
      usedAllowance: allowanceToUse,
      debitedCredits: debitAmount,
      remainingAllowance: Math.max(0, remaining - allowanceToUse),
      balance: walletResult?.balance ?? null,
    };
  };

  if (tx) {
    return execute(tx);
  }

  return prisma.$transaction(execute);
}

async function consumeMessageBilling(userId, amount, opts = {}) {
  const messageId = opts?.messageId ? Number(opts.messageId) : null;

  if (!messageId) {
    const result = await consumeAllowanceThenCredits(userId, amount, opts);
    return {
      ...result,
      billingStatus: 'paid',
      billedAt: new Date(),
    };
  }

  return prisma.$transaction(async (tx) => {
    const message = await tx.campaignMessage.findUnique({
      where: { id: messageId },
      select: { billingStatus: true, billedAt: true },
    });

    if (message?.billingStatus === 'paid') {
      return {
        alreadyBilled: true,
        billingStatus: 'paid',
        billedAt: message.billedAt,
        usedAllowance: 0,
        debitedCredits: 0,
        remainingAllowance: null,
        balance: null,
      };
    }

    const result = await consumeAllowanceThenCredits(userId, amount, opts, tx);
    const billedAt = new Date();

    await tx.campaignMessage.update({
      where: { id: messageId },
      data: {
        billingStatus: 'paid',
        billedAt,
        billingError: null,
      },
    });

    return {
      ...result,
      billingStatus: 'paid',
      billedAt,
    };
  });
}

async function reconcileSubscriptionFromStripe(userId) {
  const { stripe } = require('./stripe.service');

  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      planType: true,
      subscriptionStatus: true,
      subscriptionInterval: true,
      subscriptionCurrentPeriodStart: true,
      subscriptionCurrentPeriodEnd: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  let subscriptionId = user.stripeSubscriptionId;
  if (!subscriptionId) {
    const record = await prisma.subscription.findUnique({
      where: { ownerId: userId },
      select: { stripeSubscriptionId: true },
    });
    subscriptionId = record?.stripeSubscriptionId || null;
  }

  if (!subscriptionId) {
    return { reconciled: false, reason: 'missing_subscription_id' };
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });

  const newStatus = normalizeStripeStatus(stripeSubscription.status) || user.subscriptionStatus;
  const newPlanType = resolvePlanTypeFromStripeSubscription(stripeSubscription) || user.planType;
  const interval = stripeSubscription.items?.data?.[0]?.price?.recurring?.interval || null;
  const cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end || false;
  const currentPeriodStart = stripeSubscription.current_period_start
    ? new Date(stripeSubscription.current_period_start * 1000)
    : null;
  const currentPeriodEnd = stripeSubscription.current_period_end
    ? new Date(stripeSubscription.current_period_end * 1000)
    : null;

  const periodChanged =
    currentPeriodStart &&
    user.subscriptionCurrentPeriodStart &&
    currentPeriodStart.getTime() !== user.subscriptionCurrentPeriodStart.getTime();
  const statusChanged = newStatus && user.subscriptionStatus !== newStatus;
  const planTypeChanged = newPlanType && user.planType !== newPlanType;
  const intervalChanged = interval && user.subscriptionInterval !== interval;

  if (periodChanged && stripeSubscription) {
    try {
      await resetAllowanceForPeriod(
        userId,
        newPlanType || user.planType,
        `reconcile_${subscriptionId}_${stripeSubscription.current_period_start || 0}`,
        stripeSubscription,
      );
    } catch (err) {
      logger.warn({ userId, err: err.message }, 'Allowance reset failed during reconciliation');
    }
  }

  if (statusChanged || planTypeChanged || intervalChanged || periodChanged) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(statusChanged && { subscriptionStatus: newStatus }),
        ...(statusChanged && newStatus === 'active' && { lastBillingError: null }),
        ...(planTypeChanged && { planType: newPlanType }),
        ...(intervalChanged && { subscriptionInterval: interval }),
        ...(periodChanged && {
          subscriptionCurrentPeriodStart: currentPeriodStart,
          subscriptionCurrentPeriodEnd: currentPeriodEnd,
        }),
        cancelAtPeriodEnd,
      },
    });
  }

  const subscriptionCurrency = stripeSubscription.items?.data?.[0]?.price?.currency
    ? String(stripeSubscription.items.data[0].price.currency).toUpperCase()
    : null;

  await prisma.subscription.upsert({
    where: { ownerId: userId },
    update: {
      stripeCustomerId: user.stripeCustomerId || stripeSubscription.customer || null,
      stripeSubscriptionId: subscriptionId,
      planCode: newPlanType,
      status: newStatus,
      currency: subscriptionCurrency,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      trialEndsAt: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : null,
      metadata: stripeSubscription.metadata || undefined,
    },
    create: {
      ownerId: userId,
      provider: 'stripe',
      stripeCustomerId: user.stripeCustomerId || stripeSubscription.customer || null,
      stripeSubscriptionId: subscriptionId,
      planCode: newPlanType,
      status: newStatus,
      currency: subscriptionCurrency,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      trialEndsAt: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : null,
      metadata: stripeSubscription.metadata || undefined,
    },
  });

  return {
    reconciled: true,
    subscriptionId,
    status: newStatus,
    planType: newPlanType,
    interval,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  };
}

module.exports = {
  PLANS,
  CREDIT_PRICE_EUR,
  VAT_RATE,
  getFreeCreditsForPlan,
  getPlanConfig,
  isSubscriptionActive,
  getSubscriptionStatus,
  resetAllowanceForPeriod,
  activateSubscription,
  deactivateSubscription,
  calculateTopupPrice,
  getBillingPeriodStart,
  getBillingPeriodEnd,
  getAllowanceStatus,
  consumeAllowanceThenCredits,
  consumeMessageBilling,
  reconcileSubscriptionFromStripe,
  getIntervalForPlan,
  getIncludedSmsForInterval,
  resolveIntervalFromStripe,
};
