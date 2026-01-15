import { logger } from '../utils/logger.js';
import prisma from './prisma.js';
import { SubscriptionStatus } from '../utils/prismaEnums.js';
import { isValidScheduledChange } from './subscription-change-policy.js';
import Stripe from 'stripe';

// Stripe client (optional). Keep initialization consistent across the codebase.
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

/**
 * StripeSyncService - Absolute Stripe↔DB Transparency
 *
 * This service ensures that DB always reflects Stripe truth.
 * On every read, we fetch from Stripe and update DB if there's a mismatch.
 */

/**
 * Fetch subscription from Stripe and derive canonical fields
 * @param {string} stripeSubscriptionId - Stripe subscription ID
 * @returns {Promise<Object|null>} Stripe subscription object or null
 */
export async function fetchStripeSubscription(stripeSubscriptionId) {
  if (!stripe || !stripeSubscriptionId) {
    return null;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['items.data.price', 'customer', 'schedule'],
    });
    return subscription;
  } catch (err) {
    logger.error('Failed to fetch Stripe subscription', {
      subscriptionId: stripeSubscriptionId,
      error: err.message,
    });
    return null;
  }
}

const derivePendingChangeFromStripeSchedule = async (stripeSubscription) => {
  const schedule = stripeSubscription?.schedule;
  if (!schedule || !Array.isArray(schedule.phases) || schedule.phases.length < 2) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const nextPhase = schedule.phases.find(
    (phase) => phase?.start_date && phase.start_date > now,
  );

  if (!nextPhase || !Array.isArray(nextPhase.items) || nextPhase.items.length === 0) {
    return null;
  }

  const nextPrice = nextPhase.items[0]?.price || null;
  const nextPriceId = typeof nextPrice === 'string' ? nextPrice : nextPrice?.id;
  if (!nextPriceId) {
    return null;
  }

  const planCatalog = await import('./plan-catalog.js');
  const resolved = planCatalog.resolvePlanFromPriceId(nextPriceId);
  if (!resolved) {
    return null;
  }

  return {
    planCode: resolved.planCode,
    interval: resolved.interval,
    currency: resolved.currency,
    effectiveAt: new Date(nextPhase.start_date * 1000),
  };
};

const clearPendingChange = async (shopId, reason) => {
  try {
    await prisma.subscription.updateMany({
      where: { shopId },
      data: {
        pendingChangePlanCode: null,
        pendingChangeInterval: null,
        pendingChangeCurrency: null,
        pendingChangeEffectiveAt: null,
        lastSyncedAt: new Date(),
        sourceOfTruth: reason || 'pending_change_cleared',
      },
    });
  } catch (err) {
    logger.debug('Failed to clear pending change', {
      shopId,
      error: err.message,
    });
  }
};
/**
 * Derive canonical subscription fields from Stripe subscription
 * @param {Object} stripeSubscription - Stripe subscription object
 * @returns {Promise<Object|null>} Canonical fields {planCode, interval, currency, status, currentPeriodEnd, cancelAtPeriodEnd} or null
 */
export async function deriveCanonicalFields(stripeSubscription) {
  if (!stripeSubscription) {
    return null;
  }

  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
  if (!priceId) {
    return null;
  }

  // Use Plan Catalog reverse lookup
  const planCatalog = await import('./plan-catalog.js');
  const resolved = planCatalog.resolvePlanFromPriceId(priceId);

  if (!resolved) {
    logger.warn('Could not resolve plan from Stripe priceId', { priceId });
    return null;
  }

  // Derive currency from Stripe price
  const currency = stripeSubscription.items?.data?.[0]?.price?.currency
    ? String(stripeSubscription.items.data[0].price.currency).toUpperCase()
    : resolved.currency;

  return {
    planCode: resolved.planCode,
    interval: resolved.interval,
    currency: currency || resolved.currency,
    status: stripeSubscription.status,
    currentPeriodStart: stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000)
      : null,
    currentPeriodEnd: stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId: typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id || null,
  };
}

/**
 * Sync DB to match Stripe truth (idempotent)
 * @param {string} shopId - Shop ID
 * @param {Object} canonicalFields - Canonical fields from Stripe
 * @param {string} sourceOfTruth - Source identifier ('stripe_sync', 'webhook', 'mismatch_correction', etc.)
 * @returns {Promise<Object>} Updated shop and subscription records
 */
export async function syncDbToStripe(shopId, canonicalFields, sourceOfTruth = 'stripe_sync') {
  if (!canonicalFields) {
    return null;
  }

  const now = new Date();

  // Update Shop record
  const shopUpdate = await prisma.shop.update({
    where: { id: shopId },
    data: {
      planType: canonicalFields.planCode,
      subscriptionInterval: canonicalFields.interval,
      currency: canonicalFields.currency,
      subscriptionStatus: canonicalFields.status,
      stripeSubscriptionId: canonicalFields.stripeSubscriptionId,
      stripeCustomerId: canonicalFields.stripeCustomerId || undefined,
      currentPeriodStart: canonicalFields.currentPeriodStart,
      currentPeriodEnd: canonicalFields.currentPeriodEnd,
      cancelAtPeriodEnd: canonicalFields.cancelAtPeriodEnd,
    },
  });

  // Update Subscription record if it exists
  try {
    await prisma.subscription.upsert({
      where: { shopId },
      create: {
        shopId,
        planCode: canonicalFields.planCode,
        interval: canonicalFields.interval,
        currency: canonicalFields.currency,
        status: canonicalFields.status,
        stripeSubscriptionId: canonicalFields.stripeSubscriptionId,
        stripeCustomerId: canonicalFields.stripeCustomerId,
        currentPeriodStart: canonicalFields.currentPeriodStart,
        currentPeriodEnd: canonicalFields.currentPeriodEnd,
        cancelAtPeriodEnd: canonicalFields.cancelAtPeriodEnd,
        lastSyncedAt: now,
        sourceOfTruth,
      },
      update: {
        planCode: canonicalFields.planCode,
        interval: canonicalFields.interval,
        currency: canonicalFields.currency,
        status: canonicalFields.status,
        stripeSubscriptionId: canonicalFields.stripeSubscriptionId,
        stripeCustomerId: canonicalFields.stripeCustomerId,
        currentPeriodStart: canonicalFields.currentPeriodStart,
        currentPeriodEnd: canonicalFields.currentPeriodEnd,
        cancelAtPeriodEnd: canonicalFields.cancelAtPeriodEnd,
        lastSyncedAt: now,
        sourceOfTruth,
      },
    });
  } catch (err) {
    // If Subscription table doesn't have these columns yet, just log
    if (err.message?.includes('does not exist')) {
      logger.debug('Subscription table columns not yet migrated', { shopId });
    } else {
      logger.warn('Failed to update Subscription record', {
        shopId,
        error: err.message,
      });
    }
  }

  return shopUpdate;
}

/**
 * Get subscription status with absolute Stripe↔DB transparency
 * Always fetches from Stripe and updates DB if mismatch detected
 * @param {string} shopId - Shop ID
 * @returns {Promise<Object>} Canonical subscription status DTO
 */
export async function getSubscriptionStatusWithStripeSync(shopId) {
  // Read DB first (for cached fields like SMS usage)
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

  // Get Subscription record for pendingChange
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
    if (err.message?.includes('does not exist')) {
      logger.debug('Subscription table columns not yet migrated', { shopId });
    }
  }

  // Build pendingChange object if exists
  let pendingChange = subscriptionRecord?.pendingChangePlanCode
    ? {
      planCode: subscriptionRecord.pendingChangePlanCode,
      interval: subscriptionRecord.pendingChangeInterval || null,
      currency: subscriptionRecord.pendingChangeCurrency || null,
      effectiveAt: subscriptionRecord.pendingChangeEffectiveAt || null,
    }
    : null;
  const dbPendingChange = pendingChange;

  // If no Stripe subscription ID, return DB state
  if (!shop.stripeSubscriptionId || !stripe) {
    const status = subscriptionRecord?.status || shop.subscriptionStatus || SubscriptionStatus.inactive;
    const currentPlanCode = subscriptionRecord?.planCode || shop.planType || null;
    const currentInterval = subscriptionRecord?.interval || shop.subscriptionInterval || null;

    if (pendingChange) {
      const isScheduled = isValidScheduledChange(
        { planCode: currentPlanCode, interval: currentInterval },
        pendingChange,
      );
      const isEffective =
        pendingChange.planCode === currentPlanCode &&
        (!pendingChange.interval || pendingChange.interval === currentInterval);

      if (!isScheduled || isEffective) {
        await clearPendingChange(shopId, isEffective ? 'pending_change_applied' : 'pending_change_invalid');
        pendingChange = null;
      }
    }

    return {
      active: status === SubscriptionStatus.active,
      planType: subscriptionRecord?.planCode || shop.planType,
      planCode: subscriptionRecord?.planCode || shop.planType,
      status,
      stripeCustomerId: shop.stripeCustomerId,
      stripeSubscriptionId: shop.stripeSubscriptionId,
      interval: subscriptionRecord?.interval || shop.subscriptionInterval || null,
      currency: subscriptionRecord?.currency || shop.currency || 'EUR',
      currentPeriodStart: shop.currentPeriodStart,
      currentPeriodEnd: shop.currentPeriodEnd,
      cancelAtPeriodEnd: shop.cancelAtPeriodEnd ?? false,
      includedSmsPerPeriod: shop.includedSmsPerPeriod || 0,
      usedSmsThisPeriod: shop.usedSmsThisPeriod || 0,
      remainingSmsThisPeriod: Math.max(
        0,
        (status === SubscriptionStatus.active ? shop.includedSmsPerPeriod || 0 : 0) - (shop.usedSmsThisPeriod || 0),
      ),
      pendingChange,
      lastSyncedAt: subscriptionRecord?.lastSyncedAt || null,
      sourceOfTruth: subscriptionRecord?.sourceOfTruth || 'db_only',
      derivedFrom: 'db_only',
      mismatchDetected: false,
    };
  }

  // Fetch from Stripe (source of truth)
  const stripeSubscription = await fetchStripeSubscription(shop.stripeSubscriptionId);
  if (!stripeSubscription) {
    // Stripe fetch failed, return DB state
    const status = subscriptionRecord?.status || shop.subscriptionStatus || SubscriptionStatus.inactive;
    const currentPlanCode = subscriptionRecord?.planCode || shop.planType || null;
    const currentInterval = subscriptionRecord?.interval || shop.subscriptionInterval || null;

    if (pendingChange) {
      const isScheduled = isValidScheduledChange(
        { planCode: currentPlanCode, interval: currentInterval },
        pendingChange,
      );
      const isEffective =
        pendingChange.planCode === currentPlanCode &&
        (!pendingChange.interval || pendingChange.interval === currentInterval);

      if (!isScheduled || isEffective) {
        await clearPendingChange(shopId, isEffective ? 'pending_change_applied' : 'pending_change_invalid');
        pendingChange = null;
      }
    }

    return {
      active: status === SubscriptionStatus.active,
      planType: subscriptionRecord?.planCode || shop.planType,
      planCode: subscriptionRecord?.planCode || shop.planType,
      status,
      stripeCustomerId: shop.stripeCustomerId,
      stripeSubscriptionId: shop.stripeSubscriptionId,
      interval: subscriptionRecord?.interval || shop.subscriptionInterval || null,
      currency: subscriptionRecord?.currency || shop.currency || 'EUR',
      currentPeriodStart: shop.currentPeriodStart,
      currentPeriodEnd: shop.currentPeriodEnd,
      cancelAtPeriodEnd: shop.cancelAtPeriodEnd ?? false,
      includedSmsPerPeriod: shop.includedSmsPerPeriod || 0,
      usedSmsThisPeriod: shop.usedSmsThisPeriod || 0,
      remainingSmsThisPeriod: Math.max(
        0,
        (status === SubscriptionStatus.active ? shop.includedSmsPerPeriod || 0 : 0) - (shop.usedSmsThisPeriod || 0),
      ),
      pendingChange,
      lastSyncedAt: subscriptionRecord?.lastSyncedAt || null,
      sourceOfTruth: subscriptionRecord?.sourceOfTruth || 'db_fallback',
      derivedFrom: 'db_fallback',
      mismatchDetected: false,
    };
  }

  // Derive canonical fields from Stripe
  const canonicalFields = await deriveCanonicalFields(stripeSubscription);
  if (!canonicalFields) {
    const stripePriceId = stripeSubscription.items?.data?.[0]?.price?.id || null;
    // Could not derive, return DB state
    const status = subscriptionRecord?.status || shop.subscriptionStatus || SubscriptionStatus.inactive;
    const currentPlanCode = subscriptionRecord?.planCode || shop.planType || null;
    const currentInterval = subscriptionRecord?.interval || shop.subscriptionInterval || null;

    if (pendingChange) {
      const isScheduled = isValidScheduledChange(
        { planCode: currentPlanCode, interval: currentInterval },
        pendingChange,
      );
      const isEffective =
        pendingChange.planCode === currentPlanCode &&
        (!pendingChange.interval || pendingChange.interval === currentInterval);

      if (!isScheduled || isEffective) {
        await clearPendingChange(shopId, isEffective ? 'pending_change_applied' : 'pending_change_invalid');
        pendingChange = null;
      }
    }

    return {
      active: status === SubscriptionStatus.active,
      planType: subscriptionRecord?.planCode || shop.planType,
      planCode: subscriptionRecord?.planCode || shop.planType,
      status,
      stripeCustomerId: shop.stripeCustomerId,
      stripeSubscriptionId: shop.stripeSubscriptionId,
      interval: subscriptionRecord?.interval || shop.subscriptionInterval || null,
      currency: subscriptionRecord?.currency || shop.currency || 'EUR',
      currentPeriodStart: shop.currentPeriodStart,
      currentPeriodEnd: shop.currentPeriodEnd,
      cancelAtPeriodEnd: shop.cancelAtPeriodEnd ?? false,
      includedSmsPerPeriod: shop.includedSmsPerPeriod || 0,
      usedSmsThisPeriod: shop.usedSmsThisPeriod || 0,
      remainingSmsThisPeriod: Math.max(
        0,
        (status === SubscriptionStatus.active ? shop.includedSmsPerPeriod || 0 : 0) - (shop.usedSmsThisPeriod || 0),
      ),
      pendingChange,
      lastSyncedAt: subscriptionRecord?.lastSyncedAt || null,
      sourceOfTruth: subscriptionRecord?.sourceOfTruth || 'db_fallback',
      derivedFrom: 'db_fallback',
      mismatchDetected: false,
      catalogResolution: {
        ok: false,
        reason: 'unmapped_stripe_price',
        stripePriceId,
      },
    };
  }

  // Check for mismatch
  const dbPlanCode = subscriptionRecord?.planCode || shop.planType;
  const dbInterval = subscriptionRecord?.interval || shop.subscriptionInterval;
  const dbCurrency = subscriptionRecord?.currency || shop.currency;
  const dbStatus = subscriptionRecord?.status || shop.subscriptionStatus;

  const mismatchDetected = (
    canonicalFields.planCode !== dbPlanCode ||
    canonicalFields.interval !== dbInterval ||
    canonicalFields.currency !== dbCurrency ||
    canonicalFields.status !== dbStatus ||
    canonicalFields.cancelAtPeriodEnd !== (shop.cancelAtPeriodEnd ?? false)
  );

  // If mismatch, update DB immediately
  if (mismatchDetected) {
    logger.warn('Subscription mismatch detected, syncing DB to Stripe', {
      shopId,
      db: { planCode: dbPlanCode, interval: dbInterval, currency: dbCurrency, status: dbStatus },
      stripe: canonicalFields,
    });

    await syncDbToStripe(shopId, canonicalFields, 'mismatch_correction');
  } else {
    // Even if no mismatch, update lastSyncedAt to show we verified
    try {
      await prisma.subscription.updateMany({
        where: { shopId },
        data: {
          lastSyncedAt: new Date(),
          sourceOfTruth: 'stripe_verified',
        },
      });
    } catch (err) {
      // Ignore if columns don't exist
    }
  }

  const currentPlanCode = canonicalFields.planCode;
  const currentInterval = canonicalFields.interval;
  const pendingFromStripe = await derivePendingChangeFromStripeSchedule(stripeSubscription);

  if (pendingFromStripe) {
    const validScheduled = isValidScheduledChange(
      { planCode: currentPlanCode, interval: currentInterval },
      pendingFromStripe,
    );

    if (!validScheduled) {
      logger.warn('Invalid scheduled change detected from Stripe schedule', {
        shopId,
        currentPlanCode,
        currentInterval,
        pendingFromStripe,
      });
      await clearPendingChange(shopId, 'pending_change_invalid');
      pendingChange = null;
    } else {
      pendingChange = pendingFromStripe;
      const pendingEffectiveAt = pendingFromStripe.effectiveAt
        ? new Date(pendingFromStripe.effectiveAt).toISOString()
        : null;
      const dbEffectiveAt = dbPendingChange?.effectiveAt
        ? new Date(dbPendingChange.effectiveAt).toISOString()
        : null;
      const pendingDiffers =
        !dbPendingChange ||
        dbPendingChange.planCode !== pendingFromStripe.planCode ||
        dbPendingChange.interval !== pendingFromStripe.interval ||
        dbPendingChange.currency !== pendingFromStripe.currency ||
        dbEffectiveAt !== pendingEffectiveAt;

      if (pendingDiffers) {
        try {
          await prisma.subscription.updateMany({
            where: { shopId },
            data: {
              pendingChangePlanCode: pendingFromStripe.planCode,
              pendingChangeInterval: pendingFromStripe.interval,
              pendingChangeCurrency: pendingFromStripe.currency,
              pendingChangeEffectiveAt: pendingFromStripe.effectiveAt,
              lastSyncedAt: new Date(),
              sourceOfTruth: 'stripe_schedule',
            },
          });
        } catch (err) {
          logger.debug('Failed to sync pending change from Stripe schedule', {
            shopId,
            error: err.message,
          });
        }
      }
    }
  } else if (pendingChange) {
    const isScheduled = isValidScheduledChange(
      { planCode: currentPlanCode, interval: currentInterval },
      pendingChange,
    );
    const isEffective =
      pendingChange.planCode === currentPlanCode &&
      (!pendingChange.interval || pendingChange.interval === currentInterval);

    if (!isScheduled || isEffective) {
      await clearPendingChange(shopId, isEffective ? 'pending_change_applied' : 'pending_change_invalid');
      pendingChange = null;
    }
  }

  // Return canonical DTO (always from Stripe truth)
  const status = canonicalFields.status;
  const isActive = status === SubscriptionStatus.active;

  return {
    active: isActive,
    planType: canonicalFields.planCode,
    planCode: canonicalFields.planCode,
    status,
    stripeCustomerId: canonicalFields.stripeCustomerId || shop.stripeCustomerId,
    stripeSubscriptionId: canonicalFields.stripeSubscriptionId,
    lastFreeCreditsAllocatedAt: shop.lastFreeCreditsAllocatedAt,
    billingCurrency: canonicalFields.currency,
    currency: canonicalFields.currency,
    interval: canonicalFields.interval,
    currentPeriodStart: canonicalFields.currentPeriodStart,
    currentPeriodEnd: canonicalFields.currentPeriodEnd,
    cancelAtPeriodEnd: canonicalFields.cancelAtPeriodEnd,
    includedSmsPerPeriod: shop.includedSmsPerPeriod || 0,
    usedSmsThisPeriod: shop.usedSmsThisPeriod || 0,
    remainingSmsThisPeriod: Math.max(
      0,
      (isActive ? shop.includedSmsPerPeriod || 0 : 0) - (shop.usedSmsThisPeriod || 0),
    ),
    lastBillingError: shop.lastBillingError || null,
    pendingChange,
    lastSyncedAt: new Date(),
    sourceOfTruth: mismatchDetected ? 'mismatch_correction' : 'stripe_verified',
    derivedFrom: 'stripe_priceId',
    mismatchDetected,
    // Truth table debugger (dev only)
    _debug: process.env.NODE_ENV === 'development' ? {
      stripeDerived: {
        priceId: stripeSubscription.items?.data?.[0]?.price?.id || null,
        interval: canonicalFields.interval,
        currency: canonicalFields.currency,
        status: canonicalFields.status,
        currentPeriodEnd: canonicalFields.currentPeriodEnd?.toISOString() || null,
        cancelAtPeriodEnd: canonicalFields.cancelAtPeriodEnd,
      },
      dbStored: {
        planCode: dbPlanCode,
        interval: dbInterval,
        currency: dbCurrency,
        status: dbStatus,
        lastSyncedAt: subscriptionRecord?.lastSyncedAt?.toISOString() || null,
      },
      dtoReturned: {
        planCode: canonicalFields.planCode,
        interval: canonicalFields.interval,
        currency: canonicalFields.currency,
        status: canonicalFields.status,
        pendingChange: pendingChange || null,
      },
    } : undefined,
  };
}
