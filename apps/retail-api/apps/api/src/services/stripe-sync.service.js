// apps/api/src/services/stripe-sync.service.js
// Retail StripeSyncService-style transparency (Shopify parity):
// - Stripe is truth for subscription state and billing periods
// - DB is a mirror/cache for operational logic and UI

const prisma = require('../lib/prisma');
const { stripe } = require('./stripe.service');
const planCatalog = require('./plan-catalog.service');

const normalizeStripeStatus = (status) => {
  if (!status) {
    return 'inactive';
  }
  const s = String(status).toLowerCase();
  if (s === 'active') {
    return 'active';
  }
  if (s === 'trialing') {
    return 'trialing';
  }
  if (s === 'past_due') {
    return 'past_due';
  }
  if (s === 'unpaid') {
    return 'unpaid';
  }
  if (s === 'incomplete') {
    return 'incomplete';
  }
  if (s === 'incomplete_expired') {
    return 'incomplete_expired';
  }
  if (s === 'paused') {
    return 'paused';
  }
  if (s === 'canceled' || s === 'cancelled') {
    return 'cancelled';
  }
  return 'inactive';
};

const toDate = (seconds) => (seconds ? new Date(seconds * 1000) : null);

function derivePendingChangeFromStripeSchedule(stripeSubscription) {
  const schedule = stripeSubscription?.schedule || null;
  const phases = schedule?.phases;
  if (!schedule || !Array.isArray(phases) || phases.length < 2) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const nextPhase = phases.find((p) => p?.start_date && p.start_date > now);
  if (!nextPhase || !Array.isArray(nextPhase.items) || nextPhase.items.length === 0) {
    return null;
  }

  const nextPrice = nextPhase.items[0]?.price || null;
  const nextPriceId = typeof nextPrice === 'string' ? nextPrice : nextPrice?.id;
  if (!nextPriceId) {
    return null;
  }

  const resolved = planCatalog.resolvePlanFromPriceId(nextPriceId);
  if (!resolved) {
    return null;
  }

  return {
    planCode: resolved.planCode,
    interval: resolved.interval,
    currency: resolved.currency,
    effectiveAt: nextPhase.start_date ? new Date(nextPhase.start_date * 1000) : null,
  };
}

function deriveCanonicalFromStripeSubscription(stripeSubscription) {
  const priceId = stripeSubscription?.items?.data?.[0]?.price?.id || null;
  const recurringInterval = stripeSubscription?.items?.data?.[0]?.price?.recurring?.interval || null;
  const priceCurrency = stripeSubscription?.items?.data?.[0]?.price?.currency
    ? String(stripeSubscription.items.data[0].price.currency).toUpperCase()
    : null;

  const resolved = priceId ? planCatalog.resolvePlanFromPriceId(priceId) : null;
  const metadataPlanType = stripeSubscription?.metadata?.planType || null;

  return {
    planCode: resolved?.planCode || (metadataPlanType ? String(metadataPlanType).toLowerCase() : null),
    interval: resolved?.interval || (recurringInterval ? String(recurringInterval).toLowerCase() : null),
    currency: resolved?.currency || priceCurrency || null,
    status: normalizeStripeStatus(stripeSubscription?.status),
    currentPeriodStart: toDate(stripeSubscription?.current_period_start),
    currentPeriodEnd: toDate(stripeSubscription?.current_period_end),
    cancelAtPeriodEnd: Boolean(stripeSubscription?.cancel_at_period_end),
    stripeSubscriptionId: stripeSubscription?.id || null,
    stripeCustomerId:
      typeof stripeSubscription?.customer === 'string'
        ? stripeSubscription.customer
        : stripeSubscription?.customer?.id || null,
    trialEndsAt: toDate(stripeSubscription?.trial_end),
    metadata: stripeSubscription?.metadata || null,
  };
}

async function syncDbToStripe(ownerId, canonical, pendingChange, sourceOfTruth = 'stripe_sync') {
  const now = new Date();

  // Update User mirror (operational fields live here).
  // NOTE: We do NOT reset allowance usage here. That is handled by invoice/webhook flows.
  await prisma.user.update({
    where: { id: ownerId },
    data: {
      stripeCustomerId: canonical.stripeCustomerId || undefined,
      stripeSubscriptionId: canonical.stripeSubscriptionId || undefined,
      planType: canonical.planCode || null,
      subscriptionStatus: canonical.status || 'inactive',
      billingCurrency: canonical.currency || undefined,
      subscriptionInterval: canonical.interval || null,
      subscriptionCurrentPeriodStart: canonical.currentPeriodStart,
      subscriptionCurrentPeriodEnd: canonical.currentPeriodEnd,
      cancelAtPeriodEnd: canonical.cancelAtPeriodEnd,
      // Clear lastBillingError on healthy states
      lastBillingError:
        canonical.status === 'active' || canonical.status === 'trialing'
          ? null
          : undefined,
    },
  });

  // Upsert Subscription mirror (transparency + pending change)
  await prisma.subscription.upsert({
    where: { ownerId },
    create: {
      ownerId,
      provider: 'stripe',
      stripeCustomerId: canonical.stripeCustomerId || null,
      stripeSubscriptionId: canonical.stripeSubscriptionId || null,
      planCode: canonical.planCode || null,
      status: canonical.status || null,
      currency: canonical.currency || null,
      currentPeriodStart: canonical.currentPeriodStart,
      currentPeriodEnd: canonical.currentPeriodEnd,
      cancelAtPeriodEnd: canonical.cancelAtPeriodEnd,
      trialEndsAt: canonical.trialEndsAt,
      pendingChangePlanCode: pendingChange?.planCode || null,
      pendingChangeInterval: pendingChange?.interval || null,
      pendingChangeCurrency: pendingChange?.currency || null,
      pendingChangeEffectiveAt: pendingChange?.effectiveAt || null,
      lastSyncedAt: now,
      sourceOfTruth,
      metadata: canonical.metadata || undefined,
    },
    update: {
      stripeCustomerId: canonical.stripeCustomerId || null,
      stripeSubscriptionId: canonical.stripeSubscriptionId || null,
      planCode: canonical.planCode || null,
      status: canonical.status || null,
      currency: canonical.currency || null,
      currentPeriodStart: canonical.currentPeriodStart,
      currentPeriodEnd: canonical.currentPeriodEnd,
      cancelAtPeriodEnd: canonical.cancelAtPeriodEnd,
      trialEndsAt: canonical.trialEndsAt,
      pendingChangePlanCode: pendingChange?.planCode || null,
      pendingChangeInterval: pendingChange?.interval || null,
      pendingChangeCurrency: pendingChange?.currency || null,
      pendingChangeEffectiveAt: pendingChange?.effectiveAt || null,
      lastSyncedAt: now,
      sourceOfTruth,
      metadata: canonical.metadata || undefined,
    },
  });

  return now;
}

async function buildSubscriptionDto(ownerId, extra = {}) {
  const [user, sub] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        planType: true,
        subscriptionStatus: true,
        billingCurrency: true,
        subscriptionInterval: true,
        subscriptionCurrentPeriodStart: true,
        subscriptionCurrentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        includedSmsPerPeriod: true,
        usedSmsThisPeriod: true,
        lastBillingError: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { ownerId },
      select: {
        pendingChangePlanCode: true,
        pendingChangeInterval: true,
        pendingChangeCurrency: true,
        pendingChangeEffectiveAt: true,
        lastSyncedAt: true,
        sourceOfTruth: true,
      },
    }).catch(() => null),
  ]);

  if (!user) {
    return {
      active: false,
      planType: null,
      planCode: null,
      status: 'inactive',
      interval: null,
      billingCurrency: 'EUR',
      pendingChange: null,
      ...extra,
    };
  }

  const status = user.subscriptionStatus || 'inactive';
  const active = status === 'active' || status === 'trialing';
  const included = active ? user.includedSmsPerPeriod || 0 : 0;
  const used = active ? user.usedSmsThisPeriod || 0 : 0;

  const pendingChange = sub?.pendingChangePlanCode
    ? {
      planCode: sub.pendingChangePlanCode,
      interval: sub.pendingChangeInterval || null,
      currency: sub.pendingChangeCurrency || null,
      effectiveAt: sub.pendingChangeEffectiveAt || null,
    }
    : null;

  return {
    active,
    planType: user.planType || null, // legacy name (Retail UI)
    planCode: user.planType || null, // parity alias (Shopify)
    status,
    stripeCustomerId: user.stripeCustomerId || null,
    stripeSubscriptionId: user.stripeSubscriptionId || null,
    billingCurrency: user.billingCurrency || 'EUR',
    interval: user.subscriptionInterval || null,
    currentPeriodStart: user.subscriptionCurrentPeriodStart || null,
    currentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(user.cancelAtPeriodEnd),
    includedSmsPerPeriod: included,
    usedSmsThisPeriod: used,
    remainingSmsThisPeriod: Math.max(0, included - used),
    lastBillingError: user.lastBillingError || null,
    pendingChange,
    lastSyncedAt: sub?.lastSyncedAt || null,
    sourceOfTruth: sub?.sourceOfTruth || extra?.sourceOfTruth || null,
    ...extra,
  };
}

/**
 * Get subscription status with Stripe truth (best-effort).
 * - Reads DB snapshot
 * - If Stripe subscription ID exists, fetch Stripe + derive canonical fields
 * - Sync DB if mismatch (or always update lastSyncedAt)
 */
async function getSubscriptionStatusWithStripeSync(ownerId) {
  const before = await buildSubscriptionDto(ownerId, { derivedFrom: 'db_snapshot', mismatchDetected: false });

  if (!stripe || !before?.stripeSubscriptionId) {
    return {
      ...before,
      derivedFrom: stripe ? 'db_only' : 'stripe_not_configured',
      mismatchDetected: false,
      sourceOfTruth: stripe ? 'db' : 'stripe_disabled',
    };
  }

  let stripeSubscription = null;
  try {
    stripeSubscription = await stripe.subscriptions.retrieve(before.stripeSubscriptionId, {
      expand: ['items.data.price', 'customer', 'schedule'],
    });
  } catch (err) {
    const msg = err?.message || String(err);
    const isNotFound = msg.toLowerCase().includes('no such subscription') || err?.statusCode === 404;

    if (isNotFound) {
      // Clear phantom actives safely.
      await prisma.user.update({
        where: { id: ownerId },
        data: {
          stripeSubscriptionId: null,
          planType: null,
          subscriptionStatus: 'inactive',
          subscriptionInterval: null,
          subscriptionCurrentPeriodStart: null,
          subscriptionCurrentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          includedSmsPerPeriod: 0,
          usedSmsThisPeriod: 0,
          lastBillingError: 'stripe_subscription_not_found',
        },
      });

      await prisma.subscription.updateMany({
        where: { ownerId },
        data: {
          status: 'cancelled',
          cancelAtPeriodEnd: false,
          pendingChangePlanCode: null,
          pendingChangeInterval: null,
          pendingChangeCurrency: null,
          pendingChangeEffectiveAt: null,
          lastSyncedAt: new Date(),
          sourceOfTruth: 'stripe_not_found',
        },
      }).catch(() => {});

      return buildSubscriptionDto(ownerId, {
        derivedFrom: 'stripe_not_found_db_cleared',
        mismatchDetected: true,
        sourceOfTruth: 'stripe',
      });
    }

    return {
      ...before,
      derivedFrom: 'stripe_sync_error',
      mismatchDetected: false,
      stripeSyncError: msg,
      sourceOfTruth: 'stripe',
    };
  }

  const canonical = deriveCanonicalFromStripeSubscription(stripeSubscription);
  const pendingChange = derivePendingChangeFromStripeSchedule(stripeSubscription);

  // Detect mismatch vs current DB snapshot.
  const mismatchDetected =
    (before?.status || null) !== (canonical.status || null) ||
    (before?.planCode || null) !== (canonical.planCode || null) ||
    (before?.interval || null) !== (canonical.interval || null) ||
    String(before?.cancelAtPeriodEnd || false) !== String(canonical.cancelAtPeriodEnd || false) ||
    (before?.currentPeriodEnd?.getTime?.() !== canonical.currentPeriodEnd?.getTime?.());

  const lastSyncedAt = await syncDbToStripe(
    ownerId,
    canonical,
    pendingChange,
    mismatchDetected ? 'mismatch_correction' : 'stripe_verified',
  );

  return buildSubscriptionDto(ownerId, {
    derivedFrom: 'stripe_verified',
    mismatchDetected,
    sourceOfTruth: 'stripe',
    lastSyncedAt,
  });
}

/**
 * Ensure Stripe customer/subscription IDs can be resolved for billing artifacts.
 * This is a thin helper for invoice fallback/backfill.
 */
async function resolveStripeCustomerId(ownerId) {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { stripeCustomerId: true, stripeSubscriptionId: true },
  });

  if (!user) {
    return null;
  }
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }
  if (!stripe || !user.stripeSubscriptionId) {
    return null;
  }

  try {
    const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null;
    if (customerId) {
      await prisma.user.update({
        where: { id: ownerId },
        data: { stripeCustomerId: customerId },
      });
    }
    return customerId;
  } catch {
    return null;
  }
}

module.exports = {
  getSubscriptionStatusWithStripeSync,
  resolveStripeCustomerId,
  // Expose for routes that want to attach allowedActions/options
  buildSubscriptionDto,
};

