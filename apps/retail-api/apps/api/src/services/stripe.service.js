// apps/api/src/services/stripe.service.js
const Stripe = require('stripe');
const pino = require('pino');
const {
  getCreditTopupPriceId,
  getSubscriptionPriceId,
  getPackagePriceId,
} = require('../billing/stripePrices');

const logger = pino({ name: 'stripe-service' });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  logger.warn('STRIPE_SECRET_KEY not set, Stripe features disabled');
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
}) : null;

/**
 * Get Stripe price ID for a package and currency
 * Priority: Package DB field -> Environment variable -> null
 *
 * @param {string} packageName - Package name
 * @param {string} currency - Currency code (EUR, USD, etc.)
 * @param {Object} packageDb - Optional package object from DB with stripePriceIdEur/stripePriceIdUsd
 * @returns {string|null} Stripe price ID or null
 */
function getStripePriceId(packageName, currency = 'EUR', packageDb = null) {
  return getPackagePriceId(packageName, currency, packageDb);
}

/**
 * Get Stripe subscription price ID for a plan
 * @param {string} planType - 'starter' or 'pro'
 * @param {string} currency - Currency code (EUR, USD, etc.)
 * @returns {string|null} Stripe price ID or null
 */
function getStripeSubscriptionPriceId(planType, currency = 'EUR') {
  return getSubscriptionPriceId(planType, currency);
}

/**
 * Get Stripe credit top-up price ID
 * @param {string} currency - Currency code (EUR, USD, etc.)
 * @returns {string|null} Stripe price ID or null
 */
function getStripeCreditTopupPriceId(currency = 'EUR') {
  return getCreditTopupPriceId(currency);
}

/**
 * Create a Stripe checkout session for a package purchase
 * @param {Object} params
 * @param {number} params.ownerId - User/Store ID
 * @param {string} params.userEmail - User email
 * @param {Object} params.package - Package object
 * @param {string} params.currency - Currency code (EUR, USD, etc.)
 * @param {string} params.successUrl - Success redirect URL
 * @param {string} params.cancelUrl - Cancel redirect URL
 * @param {string} [params.idempotencyKey] - Idempotency key for Stripe session creation
 * @param {string} [params.priceId] - Explicit Stripe price ID (optional)
 * @returns {Promise<Object>} Stripe checkout session
 */
async function createCheckoutSession({
  ownerId,
  userEmail,
  package: pkg,
  currency = 'EUR',
  successUrl,
  cancelUrl,
  idempotencyKey,
  priceId,
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  // Check DB fields first, then environment variables
  const resolvedPriceId = priceId || getStripePriceId(pkg.name, currency, pkg);
  if (!resolvedPriceId) {
    throw new Error(`Stripe price ID not found for package ${pkg.name} (${currency})`);
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: resolvedPriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ownerId: String(ownerId),
        packageId: String(pkg.id),
        packageName: pkg.name,
        units: String(pkg.units),
        currency: currency.toUpperCase(),
      },
      // Allow customer to enter email if not provided
      customer_email: userEmail || undefined,
      // Store ownerId in client_reference_id for easy lookup
      client_reference_id: `owner_${ownerId}`,
      // Expand line items to get price details in response
      expand: ['line_items'],
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );

  return session;
}

/**
 * Retrieve a Stripe checkout session
 */
async function getCheckoutSession(sessionId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Retrieve a Stripe payment intent
 */
async function getPaymentIntent(paymentIntentId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Create a Stripe checkout session for subscription
 * @param {Object} params
 * @param {number} params.ownerId - User/Store ID
 * @param {string} params.userEmail - User email
 * @param {string} params.planType - 'starter' or 'pro'
 * @param {string} params.currency - Currency code (EUR, USD, etc.)
 * @param {string} params.successUrl - Success redirect URL
 * @param {string} params.cancelUrl - Cancel redirect URL
 * @returns {Promise<Object>} Stripe checkout session
 */
async function createSubscriptionCheckoutSession({
  ownerId,
  userEmail,
  planType,
  currency = 'EUR',
  successUrl,
  cancelUrl,
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (!['starter', 'pro'].includes(planType)) {
    throw new Error(`Invalid plan type: ${planType}`);
  }

  const priceId = getStripeSubscriptionPriceId(planType, currency);

  // Verify the price exists and is a recurring price
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (price.type !== 'recurring') {
      throw new Error(`Price ID ${priceId} is not a recurring price. Subscription plans require recurring prices.`);
    }
    if (!price.recurring) {
      throw new Error(`Price ID ${priceId} does not have recurring configuration.`);
    }
  } catch (err) {
    if (err.type === 'StripeInvalidRequestError' && err.code === 'resource_missing') {
      throw new Error(`Price ID ${priceId} not found in Stripe. Please verify the price ID is correct.`);
    }
    // Re-throw if it's our custom error
    if (err.message?.includes('not a recurring price') || err.message?.includes('does not have recurring')) {
      throw err;
    }
    // For other errors, log but continue (price might still be valid)
    logger.warn({ priceId, err: err.message }, 'Could not verify price type, continuing anyway');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ownerId: String(ownerId),
        planType,
        type: 'subscription',
        currency: currency.toUpperCase(),
      },
      customer_email: userEmail || undefined,
      client_reference_id: `owner_${ownerId}`,
      subscription_data: {
        metadata: {
          ownerId: String(ownerId),
          planType,
          currency: currency.toUpperCase(),
        },
      },
      expand: ['line_items', 'subscription'],
    });

    return session;
  } catch (err) {
    // Handle Stripe-specific errors
    if (err.type === 'StripeInvalidRequestError') {
      if (err.message?.includes('recurring price')) {
        throw new Error(`The price ID ${priceId} is not configured as a recurring price in Stripe. Please create a recurring price for the ${planType} plan.`);
      }
      throw new Error(`Stripe error: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Create a Stripe checkout session for credit top-up
 * @param {Object} params
 * @param {number} params.ownerId - User/Store ID
 * @param {string} params.userEmail - User email
 * @param {number} params.credits - Number of credits to purchase
 * @param {number} params.priceAmount - Price in currency (including VAT/tax if applicable)
 * @param {string} params.currency - Currency code (EUR, USD, etc.)
 * @param {string} params.successUrl - Success redirect URL
 * @param {string} params.cancelUrl - Cancel redirect URL
 * @returns {Promise<Object>} Stripe checkout session
 */
async function createCreditTopupCheckoutSession({
  ownerId,
  userEmail,
  credits,
  priceAmount,
  currency = 'EUR',
  successUrl,
  cancelUrl,
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const normalizedPriceAmount = Number(priceAmount);
  if (!Number.isFinite(normalizedPriceAmount) || normalizedPriceAmount <= 0) {
    throw new Error('Invalid price amount for credit top-up');
  }

  const priceId = getStripeCreditTopupPriceId(currency);
  const price = await stripe.prices.retrieve(priceId);
  if (price.type !== 'one_time') {
    throw new Error(`Credit top-up price ID ${priceId} is not a one-time price.`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: credits, // Price is per-credit, so quantity = number of credits
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ownerId: String(ownerId),
      credits: String(credits),
      priceAmount: String(normalizedPriceAmount),
      currency: currency.toUpperCase(),
      type: 'credit_topup',
    },
    customer_email: userEmail || undefined,
    client_reference_id: `owner_${ownerId}_topup_${credits}`,
    expand: ['line_items'],
  });

  return session;
}

/**
 * Get Stripe customer portal URL
 * @param {string} customerId - Stripe customer ID
 * @param {string} returnUrl - URL to return to after portal session
 * @returns {Promise<string>} Portal URL
 */
async function getCustomerPortalUrl(customerId, returnUrl) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Cancel a Stripe subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Cancelled subscription
 */
/**
 * Update subscription to a new plan
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {string} newPlanType - 'starter' or 'pro'
 * @returns {Promise<Object>} Updated subscription
 */
async function updateSubscription(subscriptionId, newPlanType, currency = 'EUR') {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (!['starter', 'pro'].includes(newPlanType)) {
    throw new Error(`Invalid plan type: ${newPlanType}`);
  }

  // Get subscription price ID for the new plan
  const newPriceId = getStripeSubscriptionPriceId(newPlanType, currency);

  // Retrieve current subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update subscription with new price
  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: newPriceId,
    }],
    proration_behavior: 'always_invoice', // Prorate the change
    metadata: {
      planType: newPlanType,
      currency: String(currency).toUpperCase(),
      updatedAt: new Date().toISOString(),
    },
  });

  logger.info({ subscriptionId, newPlanType, newPriceId }, 'Subscription updated');
  return updated;
}

async function cancelSubscription(subscriptionId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Verify Stripe webhook signature
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }
}

module.exports = {
  stripe,
  createCheckoutSession,
  createSubscriptionCheckoutSession,
  createCreditTopupCheckoutSession,
  getCheckoutSession,
  getPaymentIntent,
  getCustomerPortalUrl,
  updateSubscription,
  cancelSubscription,
  verifyWebhookSignature,
  getStripePriceId,
  getStripeSubscriptionPriceId,
  getStripeCreditTopupPriceId,
};
