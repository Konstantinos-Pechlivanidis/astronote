// apps/api/src/services/stripe.service.js
const Stripe = require('stripe');
const pino = require('pino');
const prisma = require('../lib/prisma');
const {
  getCreditTopupPriceId,
  getSubscriptionPriceId,
  getPackagePriceId,
} = require('../billing/stripePrices');
const planCatalog = require('./plan-catalog.service');
const { resolveTaxTreatment } = require('./tax-resolver.service');

const logger = pino({ name: 'stripe-service' });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  logger.warn('STRIPE_SECRET_KEY not set, Stripe features disabled');
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
}) : null;

const isStripeTaxEnabled = () =>
  String(process.env.STRIPE_TAX_ENABLED || 'true').toLowerCase() !== 'false';

const isValidStripeCustomerId = (value) =>
  typeof value === 'string' && value.startsWith('cus_');

const normalizeStripeAddress = (address) => {
  if (!address) {return null;}
  return {
    line1: address.line1 || null,
    line2: address.line2 || null,
    city: address.city || null,
    state: address.state || null,
    postal_code: address.postalCode || address.postal_code || null,
    country: address.country ? String(address.country).toUpperCase() : null,
  };
};

const deriveTaxSettingsFromProfile = (billingProfile) => {
  if (!billingProfile) {
    return { taxExempt: undefined, treatment: null };
  }

  const treatment = resolveTaxTreatment({
    billingCountry: billingProfile.billingAddress?.country || billingProfile.vatCountry || null,
    vatId: billingProfile.vatNumber || null,
    vatIdValidated: billingProfile.taxStatus === 'verified',
    isBusiness: typeof billingProfile.isBusiness === 'boolean'
      ? billingProfile.isBusiness
      : billingProfile.vatNumber
        ? true
        : null,
  });

  const taxExempt =
    treatment.mode === 'eu_reverse_charge'
      ? 'reverse'
      : billingProfile.taxExempt
        ? 'exempt'
        : 'none';

  return { taxExempt, treatment };
};

async function ensureStripeCustomer({
  ownerId,
  userEmail,
  userName,
  currency,
  stripeCustomerId,
  billingProfile,
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (isValidStripeCustomerId(stripeCustomerId)) {
    if (billingProfile) {
      try {
        await syncStripeCustomerBillingProfile({ stripeCustomerId, billingProfile });
      } catch (err) {
        logger.warn({ stripeCustomerId, err: err.message }, 'Failed to sync Stripe customer before reuse');
      }
    }
    return stripeCustomerId;
  }

  const address = normalizeStripeAddress(billingProfile?.billingAddress);
  const email = billingProfile?.billingEmail || userEmail || undefined;
  const name = billingProfile?.legalName || userName || undefined;
  const { taxExempt } = deriveTaxSettingsFromProfile(billingProfile);

  const customer = await stripe.customers.create({
    email,
    name,
    address: address || undefined,
    tax_exempt: taxExempt || undefined,
    metadata: {
      ownerId: String(ownerId),
      billingCurrency: currency || 'EUR',
      isBusiness: billingProfile?.isBusiness ? 'true' : 'false',
    },
  });

  if (billingProfile?.vatNumber) {
    try {
      await stripe.customers.createTaxId(customer.id, {
        type: 'eu_vat',
        value: billingProfile.vatNumber,
      });
    } catch (error) {
      logger.warn(
        { ownerId, customerId: customer.id, error: error.message },
        'Failed to attach VAT ID to Stripe customer',
      );
    }
  }

  await prisma.user.update({
    where: { id: ownerId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

async function syncStripeCustomerBillingProfile({
  stripeCustomerId,
  billingProfile,
}) {
  if (!stripe || !isValidStripeCustomerId(stripeCustomerId)) {
    return null;
  }

  const address = normalizeStripeAddress(billingProfile?.billingAddress);
  const email = billingProfile?.billingEmail || undefined;
  const name = billingProfile?.legalName || undefined;
  const { taxExempt } = deriveTaxSettingsFromProfile(billingProfile);

  await stripe.customers.update(stripeCustomerId, {
    email,
    name,
    address: address || undefined,
    tax_exempt: taxExempt || undefined,
  });

  if (billingProfile?.vatNumber) {
    try {
      const existing = await stripe.customers.listTaxIds(stripeCustomerId, {
        limit: 100,
      });
      const existingVat = existing.data.find((taxId) => taxId.type === 'eu_vat');
      if (existingVat && existingVat.value && existingVat.value !== billingProfile.vatNumber && existingVat.id) {
        await stripe.customers.deleteTaxId(stripeCustomerId, existingVat.id).catch(() => null);
      }
      const alreadyExists = existing.data.some(
        (taxId) => taxId.value === billingProfile.vatNumber,
      );
      if (!alreadyExists) {
        await stripe.customers.createTaxId(stripeCustomerId, {
          type: 'eu_vat',
          value: billingProfile.vatNumber,
        });
      }
    } catch (error) {
      logger.warn(
        { stripeCustomerId, error: error.message },
        'Failed to sync Stripe customer tax ID',
      );
    }
  } else {
    try {
      const existing = await stripe.customers.listTaxIds(stripeCustomerId, {
        limit: 20,
      });
      const vatIds = existing.data.filter((taxId) => taxId.type === 'eu_vat');
      for (const taxId of vatIds) {
        await stripe.customers.deleteTaxId(stripeCustomerId, taxId.id).catch(() => null);
      }
    } catch (error) {
      logger.warn({ stripeCustomerId, error: error.message }, 'Failed to remove stale VAT IDs from Stripe customer');
    }
  }

  return stripeCustomerId;
}

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
  stripeCustomerId,
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  // Check DB fields first, then environment variables
  const resolvedPriceId = priceId || getStripePriceId(pkg.name, currency, pkg);
  if (!resolvedPriceId) {
    throw new Error(`Stripe price ID not found for package ${pkg.name} (${currency})`);
  }

  const sessionParams = {
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
    ...(isValidStripeCustomerId(stripeCustomerId)
      ? { customer: stripeCustomerId, customer_update: { address: 'auto', name: 'auto' } }
      : {
        customer_email: userEmail || undefined,
        customer_creation: 'always',
      }),
    billing_address_collection: 'required',
    client_reference_id: `owner_${ownerId}`,
    expand: ['line_items'],
    ...(isStripeTaxEnabled()
      ? {
        automatic_tax: { enabled: true },
        tax_id_collection: { enabled: true },
      }
      : {}),
  };

  const session = await stripe.checkout.sessions.create(
    sessionParams,
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
  stripeCustomerId,
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
      billing_address_collection: 'required',
      ...(isValidStripeCustomerId(stripeCustomerId)
        ? { customer: stripeCustomerId, customer_update: { address: 'auto', name: 'auto' } }
        : {
          customer_email: userEmail || undefined,
          customer_creation: 'always',
        }),
      client_reference_id: `owner_${ownerId}`,
      subscription_data: {
        metadata: {
          ownerId: String(ownerId),
          planType,
          currency: currency.toUpperCase(),
        },
      },
      ...(isStripeTaxEnabled()
        ? {
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
        }
        : {}),
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
 * Create a Stripe checkout session for upgrading/downgrading a subscription via Checkout (Shopify parity).
 * This creates a NEW subscription in Stripe, and includes previous subscription id in metadata.
 * Webhook handler is responsible for cancelling the previous subscription (best-effort) after success.
 */
async function createSubscriptionChangeCheckoutSession({
  ownerId,
  userEmail,
  planCode,
  interval,
  currency = 'EUR',
  successUrl,
  cancelUrl,
  stripeCustomerId,
  previousStripeSubscriptionId = null,
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const normalizedPlan = String(planCode || '').toLowerCase();
  const normalizedInterval = String(interval || '').toLowerCase();
  const normalizedCurrency = String(currency || '').toUpperCase();

  const priceId = planCatalog.getPriceId(normalizedPlan, normalizedInterval, normalizedCurrency);
  if (!priceId) {
    throw new Error(`Stripe price ID not configured for ${normalizedPlan}/${normalizedInterval}/${normalizedCurrency}`);
  }

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
      planType: normalizedPlan,
      interval: normalizedInterval,
      type: 'subscription',
      changeType: 'subscription_change',
      currency: normalizedCurrency,
      previousStripeSubscriptionId: previousStripeSubscriptionId || '',
    },
    billing_address_collection: 'required',
    ...(isValidStripeCustomerId(stripeCustomerId)
      ? { customer: stripeCustomerId, customer_update: { address: 'auto', name: 'auto' } }
      : {
        customer_email: userEmail || undefined,
        customer_creation: 'always',
      }),
    client_reference_id: `owner_${ownerId}`,
    subscription_data: {
      metadata: {
        ownerId: String(ownerId),
        planType: normalizedPlan,
        interval: normalizedInterval,
        currency: normalizedCurrency,
        previousStripeSubscriptionId: previousStripeSubscriptionId || '',
      },
    },
    ...(isStripeTaxEnabled()
      ? {
        automatic_tax: { enabled: true },
        tax_id_collection: { enabled: true },
      }
      : {}),
    expand: ['line_items', 'subscription'],
  });

  return session;
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
  stripeCustomerId,
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
    ...(isValidStripeCustomerId(stripeCustomerId)
      ? { customer: stripeCustomerId, customer_update: { address: 'auto', name: 'auto' } }
      : {
        customer_email: userEmail || undefined,
        customer_creation: 'always',
      }),
    billing_address_collection: 'required',
    client_reference_id: `owner_${ownerId}_topup_${credits}`,
    ...(isStripeTaxEnabled()
      ? {
        automatic_tax: { enabled: true },
        tax_id_collection: { enabled: true },
      }
      : {}),
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
  const impliedInterval = newPlanType === 'starter' ? 'month' : 'year';
  const newPriceId =
    planCatalog.getPriceId(newPlanType, impliedInterval, String(currency).toUpperCase()) ||
    getStripeSubscriptionPriceId(newPlanType, currency);

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

async function getSubscriptionExpanded(subscriptionId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price', 'schedule'],
  });
}

/**
 * Create or update a subscription schedule to change price at period end (Shopify parity).
 * Used for scheduled downgrades (e.g., year -> month).
 */
async function createOrUpdateSubscriptionSchedule({
  subscriptionId,
  targetPriceId,
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  if (!subscriptionId) {
    throw new Error('subscriptionId is required');
  }
  if (!targetPriceId) {
    throw new Error('targetPriceId is required');
  }

  const subscription = await getSubscriptionExpanded(subscriptionId);
  const currentItem = subscription.items?.data?.[0];
  const currentPriceId = currentItem?.price?.id;
  const periodEnd = subscription.current_period_end;
  if (!currentPriceId || !periodEnd) {
    throw new Error('Subscription is missing current price or current period end');
  }

  // Resolve existing schedule (may be id string or expanded object)
  let scheduleId = null;
  if (typeof subscription.schedule === 'string') {
    scheduleId = subscription.schedule;
  } else if (subscription.schedule?.id) {
    scheduleId = subscription.schedule.id;
  }

  let schedule = null;
  if (scheduleId) {
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  } else {
    schedule = await stripe.subscriptionSchedules.create({
      from_subscription: subscriptionId,
    });
    scheduleId = schedule.id;
  }

  const firstPhaseStart = schedule?.phases?.[0]?.start_date || subscription.current_period_start;
  const changeAt = periodEnd;

  // Two phases:
  // 1) Current plan until current period end
  // 2) Target plan starting at period end
  schedule = await stripe.subscriptionSchedules.update(scheduleId, {
    end_behavior: 'release',
    phases: [
      {
        start_date: firstPhaseStart,
        end_date: changeAt,
        items: [{ price: currentPriceId, quantity: 1 }],
      },
      {
        start_date: changeAt,
        items: [{ price: targetPriceId, quantity: 1 }],
      },
    ],
  });

  return {
    scheduleId,
    effectiveAt: new Date(changeAt * 1000),
  };
}

/**
 * Cancel (release) a subscription schedule, keeping the subscription active on its current pricing.
 */
async function cancelSubscriptionSchedule(subscriptionId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  const subscription = await getSubscriptionExpanded(subscriptionId);
  let scheduleId = null;
  if (typeof subscription.schedule === 'string') {
    scheduleId = subscription.schedule;
  } else if (subscription.schedule?.id) {
    scheduleId = subscription.schedule.id;
  }
  if (!scheduleId) {
    return { cancelled: false, reason: 'no_schedule' };
  }

  try {
    await stripe.subscriptionSchedules.release(scheduleId);
    return { cancelled: true, scheduleId, mode: 'release' };
  } catch (err) {
    // Fallback: cancel schedule
    await stripe.subscriptionSchedules.cancel(scheduleId);
    return { cancelled: true, scheduleId, mode: 'cancel' };
  }
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
  createSubscriptionChangeCheckoutSession,
  createCreditTopupCheckoutSession,
  getCheckoutSession,
  getPaymentIntent,
  getCustomerPortalUrl,
  updateSubscription,
  cancelSubscription,
  createOrUpdateSubscriptionSchedule,
  cancelSubscriptionSchedule,
  verifyWebhookSignature,
  getStripePriceId,
  getStripeSubscriptionPriceId,
  getStripeCreditTopupPriceId,
  ensureStripeCustomer,
  syncStripeCustomerBillingProfile,
  isStripeTaxEnabled,
};
