import Stripe from 'stripe';
import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { resolveTaxTreatment } from './tax-resolver.js';

// Initialize Stripe (only if API key is available)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  })
  : null;

const isStripeTaxEnabled = () =>
  String(process.env.STRIPE_TAX_ENABLED || 'true').toLowerCase() !== 'false';

const isValidStripeCustomerId = (value) =>
  typeof value === 'string' && value.startsWith('cus_');

const normalizeStripeAddress = (address) => {
  if (!address) return null;
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

export async function ensureStripeCustomer({
  shopId,
  shopDomain,
  shopName,
  currency,
  stripeCustomerId,
  billingProfile,
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (isValidStripeCustomerId(stripeCustomerId)) {
    return stripeCustomerId;
  }

  const address = normalizeStripeAddress(billingProfile?.billingAddress);
  // Use billingEmail from profile (required for checkout), never default to shop@astronote.com
  const email = billingProfile?.billingEmail || null;
  if (!email) {
    throw new Error('Billing email is required. Please complete your billing profile before checkout.');
  }
  const name = billingProfile?.legalName || shopName || shopDomain || 'Astronote Shop';
  const { taxExempt } = deriveTaxSettingsFromProfile(billingProfile);

  const customer = await stripe.customers.create({
    email: email || undefined,
    name,
    address: address || undefined,
    tax_exempt: taxExempt || undefined,
    metadata: {
      shopId: String(shopId),
      shopDomain: shopDomain || '',
      billingCurrency: currency || 'EUR',
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
        { shopId, customerId: customer.id, error: error.message },
        'Failed to attach VAT ID to Stripe customer',
      );
    }
  }

  await prisma.shop.update({
    where: { id: shopId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function syncStripeCustomerBillingProfile({
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

  // Sync VAT/Tax ID to Stripe (idempotent)
  if (billingProfile?.vatNumber) {
    try {
      const normalizedVatNumber = String(billingProfile.vatNumber).replace(/\s+/g, '').toUpperCase();
      const vatCountry = billingProfile.vatCountry || billingProfile.billingAddress?.country || 'GR';

      // List existing tax IDs
      const existingTaxIds = await stripe.customers.listTaxIds(stripeCustomerId, {
        limit: 100,
      });

      // Check if VAT number already exists
      const existingVatTaxId = existingTaxIds.data.find(
        (taxId) => taxId.type === 'eu_vat' && String(taxId.value).replace(/\s+/g, '').toUpperCase() === normalizedVatNumber,
      );

      if (existingVatTaxId) {
        // Update validation status if changed
        const validationStatus = existingVatTaxId.verification?.status;
        if (validationStatus === 'verified' && !billingProfile.vatValidated) {
          // Tax ID is verified in Stripe, update our DB (caller should handle this)
          logger.debug('Stripe tax ID already verified', {
            stripeCustomerId,
            taxId: existingVatTaxId.id,
            status: validationStatus,
          });
        }
      } else {
        // Create new tax ID
        const taxId = await stripe.customers.createTaxId(stripeCustomerId, {
          type: 'eu_vat',
          value: normalizedVatNumber,
        });

        logger.info('Stripe customer tax ID created', {
          stripeCustomerId,
          taxId: taxId.id,
          vatNumber: `${normalizedVatNumber.substring(0, 4)}...`, // Log partial for security
          country: vatCountry,
        });
      }

      // Remove any other EU VAT tax IDs if we have a new one (keep only the current one)
      const otherVatTaxIds = existingTaxIds.data.filter(
        (taxId) => taxId.type === 'eu_vat' && taxId.id !== existingVatTaxId?.id,
      );
      for (const oldTaxId of otherVatTaxIds) {
        try {
          await stripe.customers.deleteTaxId(stripeCustomerId, oldTaxId.id);
          logger.debug('Removed old Stripe tax ID', {
            stripeCustomerId,
            oldTaxId: oldTaxId.id,
          });
        } catch (deleteError) {
          logger.warn('Failed to remove old Stripe tax ID', {
            stripeCustomerId,
            oldTaxId: oldTaxId.id,
            error: deleteError.message,
          });
        }
      }
    } catch (error) {
      // Log error but don't fail the entire sync
      logger.warn(
        {
          stripeCustomerId,
          error: error.message,
          errorCode: error.code,
          errorType: error.type,
        },
        'Failed to sync Stripe customer tax ID',
      );
    }
  } else {
    // If VAT number was removed, optionally clean up Stripe tax IDs
    // (We keep them for historical purposes, but this could be configurable)
    logger.debug('No VAT number to sync to Stripe', { stripeCustomerId });
  }

  return stripeCustomerId;
}

/**
 * Create Stripe checkout session for credit purchase
 */
export async function createStripeCheckoutSession({
  packageId,
  _packageName, // Renamed to indicate unused
  credits,
  price,
  currency,
  stripePriceId,
  shopId,
  shopDomain,
  stripeCustomerId = null,
  metadata = {},
  successUrl,
  cancelUrl,
  idempotencyKey = null,
}) {
  try {
    if (!stripe) {
      logger.error('Stripe is not initialized', {
        hasStripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
        shopId,
        packageId,
      });
      throw new Error(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.',
      );
    }

    // Validate required parameters
    if (!stripePriceId) {
      logger.error('Missing stripePriceId', { shopId, packageId, currency });
      throw new Error('Stripe price ID is required');
    }

    if (!shopId) {
      logger.error('Missing shopId', { packageId, currency });
      throw new Error('Shop ID is required');
    }

    if (!shopDomain) {
      logger.error('Missing shopDomain', { shopId, packageId });
      throw new Error('Shop domain is required');
    }

    // Merge provided metadata with required fields
    // Ensure shopId is always present (use from metadata if provided, otherwise from parameter)
    const finalMetadata = {
      shopId: metadata.shopId || metadata.storeId || shopId, // Support both shopId and storeId
      storeId: metadata.storeId || shopId, // Keep storeId for backward compatibility
      packageId: metadata.packageId || packageId,
      credits: metadata.credits || credits.toString(),
      shopDomain: metadata.shopDomain || shopDomain,
      ...metadata, // Spread any additional metadata (e.g., transactionId)
    };

    logger.debug('Creating Stripe checkout session', {
      stripePriceId,
      shopId,
      shopDomain,
      packageId,
      credits,
      price,
      currency,
      successUrl,
      cancelUrl,
    });

    let session;
    try {
      const sessionParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url:
          successUrl ||
          `${process.env.FRONTEND_URL || 'https://astronote-shopify-frontend.onrender.com'}/settings?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:
          cancelUrl ||
          `${process.env.FRONTEND_URL || 'https://astronote-shopify-frontend.onrender.com'}/settings?canceled=true`,
        metadata: finalMetadata,
        ...(stripeCustomerId
          ? { customer: stripeCustomerId, customer_update: { address: 'auto', name: 'auto' } }
          : {
            customer_email: `${shopDomain}@astronote.com`, // Use shop domain as email
            customer_creation: 'always',
          }),
        billing_address_collection: 'required',
        shipping_address_collection: {
          allowed_countries: [
            'US',
            'CA',
            'GB',
            'DE',
            'FR',
            'IT',
            'ES',
            'NL',
            'BE',
            'AT',
            'CH',
            'SE',
            'NO',
            'DK',
            'FI',
            'GR',
          ],
        },
        payment_intent_data: {
          statement_descriptor: 'ASTRONOTE MARKETING',
        },
        ...(isStripeTaxEnabled()
          ? {
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
          }
          : {}),
      };

      // Add idempotency key if provided (aligned with Retail)
      if (idempotencyKey) {
        session = await stripe.checkout.sessions.create(
          sessionParams,
          { idempotencyKey },
        );
      } else {
        session = await stripe.checkout.sessions.create(sessionParams);
      }

      logger.info('Stripe checkout session created', {
        sessionId: session.id,
        shopId,
        packageId,
        credits,
        price,
        currency,
      });
    } catch (stripeError) {
      logger.error('Stripe API error', {
        error: stripeError.message,
        errorType: stripeError.type,
        errorCode: stripeError.code,
        stripeRequestId: stripeError.requestId,
        shopId,
        packageId,
        stripePriceId,
        currency,
      });

      // Provide more helpful error messages
      if (stripeError.type === 'StripeInvalidRequestError') {
        if (stripeError.message.includes('price')) {
          throw new Error(
            `Invalid Stripe price ID: ${stripePriceId}. Please configure the correct STRIPE_PRICE_ID environment variable.`,
          );
        }
        throw new Error(`Stripe configuration error: ${stripeError.message}`);
      }

      throw stripeError;
    }

    return session;
  } catch (error) {
    logger.error('Failed to create Stripe checkout session', {
      error: error.message,
      errorName: error.name,
      shopId,
      packageId,
      stripePriceId,
    });
    throw error;
  }
}

/**
 * Retrieve Stripe checkout session
 */
export async function getCheckoutSession(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    logger.error('Failed to retrieve Stripe checkout session', {
      error: error.message,
      sessionId,
    });
    throw error;
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(payload, signature) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe) {
      throw new Error(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.',
      );
    }

    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );

    return event;
  } catch (error) {
    logger.error('Failed to verify Stripe webhook signature', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Handle successful payment
 *
 * NOTE: This function is kept for backward compatibility.
 * For new implementations, use billingService.handleStripeWebhook() which has:
 * - Idempotency checks
 * - Atomic transactions via addCredits()
 * - WalletTransaction record creation
 *
 * @deprecated Prefer using billingService.handleStripeWebhook() for secure processing
 */
export async function handlePaymentSuccess(session) {
  try {
    // Support both shopId and storeId in metadata (they are the same - shop.id)
    const shopId = session.metadata.shopId || session.metadata.storeId;
    const { packageId, credits, transactionId } = session.metadata;

    if (!shopId || !packageId || !credits) {
      throw new Error(
        'Missing required metadata in session. Required: shopId/storeId, packageId, credits',
      );
    }

    const creditsToAdd = parseInt(credits);

    // If transactionId is provided, check for idempotency
    if (transactionId) {
      const transaction = await prisma.billingTransaction.findUnique({
        where: { id: transactionId },
      });

      if (transaction && transaction.status === 'completed') {
        // Get current shop balance
        const shop = await prisma.shop.findUnique({
          where: { id: shopId },
          select: { credits: true },
        });

        logger.warn('Transaction already completed (idempotency check)', {
          transactionId,
          sessionId: session.id,
        });
        return {
          success: true,
          creditsAdded: 0,
          newBalance: shop?.credits || 0,
          alreadyProcessed: true,
        };
      }
    }

    // Use atomic transaction for credit addition
    const result = await prisma.$transaction(async tx => {
      // Update shop credits
      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data: {
          credits: {
            increment: creditsToAdd,
          },
        },
        select: { credits: true },
      });

      // Update billing transaction status (if transactionId provided)
      if (transactionId) {
        await tx.billingTransaction.update({
          where: { id: transactionId },
          data: {
            status: 'completed',
            stripePaymentId: session.payment_intent,
          },
        });
      } else {
        // Fallback: update by session ID (less precise)
        await tx.billingTransaction.updateMany({
          where: {
            shopId,
            stripeSessionId: session.id,
            status: 'pending',
          },
          data: {
            status: 'completed',
            stripePaymentId: session.payment_intent,
          },
        });
      }

      // Create wallet transaction record for audit trail
      await tx.walletTransaction.create({
        data: {
          shopId,
          type: 'purchase',
          credits: creditsToAdd,
          ref: `stripe:${session.id}`,
          meta: {
            sessionId: session.id,
            paymentIntent: session.payment_intent,
            packageId,
            transactionId: transactionId || null,
          },
        },
      });

      return updatedShop;
    });

    logger.info('Payment processed successfully', {
      shopId,
      packageId,
      creditsAdded: creditsToAdd,
      newBalance: result.credits,
      sessionId: session.id,
    });

    return {
      success: true,
      creditsAdded: creditsToAdd,
      newBalance: result.credits,
    };
  } catch (error) {
    logger.error('Failed to handle payment success', {
      error: error.message,
      sessionId: session.id,
    });
    throw error;
  }
}

/**
 * Handle failed payment
 */
export async function handlePaymentFailure(session) {
  try {
    // Support both shopId and storeId in metadata
    const shopId = session.metadata.shopId || session.metadata.storeId;

    if (!shopId) {
      throw new Error('Missing shopId/storeId in session metadata');
    }

    // Update billing transaction status
    await prisma.billingTransaction.updateMany({
      where: {
        shopId,
        stripeSessionId: session.id,
        status: 'pending',
      },
      data: {
        status: 'failed',
      },
    });

    logger.info('Payment failed', {
      shopId,
      sessionId: session.id,
    });

    return {
      success: true,
      message: 'Payment failure recorded',
    };
  } catch (error) {
    logger.error('Failed to handle payment failure', {
      error: error.message,
      sessionId: session.id,
    });
    throw error;
  }
}

/**
 * Get Stripe customer by email
 */
export async function getCustomerByEmail(email) {
  try {
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    return customers.data[0] || null;
  } catch (error) {
    logger.error('Failed to get Stripe customer', {
      error: error.message,
      email,
    });
    throw error;
  }
}

/**
 * Create Stripe customer
 */
export async function createCustomer({ email, name, shopDomain }) {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        shopDomain,
      },
    });

    logger.info('Stripe customer created', {
      customerId: customer.id,
      email,
      shopDomain,
    });

    return customer;
  } catch (error) {
    logger.error('Failed to create Stripe customer', {
      error: error.message,
      email,
      shopDomain,
    });
    throw error;
  }
}

/**
 * Get Stripe subscription price ID from environment variables
 * @deprecated Use plan-catalog.getPriceId() instead
 * @param {string} planType - 'starter' or 'pro'
 * @param {string} currency - Currency code (EUR, USD, etc.)
 * @returns {string|null} Stripe price ID or null
 */
export function getStripeSubscriptionPriceId(planType, currency = 'EUR') {
  // Legacy: fallback to old format (assumes starter=month, pro=year)
  // Note: For new code, use plan-catalog.getPriceId() directly
  const upperCurrency = currency.toUpperCase();
  const envKey = `STRIPE_PRICE_ID_SUB_${planType.toUpperCase()}_${upperCurrency}`;
  return process.env[envKey] || null;
}

/**
 * Get Stripe credit top-up price ID from environment variables
 * @param {string} currency - Currency code (EUR, USD, etc.)
 * @returns {string|null} Stripe price ID or null
 */
export function getStripeCreditTopupPriceId(currency = 'EUR') {
  const upperCurrency = currency.toUpperCase();
  const envKey = `STRIPE_PRICE_ID_CREDIT_TOPUP_${upperCurrency}`;
  return process.env[envKey] || null;
}

/**
 * Get Stripe price ID for a package and currency
 * @param {string} packageName - Package name or identifier
 * @param {string} currency - Currency code (EUR, USD, etc.)
 * @param {Object|null} packageDb - Package database record (optional)
 * @returns {string|null} Stripe price ID or null
 */
export function getStripePriceId(
  packageName,
  currency = 'EUR',
  packageDb = null,
) {
  const upperCurrency = currency.toUpperCase();

  // First priority: Check package DB fields if provided
  if (packageDb) {
    if (upperCurrency === 'USD' && packageDb.stripePriceIdUsd) {
      return packageDb.stripePriceIdUsd;
    }
    if (upperCurrency === 'EUR' && packageDb.stripePriceIdEur) {
      return packageDb.stripePriceIdEur;
    }
  }

  // Second priority: Environment variable
  const envKey = `STRIPE_PRICE_ID_${packageName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${upperCurrency}`;
  const envPriceId = process.env[envKey];
  if (envPriceId) return envPriceId;

  // Fallback: Generic format
  const genericKey = `STRIPE_PRICE_ID_${upperCurrency}`;
  return process.env[genericKey] || null;
}

/**
 * Create a Stripe checkout session for subscription
 * @param {Object} params
 * @param {string} params.shopId - Shop ID
 * @param {string} params.shopDomain - Shop domain
 * @param {string} params.planType - 'starter' or 'pro'
 * @param {string} params.currency - Currency code (EUR, USD, etc.)
 * @param {string} params.successUrl - Success redirect URL
 * @param {string} params.cancelUrl - Cancel redirect URL
 * @returns {Promise<Object>} Stripe checkout session
 */
export async function createSubscriptionCheckoutSession({
  shopId,
  shopDomain: _shopDomain,
  planType,
  interval = null,
  currency = 'EUR',
  stripeCustomerId = null,
  billingProfile = null,
  successUrl,
  cancelUrl,
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (!['starter', 'pro'].includes(planType)) {
    throw new Error(`Invalid plan type: ${planType}`);
  }

  // Use Plan Catalog to resolve priceId
  const planCatalog = await import('./plan-catalog.js');

  // If interval not provided, use legacy defaults (starter=month, pro=year)
  const resolvedInterval = interval || (planType === 'starter' ? 'month' : 'year');

  const priceId = planCatalog.getPriceId(planType, resolvedInterval, currency);
  if (!priceId) {
    const validation = planCatalog.validateCatalog();
    throw new Error(
      `Stripe price ID not found for subscription plan ${planType}/${resolvedInterval}/${currency}. ` +
      'Please configure the required environment variable. ' +
      `Missing env vars (mode=${validation.mode || 'unknown'}): ${(validation.missingEnvVars || validation.missing || []).join(', ')}`,
    );
  }

  // Verify the price exists and is a recurring price
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (price.type !== 'recurring') {
      throw new Error(
        `Price ID ${priceId} is not a recurring price. Subscription plans require recurring prices.`,
      );
    }
    if (!price.recurring) {
      throw new Error(
        `Price ID ${priceId} does not have recurring configuration.`,
      );
    }
  } catch (err) {
    if (
      err.type === 'StripeInvalidRequestError' &&
      err.code === 'resource_missing'
    ) {
      throw new Error(
        `Price ID ${priceId} not found in Stripe. Please verify the price ID is correct.`,
      );
    }
    // Re-throw if it's our custom error
    if (
      err.message?.includes('not a recurring price') ||
      err.message?.includes('does not have recurring')
    ) {
      throw err;
    }
    // For other errors, log but continue (price might still be valid)
    logger.warn(
      { priceId, err: err.message },
      'Could not verify price type, continuing anyway',
    );
  }

  // Validate URLs before sending to Stripe (fail fast with clear diagnostics)
  const { isValidAbsoluteUrl } = await import('../utils/url-helpers.js');
  if (!isValidAbsoluteUrl(successUrl)) {
    logger.error('Invalid success URL for Stripe checkout', {
      successUrl,
      shopId,
      planType,
      currency,
      frontendUrl: process.env.FRONTEND_URL || process.env.WEB_APP_URL || '(not set)',
    });
    throw new Error(
      `Invalid success URL: "${successUrl}". Must be a valid absolute URL with https:// protocol. Please check FRONTEND_URL, FRONTEND_BASE_URL, or WEB_APP_URL environment variable.`,
    );
  }
  if (!isValidAbsoluteUrl(cancelUrl)) {
    logger.error('Invalid cancel URL for Stripe checkout', {
      cancelUrl,
      shopId,
      planType,
      currency,
      frontendUrl: process.env.FRONTEND_URL || process.env.WEB_APP_URL || '(not set)',
    });
    throw new Error(
      `Invalid cancel URL: "${cancelUrl}". Must be a valid absolute URL with https:// protocol. Please check FRONTEND_URL, FRONTEND_BASE_URL, or WEB_APP_URL environment variable.`,
    );
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
        shopId: String(shopId),
        storeId: String(shopId), // Keep for backward compatibility
        planType,
        type: 'subscription',
      },
      // Professional billing details collection
      billing_address_collection: 'required', // Always collect billing address
      ...(stripeCustomerId
        ? {
          customer: stripeCustomerId,
          customer_update: {
            address: 'auto',
            name: 'auto',
            // Allow customer to update email in checkout if needed
          },
        }
        : {
          customer_email: billingProfile?.billingEmail || undefined, // Pre-fill if available
          customer_creation: 'always',
        }),
      client_reference_id: `shop_${shopId}`,
      subscription_data: {
        metadata: {
          shopId: String(shopId),
          storeId: String(shopId), // Keep for backward compatibility
          planType,
          interval: resolvedInterval,
          currency: String(currency).toUpperCase(),
        },
      },
      // Enable tax collection (VAT/AFM) - always collect tax IDs for professional billing
      ...(isStripeTaxEnabled()
        ? {
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true }, // Collect VAT/AFM during checkout
        }
        : {
          // Even without Stripe Tax, collect tax IDs for manual processing
          tax_id_collection: { enabled: true },
        }),
      expand: ['line_items', 'subscription'],
    });

    logger.info('Subscription checkout session created', {
      sessionId: session.id,
      shopId,
      planType,
      currency,
    });

    return session;
  } catch (err) {
    // Enhanced error handling with URL diagnostics
    if (err.type === 'StripeInvalidRequestError') {
      // Log detailed Stripe error information
      logger.error('Stripe API error', {
        type: err.type,
        code: err.code,
        param: err.param,
        message: err.message,
        successUrl,
        cancelUrl,
        priceId,
        shopId,
        planType,
      });

      if (err.message?.includes('recurring price')) {
        throw new Error(
          `The price ID ${priceId} is not configured as a recurring price in Stripe. Please create a recurring price for the ${planType} plan.`,
        );
      }

      // Check if error is about URLs
      if (err.message?.includes('Not a valid URL') || err.param?.includes('url')) {
        throw new Error(
          `Stripe error: Invalid URL in ${err.param || 'redirect URL'}. Success URL: ${successUrl}, Cancel URL: ${cancelUrl}. Please check FRONTEND_URL configuration.`,
        );
      }

      throw new Error(`Stripe error: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Create a Stripe checkout session for a subscription change (upgrade path).
 *
 * NOTE:
 * Stripe Checkout creates a new subscription. To avoid double subscriptions for the same customer,
 * we include `previousStripeSubscriptionId` in metadata so webhook/finalize can cancel the old one
 * after the new subscription is successfully created.
 */
export async function createSubscriptionChangeCheckoutSession({
  shopId,
  planType,
  interval,
  currency = 'EUR',
  stripeCustomerId,
  billingProfile = null,
  successUrl,
  cancelUrl,
  previousStripeSubscriptionId = null,
}) {
  const session = await createSubscriptionCheckoutSession({
    shopId,
    shopDomain: null,
    planType,
    interval,
    currency,
    stripeCustomerId,
    billingProfile,
    successUrl,
    cancelUrl,
  });

  // Best-effort: attach previous subscription id for safe cancellation after upgrade.
  // We do this via a follow-up update because `createSubscriptionCheckoutSession` owns metadata shape.
  if (previousStripeSubscriptionId && stripe) {
    try {
      await stripe.checkout.sessions.update(session.id, {
        metadata: {
          ...(session.metadata || {}),
          previousStripeSubscriptionId: String(previousStripeSubscriptionId),
          type: 'subscription_change',
        },
      });
    } catch (err) {
      logger.warn(
        { shopId, sessionId: session.id, err: err.message },
        'Failed to attach previousStripeSubscriptionId to checkout session metadata',
      );
    }
  }

  return session;
}

/**
 * Create a Stripe checkout session for credit top-up
 * @param {Object} params
 * @param {string} params.shopId - Shop ID
 * @param {string} params.shopDomain - Shop domain
 * @param {number} params.credits - Number of credits to purchase
 * @param {number} params.priceEur - Price in EUR (including VAT)
 * @param {string} params.currency - Currency code (EUR, USD, etc.)
 * @param {string} params.successUrl - Success redirect URL
 * @param {string} params.cancelUrl - Cancel redirect URL
 * @returns {Promise<Object>} Stripe checkout session
 */
export async function createCreditTopupCheckoutSession({
  shopId,
  shopDomain,
  credits,
  priceEur,
  currency = 'EUR',
  stripeCustomerId = null,
  successUrl,
  cancelUrl,
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  // Try to use configured price ID first
  const priceId = getStripeCreditTopupPriceId(currency);

  // If no price ID configured, create a one-time payment with custom amount
  if (!priceId) {
    // Create checkout session with custom amount
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `${credits} SMS Credits`,
              description: `Top-up of ${credits} SMS credits`,
            },
            unit_amount: Math.round(priceEur * 100), // Convert EUR to cents (ensure integer)
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        shopId: String(shopId),
        storeId: String(shopId), // Keep for backward compatibility
        credits: String(credits),
        priceEur: String(priceEur),
        type: 'credit_topup',
      },
      ...(stripeCustomerId
        ? { customer: stripeCustomerId, customer_update: { address: 'auto', name: 'auto' } }
        : {
          customer_email: `${shopDomain}@astronote.com`,
          customer_creation: 'always',
        }),
      client_reference_id: `shop_${shopId}_topup_${credits}`,
      ...(isStripeTaxEnabled()
        ? {
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
        }
        : {}),
      expand: ['line_items'],
    });

    logger.info('Credit top-up checkout session created', {
      sessionId: session.id,
      shopId,
      credits,
      priceEur,
      currency,
    });

    return session;
  }

  // Use configured price ID
  // IMPORTANT: The price ID must be configured as a per-credit price (unit_amount per credit)
  // If using a fixed-amount price, use custom price_data instead (handled above)
  // Validate price type before using
  let price = null;
  let validatedPriceId = priceId;
  try {
    price = await stripe.prices.retrieve(validatedPriceId);
    if (price.type !== 'one_time') {
      logger.warn(
        { priceId: validatedPriceId, priceType: price.type },
        'Credit top-up price ID is not a one-time price, falling back to custom price_data',
      );
      // Fall back to custom price_data
      validatedPriceId = null;
    }
  } catch (err) {
    logger.warn(
      { priceId: validatedPriceId, err: err.message },
      'Failed to retrieve price, falling back to custom price_data',
    );
    validatedPriceId = null;
  }

  // If price validation failed or price ID is invalid, use custom price_data
  if (!validatedPriceId || !price) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `${credits} SMS Credits`,
              description: `Top-up of ${credits} SMS credits`,
            },
            unit_amount: Math.round(priceEur * 100), // Convert EUR to cents (ensure integer)
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        shopId: String(shopId),
        storeId: String(shopId), // Keep for backward compatibility
        credits: String(credits),
        priceEur: String(priceEur),
        type: 'credit_topup',
      },
      ...(stripeCustomerId
        ? { customer: stripeCustomerId, customer_update: { address: 'auto', name: 'auto' } }
        : {
          customer_email: `${shopDomain}@astronote.com`,
          customer_creation: 'always',
        }),
      client_reference_id: `shop_${shopId}_topup_${credits}`,
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

  // Use validated price ID (assumed to be per-credit)
  // NOTE: This assumes the price ID is configured with unit_amount = price per credit in cents
  // If your price ID is for a fixed amount, do not use this path - use custom price_data instead
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: validatedPriceId,
        quantity: credits, // Price is per-credit, so quantity = number of credits
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      shopId: String(shopId),
      storeId: String(shopId), // Keep for backward compatibility
      credits: String(credits),
      priceEur: String(priceEur),
      type: 'credit_topup',
    },
    ...(stripeCustomerId
      ? { customer: stripeCustomerId, customer_update: { address: 'auto', name: 'auto' } }
      : {
        customer_email: `${shopDomain}@astronote.com`,
        customer_creation: 'always',
      }),
    client_reference_id: `shop_${shopId}_topup_${credits}`,
    ...(isStripeTaxEnabled()
      ? {
        automatic_tax: { enabled: true },
        tax_id_collection: { enabled: true },
      }
      : {}),
    expand: ['line_items'],
  });

  logger.info('Credit top-up checkout session created', {
    sessionId: session.id,
    shopId,
    credits,
    priceEur,
    currency,
  });

  return session;
}

/**
 * Update subscription to a new plan
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {string} newPlanType - 'starter' or 'pro'
 * @param {string} currency - Currency code (EUR, USD, etc.)
 * @param {string} interval - 'month' or 'year' (optional, uses legacy defaults if not provided)
 * @param {string} behavior - 'immediate' or 'period_end' (default: 'immediate')
 * @returns {Promise<Object>} Updated subscription
 */
export async function updateSubscription(
  subscriptionId,
  newPlanType,
  currency = 'EUR',
  interval = null,
  behavior = 'immediate',
) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (!['starter', 'pro'].includes(newPlanType)) {
    throw new Error(`Invalid plan type: ${newPlanType}`);
  }

  // Use Plan Catalog to resolve priceId
  const planCatalog = await import('./plan-catalog.js');

  // If interval not provided, use legacy defaults (starter=month, pro=year)
  const resolvedInterval = interval || (newPlanType === 'starter' ? 'month' : 'year');

  const newPriceId = planCatalog.getPriceId(newPlanType, resolvedInterval, currency);
  if (!newPriceId) {
    const validation = planCatalog.validateCatalog();
    throw new Error(
      `Stripe price ID not found for ${newPlanType}/${resolvedInterval}/${currency}. ` +
      `Missing env vars (mode=${validation.mode || 'unknown'}): ${(validation.missingEnvVars || validation.missing || []).join(', ')}`,
    );
  }

  // Retrieve current subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Determine proration behavior
  const prorationBehavior = behavior === 'period_end' ? 'none' : 'always_invoice';
  const billingCycleAnchor = behavior === 'period_end' ? subscription.current_period_end : undefined;

  // Update subscription with new price
  const updateParams = {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: prorationBehavior,
    metadata: {
      planType: newPlanType,
      interval: resolvedInterval,
      currency: String(currency).toUpperCase(),
      updatedAt: new Date().toISOString(),
    },
    ...(isStripeTaxEnabled()
      ? { automatic_tax: { enabled: true } }
      : {}),
  };

  // If scheduling for period end, set billing_cycle_anchor
  if (behavior === 'period_end' && billingCycleAnchor) {
    updateParams.billing_cycle_anchor = 'unchanged';
  }

  const updated = await stripe.subscriptions.update(subscriptionId, updateParams);

  logger.info(
    { subscriptionId, newPlanType, newPriceId },
    'Subscription updated',
  );
  return updated;
}

/**
 * Schedule a subscription change at period end using Stripe subscription schedules.
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {string} newPlanType - 'starter' or 'pro'
 * @param {string} currency - Currency code (EUR, USD, etc.)
 * @param {string} interval - 'month' or 'year'
 * @returns {Promise<Object>} Schedule and subscription details
 */
export async function scheduleSubscriptionChange(
  subscriptionId,
  newPlanType,
  currency = 'EUR',
  interval = null,
) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (!['starter', 'pro'].includes(newPlanType)) {
    throw new Error(`Invalid plan type: ${newPlanType}`);
  }

  const planCatalog = await import('./plan-catalog.js');
  const resolvedInterval = interval || (newPlanType === 'starter' ? 'month' : 'year');
  const newPriceId = planCatalog.getPriceId(newPlanType, resolvedInterval, currency);
  if (!newPriceId) {
    const validation = planCatalog.validateCatalog();
    throw new Error(
      `Stripe price ID not found for ${newPlanType}/${resolvedInterval}/${currency}. ` +
      `Missing env vars (mode=${validation.mode || 'unknown'}): ${(validation.missingEnvVars || validation.missing || []).join(', ')}`,
    );
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price', 'schedule'],
  });

  if (!subscription.current_period_start || !subscription.current_period_end) {
    throw new Error('Subscription period information is missing');
  }

  const currentItems = (subscription.items?.data || [])
    .map((item) => ({
      price: item.price?.id || item.price,
      quantity: item.quantity || 1,
    }))
    .filter((item) => item.price);

  if (currentItems.length === 0) {
    throw new Error('Subscription items not found for scheduling');
  }

  const phases = [
    {
      items: currentItems,
      start_date: subscription.current_period_start,
      end_date: subscription.current_period_end,
    },
    {
      items: [{ price: newPriceId, quantity: 1 }],
      start_date: subscription.current_period_end,
    },
  ];

  let scheduleId = subscription.schedule;
  if (scheduleId && typeof scheduleId === 'object') {
    scheduleId = scheduleId.id;
  }

  const scheduleMetadata = {
    planType: newPlanType,
    interval: resolvedInterval,
    currency: String(currency).toUpperCase(),
    updatedAt: new Date().toISOString(),
  };

  const schedule = scheduleId
    ? await stripe.subscriptionSchedules.update(scheduleId, {
      phases,
      end_behavior: 'release',
      metadata: scheduleMetadata,
    })
    : await stripe.subscriptionSchedules.create({
      from_subscription: subscriptionId,
      phases,
      end_behavior: 'release',
      metadata: scheduleMetadata,
    });

  logger.info(
    { subscriptionId, newPlanType, newPriceId, scheduleId: schedule.id },
    'Subscription change scheduled',
  );

  return { schedule, subscription };
}

/**
 * Cancel a scheduled subscription change by releasing the subscription schedule.
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Release result
 */
export async function cancelScheduledSubscriptionChange(subscriptionId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['schedule'],
  });

  let scheduleId = subscription.schedule;
  if (scheduleId && typeof scheduleId === 'object') {
    scheduleId = scheduleId.id;
  }

  if (!scheduleId) {
    return { released: false, reason: 'no_schedule' };
  }

  const released = await stripe.subscriptionSchedules.release(scheduleId);

  logger.info(
    { subscriptionId, scheduleId },
    'Subscription schedule released',
  );

  return { released: true, schedule: released };
}

/**
 * Cancel subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Cancelled subscription
 */
/**
 * Cancel subscription (at period end - professional behavior)
 * Sets cancel_at_period_end=true so user keeps access until period ends
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {boolean} immediate - If true, cancel immediately. If false (default), cancel at period end
 * @returns {Promise<Object>} Updated subscription
 */
export async function cancelSubscription(subscriptionId, immediate = false) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (immediate) {
    // Immediate cancellation (rare, usually for fraud/abuse)
    return stripe.subscriptions.cancel(subscriptionId);
  }

  // Professional cancellation: cancel at period end (user keeps access until paid period ends)
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Resume subscription (undo cancellation)
 * Sets cancel_at_period_end=false to continue subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Updated subscription
 */
export async function resumeSubscription(subscriptionId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  // Resume subscription: remove cancellation flag
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Cancel subscription immediately (used for upgrade replacement flow).
 * Best-effort: prevents double subscriptions after a Checkout-based upgrade.
 */
export async function cancelSubscriptionImmediately(subscriptionId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  if (!subscriptionId) {
    return null;
  }

  // Immediate cancellation, without proration/invoice. (We already charged for the new subscription.)
  return stripe.subscriptions.cancel(subscriptionId, {
    invoice_now: false,
    prorate: false,
  });
}

/**
 * Get Stripe customer portal URL
 * @param {string} customerId - Stripe customer ID
 * @param {string} returnUrl - URL to return to after portal session
 * @returns {Promise<string>} Portal URL
 */
export async function getCustomerPortalUrl(customerId, returnUrl) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

export default {
  createStripeCheckoutSession,
  getCheckoutSession,
  verifyWebhookSignature,
  handlePaymentSuccess,
  handlePaymentFailure,
  getCustomerByEmail,
  createCustomer,
  ensureStripeCustomer,
  syncStripeCustomerBillingProfile,
  isStripeTaxEnabled,
  getStripeSubscriptionPriceId,
  getStripeCreditTopupPriceId,
  getStripePriceId,
  createSubscriptionCheckoutSession,
  createCreditTopupCheckoutSession,
  updateSubscription,
  scheduleSubscriptionChange,
  cancelScheduledSubscriptionChange,
  cancelSubscription,
  cancelSubscriptionImmediately,
  resumeSubscription,
  getCustomerPortalUrl,
};
