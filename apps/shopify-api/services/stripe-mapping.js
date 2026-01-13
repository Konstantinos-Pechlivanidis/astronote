import { logger } from '../utils/logger.js';

/**
 * Map Stripe subscription object to Shop update data
 * Ensures we only store canonical scalar values, never the full Stripe object
 *
 * @param {Object} stripeSubscription - Stripe subscription object
 * @param {Object} options - Additional options
 * @param {string} options.planCode - Plan code (from Plan Catalog or metadata)
 * @param {string} options.currency - Currency (from Plan Catalog or subscription)
 * @returns {Object} Shop update data object
 */
export function mapStripeSubscriptionToShopUpdate(stripeSubscription, options = {}) {
  if (!stripeSubscription || typeof stripeSubscription !== 'object') {
    logger.warn('Invalid Stripe subscription object provided to mapper', {
      type: typeof stripeSubscription,
    });
    return {};
  }

  const {
    planCode = null,
    currency = null,
  } = options;

  // Extract interval robustly
  let interval = null;
  if (stripeSubscription.items?.data?.[0]?.price?.recurring?.interval) {
    interval = stripeSubscription.items.data[0].price.recurring.interval;
  } else if (stripeSubscription.plan?.interval) {
    interval = stripeSubscription.plan.interval;
  } else if (stripeSubscription.metadata?.interval) {
    interval = stripeSubscription.metadata.interval;
  }

  // Normalize interval to "month" | "year"
  if (interval) {
    const normalized = String(interval).toLowerCase();
    if (normalized === 'month' || normalized === 'year') {
      interval = normalized;
    } else {
      logger.warn('Invalid interval value from Stripe subscription', {
        interval,
        subscriptionId: stripeSubscription.id,
      });
      interval = 'month'; // Safe default
    }
  } else {
    // Fallback to safe default
    interval = 'month';
    logger.warn('Interval not found in Stripe subscription, using default "month"', {
      subscriptionId: stripeSubscription.id,
    });
  }

  // Extract currency
  let resolvedCurrency = currency;
  if (!resolvedCurrency && stripeSubscription.items?.data?.[0]?.price?.currency) {
    resolvedCurrency = String(stripeSubscription.items.data[0].price.currency).toUpperCase();
  }
  if (!resolvedCurrency && stripeSubscription.currency) {
    resolvedCurrency = String(stripeSubscription.currency).toUpperCase();
  }

  // Extract period dates
  const currentPeriodStart = stripeSubscription.current_period_start
    ? new Date(stripeSubscription.current_period_start * 1000)
    : null;
  const currentPeriodEnd = stripeSubscription.current_period_end
    ? new Date(stripeSubscription.current_period_end * 1000)
    : null;

  // Extract cancelAtPeriodEnd
  const cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end || false;

  // Extract status (normalize to our enum)
  let subscriptionStatus = 'inactive';
  if (stripeSubscription.status) {
    const status = String(stripeSubscription.status).toLowerCase();
    if (status === 'active' || status === 'trialing') {
      subscriptionStatus = status === 'active' ? 'active' : 'trialing';
    } else if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') {
      subscriptionStatus = status;
    } else if (status === 'canceled' || status === 'cancelled' || status === 'incomplete_expired') {
      subscriptionStatus = 'cancelled';
    }
  }

  // Build update data object (only scalar values)
  const updateData = {
    stripeSubscriptionId: stripeSubscription.id || null,
    subscriptionStatus,
    subscriptionInterval: interval, // Always a string: "month" | "year"
    cancelAtPeriodEnd,
    ...(currentPeriodStart && { currentPeriodStart }),
    ...(currentPeriodEnd && { currentPeriodEnd }),
    ...(planCode && { planType: planCode }),
    ...(resolvedCurrency && { currency: resolvedCurrency }),
  };

  return updateData;
}

/**
 * Map Stripe subscription to interval string
 * Helper for cases where we only need the interval
 *
 * @param {Object} stripeSubscription - Stripe subscription object
 * @returns {string} 'month' | 'year'
 */
export function extractIntervalFromStripeSubscription(stripeSubscription) {
  if (!stripeSubscription || typeof stripeSubscription !== 'object') {
    return 'month'; // Safe default
  }

  let interval = null;
  if (stripeSubscription.items?.data?.[0]?.price?.recurring?.interval) {
    interval = stripeSubscription.items.data[0].price.recurring.interval;
  } else if (stripeSubscription.plan?.interval) {
    interval = stripeSubscription.plan.interval;
  } else if (stripeSubscription.metadata?.interval) {
    interval = stripeSubscription.metadata.interval;
  }

  // Normalize
  if (interval) {
    const normalized = String(interval).toLowerCase();
    if (normalized === 'month' || normalized === 'year') {
      return normalized;
    }
  }

  return 'month'; // Safe default
}

export default {
  mapStripeSubscriptionToShopUpdate,
  extractIntervalFromStripeSubscription,
};

