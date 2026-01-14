// apps/api/src/services/stripe-sync.service.js
// Retail StripeSyncService-style transparency: Stripe is truth, DB is a mirror/cache.

const prisma = require('../lib/prisma');
const { stripe } = require('./stripe.service');
const { getSubscriptionStatus, reconcileSubscriptionFromStripe } = require('./subscription.service');

/**
 * Get subscription status with Stripe truth (best-effort).
 * - Reads DB snapshot
 * - If Stripe subscription ID exists, reconciles from Stripe and returns updated snapshot.
 *
 * @param {number} ownerId
 * @returns {Promise<object>}
 */
async function getSubscriptionStatusWithStripeSync(ownerId) {
  const before = await getSubscriptionStatus(ownerId);

  // If Stripe is not configured or there is no subscription ID, return DB snapshot.
  if (!stripe || !before?.stripeSubscriptionId) {
    return {
      ...before,
      derivedFrom: stripe ? 'db_only' : 'stripe_not_configured',
      mismatchDetected: false,
    };
  }

  try {
    const result = await reconcileSubscriptionFromStripe(ownerId);
    const after = await getSubscriptionStatus(ownerId);

    // Mismatch detection is approximate: compare key canonical fields we expect to mirror.
    const mismatchDetected =
      (before?.status || null) !== (after?.status || null) ||
      (before?.planType || null) !== (after?.planType || null) ||
      (before?.interval || null) !== (after?.interval || null) ||
      String(before?.cancelAtPeriodEnd || false) !== String(after?.cancelAtPeriodEnd || false);

    return {
      ...after,
      derivedFrom: result?.reconciled ? 'stripe_verified' : 'stripe_noop',
      mismatchDetected,
    };
  } catch (err) {
    return {
      ...before,
      derivedFrom: 'stripe_sync_error',
      mismatchDetected: false,
      stripeSyncError: err?.message || String(err),
    };
  }
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
};


