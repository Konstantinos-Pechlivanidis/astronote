import { getStoreId } from '../middlewares/store-resolution.js';
import { logger } from '../utils/logger.js';
import billingService from '../services/billing.js';
import { getSubscriptionStatus } from '../services/subscription.js';
import { calculateTopupPrice } from '../services/subscription.js';
import { createCreditTopupCheckoutSession, ensureStripeCustomer, syncStripeCustomerBillingProfile } from '../services/stripe.js';
import { getBillingProfile, upsertBillingProfile } from '../services/billing-profile.js';
import { listInvoices } from '../services/invoices.js';
import prisma from '../services/prisma.js';
import { sendSuccess, sendPaginated, sendError } from '../utils/response.js';
import crypto from 'crypto';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  })
  : null;

const billingDiagnosticsEnabled =
  process.env.BILLING_DIAGNOSTICS === 'true' ||
  process.env.NODE_ENV === 'development';

const logBillingDiagnostics = async ({ storeId, shopDomain, endpoint }) => {
  if (!billingDiagnosticsEnabled) {
    return;
  }

  try {
    const shop = await prisma.shop.findUnique({
      where: { id: storeId },
      select: { stripeCustomerId: true },
    });

    logger.info('Billing diagnostics', {
      endpoint,
      shopId: storeId,
      shopDomain: shopDomain || null,
      stripeCustomerIdPresent: Boolean(shop?.stripeCustomerId),
    });
  } catch (error) {
    logger.debug('Billing diagnostics lookup failed', {
      endpoint,
      shopId: storeId,
      error: error.message,
    });
  }
};

/**
 * Billing Controller
 * Uses service layer for all billing and credit management logic
 */

/**
 * Get current credit balance
 * @route GET /billing/balance
 */
export async function getBalance(req, res, next) {
  try {
    const storeId = getStoreId(req);

    const balance = await billingService.getBalance(storeId);

    return sendSuccess(res, balance);
  } catch (error) {
    logger.error('Get balance error', {
      error: error.message,
      stack: error.stack,
      storeId: req.ctx?.store?.id,
    });
    next(error);
  }
}

/**
 * Get available credit packages (public - no authentication required)
 * @route GET /public/packages
 */
export async function getPublicPackages(req, res, next) {
  try {
    // Get currency from query param or default to EUR
    const currency = req.query.currency || 'EUR';

    // Validate currency
    const validCurrencies = ['EUR', 'USD'];
    const finalCurrency = validCurrencies.includes(currency.toUpperCase())
      ? currency.toUpperCase()
      : 'EUR';

    const packages = await billingService.getPackages(finalCurrency);

    return sendSuccess(res, { packages, currency: finalCurrency });
  } catch (error) {
    logger.error('Get public packages error', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
}

/**
 * Get available credit packages (authenticated - with store context)
 * Only returns packages if subscription is active
 * @route GET /billing/packages
 */
export async function getPackages(req, res, next) {
  try {
    const storeId = getStoreId(req);

    // Check subscription status - packages only available with active subscription (aligned with Retail)
    const subscription = await getSubscriptionStatus(storeId);
    if (!subscription.active) {
      // Return empty array if no active subscription (matches Retail behavior)
      return sendSuccess(res, {
        packages: [],
        currency: 'EUR',
      });
    }

    // Get currency from query param or shop/settings currency
    const requestedCurrency = req.query.currency;
    const validCurrencies = ['EUR', 'USD'];

    // Validate requested currency if provided
    let currency = 'EUR';
    if (
      requestedCurrency &&
      validCurrencies.includes(requestedCurrency.toUpperCase())
    ) {
      currency = requestedCurrency.toUpperCase();
    } else {
      // Get shop currency, fallback to settings currency
      const shop = await prisma.shop.findUnique({
        where: { id: storeId },
        select: { currency: true },
        include: {
          settings: {
            select: { currency: true },
          },
        },
      });

      if (
        shop?.currency &&
        validCurrencies.includes(shop.currency.toUpperCase())
      ) {
        currency = shop.currency.toUpperCase();
      } else if (
        shop?.settings?.currency &&
        validCurrencies.includes(shop.settings.currency.toUpperCase())
      ) {
        currency = shop.settings.currency.toUpperCase();
      } else {
        const billingProfile = await getBillingProfile(storeId);
        if (
          billingProfile?.currency &&
          validCurrencies.includes(String(billingProfile.currency).toUpperCase())
        ) {
          currency = String(billingProfile.currency).toUpperCase();
        }
      }
    }

    const packages = await billingService.getPackages(currency);

    // Generate ETag for caching (aligned with Retail)
    if (packages.length > 0) {
      const etagSource = JSON.stringify(
        packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          credits: pkg.credits,
          price: pkg.price,
          currency: pkg.currency,
          stripePriceId: pkg.stripePriceId,
        })),
      );
      const etagValue = `W/"${crypto.createHash('sha256').update(etagSource).digest('hex')}"`;
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === etagValue) {
        return res.status(304).end();
      }
      res.set('ETag', etagValue);
    }

    return sendSuccess(res, { packages, currency });
  } catch (error) {
    logger.error('Get packages error', {
      error: error.message,
      stack: error.stack,
      storeId: req.ctx?.store?.id,
    });
    next(error);
  }
}

/**
 * Create Stripe checkout session for credit purchase (credit packs)
 * Requires active subscription
 * @route POST /billing/purchase
 */
export async function createPurchase(req, res, next) {
  try {
    // Log request details for debugging
    logger.info('Create purchase request received', {
      method: req.method,
      path: req.path,
      headers: {
        authorization: req.headers.authorization ? 'Bearer ***' : undefined,
        'x-shopify-shop-domain': req.headers['x-shopify-shop-domain'],
        'x-shopify-shop': req.headers['x-shopify-shop'],
      },
      body: req.body,
      storeContext: req.ctx?.store
        ? {
          id: req.ctx.store.id,
          shopDomain: req.ctx.store.shopDomain,
        }
        : null,
    });

    // Get store ID - this will throw if store context is not available
    let storeId;
    try {
      storeId = getStoreId(req);
      logger.debug('Store ID retrieved', { storeId });
    } catch (storeError) {
      logger.error('Failed to get store ID', {
        error: storeError.message,
        storeContext: req.ctx?.store,
        headers: {
          authorization: req.headers.authorization ? 'Bearer ***' : undefined,
          'x-shopify-shop-domain': req.headers['x-shopify-shop-domain'],
        },
      });
      throw storeError;
    }

    // Verify subscription is active (credit packs require subscription)
    const subscription = await getSubscriptionStatus(storeId);
    if (!subscription.active) {
      return sendError(
        res,
        402,
        'INACTIVE_SUBSCRIPTION',
        'An active subscription is required to purchase credit packs. Please subscribe first.',
      );
    }

    const { packageId, successUrl, cancelUrl, currency } = req.body;

    const { isValidAbsoluteUrl } = await import('../utils/url-helpers.js');
    if (!isValidAbsoluteUrl(successUrl) || !isValidAbsoluteUrl(cancelUrl)) {
      return sendError(
        res,
        400,
        'INVALID_URL',
        'Success and cancel URLs must be valid absolute URLs.',
      );
    }

    // Get idempotency key from headers (aligned with Retail)
    const idempotencyKeyHeader =
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'];
    const idempotencyKey = idempotencyKeyHeader
      ? String(idempotencyKeyHeader).trim().slice(0, 128)
      : null;

    // Additional validation
    if (!packageId) {
      logger.warn('Missing packageId in request body', { body: req.body });
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Package ID is required',
        code: 'VALIDATION_ERROR',
        apiVersion: 'v1',
      });
    }

    if (!idempotencyKey) {
      return sendError(
        res,
        400,
        'MISSING_IDEMPOTENCY_KEY',
        'Idempotency-Key header is required',
      );
    }

    if (!successUrl || !cancelUrl) {
      logger.warn('Missing URLs in request body', { body: req.body });
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Success and cancel URLs are required',
        code: 'VALIDATION_ERROR',
        apiVersion: 'v1',
      });
    }

    // Check for existing purchase with same idempotency key (idempotency check)
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        shopId: storeId,
        idempotencyKey,
      },
    });

    if (existingPurchase?.stripeSessionId) {
      // Return existing session if found (idempotent response)
      const { getCheckoutSession } = await import('../services/stripe.js');
      let checkoutUrl = null;
      try {
        const session = await getCheckoutSession(existingPurchase.stripeSessionId);
        checkoutUrl = session.url || null;
      } catch (err) {
        logger.warn({
          purchaseId: existingPurchase.id,
          sessionId: existingPurchase.stripeSessionId,
          err: err.message,
        }, 'Failed to retrieve existing checkout session');
      }

      return sendSuccess(
        res,
        {
          checkoutUrl,
          sessionId: existingPurchase.stripeSessionId,
          purchaseId: existingPurchase.id,
          status: existingPurchase.status,
          idempotent: true,
        },
        'Existing purchase session found',
      );
    }

    logger.info('Creating purchase session', {
      storeId,
      packageId,
      currency: currency || 'EUR',
      idempotencyKey,
      successUrl,
      cancelUrl,
    });

    // Create Stripe checkout session (with idempotency key)
    const session = await billingService.createPurchaseSession(
      storeId,
      packageId,
      { successUrl, cancelUrl },
      currency, // Pass currency if provided
      idempotencyKey, // Pass idempotency key
    );

    logger.info('Purchase session created successfully', {
      storeId,
      packageId,
      sessionId: session.sessionId,
    });

    return sendSuccess(res, session, 'Checkout session created successfully');
  } catch (error) {
    logger.error('Create purchase error', {
      error: error.message,
      stack: error.stack,
      errorName: error.name,
      errorCode: error.code,
      storeId: req.ctx?.store?.id,
      storeDomain: req.ctx?.store?.shopDomain,
      body: req.body,
      headers: {
        authorization: req.headers.authorization ? 'Bearer ***' : undefined,
        'x-shopify-shop-domain': req.headers['x-shopify-shop-domain'],
      },
    });
    next(error);
  }
}

/**
 * Calculate top-up price
 * @route GET /billing/topup/calculate
 */
export async function calculateTopup(req, res, next) {
  try {
    const credits = parseInt(req.query.credits);
    const requestedCurrency = req.query.currency;
    const validCurrencies = ['EUR', 'USD'];

    if (!credits || !Number.isInteger(credits) || credits <= 0) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Credits must be a positive integer',
      );
    }

    const storeId = getStoreId(req);
    const shop = req.ctx?.store || null;
    const billingProfile = await getBillingProfile(storeId);

    let currency = 'EUR';
    if (
      requestedCurrency &&
      validCurrencies.includes(String(requestedCurrency).toUpperCase())
    ) {
      currency = String(requestedCurrency).toUpperCase();
    } else if (
      shop?.currency &&
      validCurrencies.includes(String(shop.currency).toUpperCase())
    ) {
      currency = String(shop.currency).toUpperCase();
    } else if (
      billingProfile?.currency &&
      validCurrencies.includes(String(billingProfile.currency).toUpperCase())
    ) {
      currency = String(billingProfile.currency).toUpperCase();
    }

    const billingCountry =
      billingProfile?.billingAddress?.country ||
      billingProfile?.vatCountry ||
      shop?.country ||
      null;

    const vatIdValidated = billingProfile?.taxStatus === 'verified';

    const priceBreakdown = calculateTopupPrice(credits, {
      currency,
      billingCountry,
      vatId: billingProfile?.vatNumber || null,
      vatIdValidated,
      ipCountry: req.headers['cf-ipcountry'] || req.headers['x-country'] || null,
    });

    return sendSuccess(res, priceBreakdown, 'Price calculated successfully');
  } catch (error) {
    logger.error('Calculate top-up error', {
      error: error.message,
      query: req.query,
    });
    next(error);
  }
}

/**
 * Create top-up checkout session
 * @route POST /billing/topup
 */
export async function createTopup(req, res, next) {
  try {
    const storeId = getStoreId(req);
    const shop = req.ctx?.store || null;
    const shopDomain = shop?.shopDomain;
    const { credits, successUrl, cancelUrl, currency: requestedCurrency } = req.body;

    const { isValidAbsoluteUrl } = await import('../utils/url-helpers.js');
    if (!isValidAbsoluteUrl(successUrl) || !isValidAbsoluteUrl(cancelUrl)) {
      return sendError(
        res,
        400,
        'INVALID_URL',
        'Success and cancel URLs must be valid absolute URLs.',
      );
    }

    const billingProfile = await getBillingProfile(storeId);
    const validCurrencies = ['EUR', 'USD'];
    let currency = 'EUR';
    if (
      requestedCurrency &&
      validCurrencies.includes(String(requestedCurrency).toUpperCase())
    ) {
      currency = String(requestedCurrency).toUpperCase();
    } else if (
      shop?.currency &&
      validCurrencies.includes(String(shop.currency).toUpperCase())
    ) {
      currency = String(shop.currency).toUpperCase();
    } else if (
      billingProfile?.currency &&
      validCurrencies.includes(String(billingProfile.currency).toUpperCase())
    ) {
      currency = String(billingProfile.currency).toUpperCase();
    }

    const billingCountry =
      billingProfile?.billingAddress?.country ||
      billingProfile?.vatCountry ||
      shop?.country ||
      null;
    const vatIdValidated = billingProfile?.taxStatus === 'verified';

    // Calculate price
    const priceBreakdown = calculateTopupPrice(credits, {
      currency,
      billingCountry,
      vatId: billingProfile?.vatNumber || null,
      vatIdValidated,
      ipCountry: req.headers['cf-ipcountry'] || req.headers['x-country'] || null,
    });

    const stripeCustomerId = await ensureStripeCustomer({
      shopId: storeId,
      shopDomain,
      shopName: shop?.shopName,
      currency,
      stripeCustomerId: shop?.stripeCustomerId,
      billingProfile,
    });

    // Create Stripe checkout session
    const session = await createCreditTopupCheckoutSession({
      shopId: storeId,
      shopDomain,
      credits,
      priceEur: priceBreakdown.totalPrice,
      currency,
      stripeCustomerId,
      successUrl,
      cancelUrl,
    });

    logger.info('Top-up checkout session created', {
      storeId,
      credits,
      sessionId: session.id,
    });

    return sendSuccess(
      res,
      {
        checkoutUrl: session.url,
        sessionId: session.id,
        credits,
        priceEur: priceBreakdown.totalPrice,
        priceBreakdown,
      },
      'Top-up checkout session created successfully',
      201,
    );
  } catch (error) {
    logger.error('Create top-up error', {
      error: error.message,
      storeId: getStoreId(req),
    });
    next(error);
  }
}

/**
 * Get transaction history
 * @route GET /billing/history
 */
export async function getHistory(req, res, next) {
  try {
    const storeId = getStoreId(req);
    const filters = {
      page: req.query.page,
      pageSize: req.query.pageSize,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const result = await billingService.getTransactionHistory(storeId, filters);

    return sendPaginated(res, result.transactions, result.pagination, {
      transactions: result.transactions, // Include for backward compatibility
    });
  } catch (error) {
    logger.error('Get transaction history error', {
      error: error.message,
      storeId: getStoreId(req),
      query: req.query,
    });
    next(error);
  }
}

/**
 * Get billing history (Stripe transactions)
 * @route GET /billing/billing-history
 */
export async function getBillingHistory(req, res, next) {
  try {
    const storeId = getStoreId(req);
    await logBillingDiagnostics({
      storeId,
      shopDomain: req.ctx?.store?.shopDomain,
      endpoint: 'billing-history',
    });

    // Validate query params
    const allowedStatuses = ['pending', 'completed', 'failed', 'refunded'];
    if (req.query.status && !allowedStatuses.includes(req.query.status)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_FILTER',
        message: `Invalid status filter. Allowed values: ${allowedStatuses.join(', ')}`,
        code: 'INVALID_FILTER',
        requestId: req.id,
      });
    }

    const filters = {
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
    };

    const result = await billingService.getBillingHistory(storeId, filters);

    return sendPaginated(res, result.transactions, result.pagination, {
      transactions: result.transactions, // Include for backward compatibility
    });
  } catch (error) {
    logger.error('Get billing history error', {
      error: error.message,
      storeId: getStoreId(req),
      query: req.query,
    });
    next(error);
  }
}

/**
 * Get billing summary (subscription + allowance + credits)
 * @route GET /billing/summary
 */
export async function getSummary(req, res, next) {
  try {
    const storeId = getStoreId(req);

    const { getBillingSummary } = await import('../services/subscription.js');
    const summary = await getBillingSummary(storeId);

    return sendSuccess(res, summary, 'Billing summary retrieved');
  } catch (error) {
    logger.error('Get billing summary error', {
      error: error.message,
      stack: error.stack,
      storeId: req.ctx?.store?.id,
    });
    next(error);
  }
}

/**
 * Get billing profile for shop
 * @route GET /billing/profile
 */
export async function getProfile(req, res, next) {
  try {
    const storeId = getStoreId(req);
    const profile = await getBillingProfile(storeId);
    if (!profile) {
      const shop = req.ctx?.store || null;
      return sendSuccess(
        res,
        {
          shopId: storeId,
          legalName: null,
          vatNumber: null,
          vatCountry: null,
          billingEmail: null,
          billingAddress: null,
          currency: shop?.currency || 'EUR',
          taxStatus: null,
          taxExempt: false,
        },
        'Billing profile retrieved',
      );
    }

    return sendSuccess(res, profile, 'Billing profile retrieved');
  } catch (error) {
    logger.error('Get billing profile error', {
      error: error.message,
      storeId: req.ctx?.store?.id,
    });
    next(error);
  }
}

/**
 * Update billing profile for shop
 * @route PUT /billing/profile
 */
export async function updateProfile(req, res, next) {
  try {
    const storeId = getStoreId(req);
    const shop = req.ctx?.store || null;
    const {
      legalName,
      vatNumber,
      vatCountry,
      billingEmail,
      billingAddress,
      currency,
      isBusiness,
      taxTreatment,
    } = req.body;

    const profile = await upsertBillingProfile(storeId, {
      legalName: legalName || null,
      vatNumber: vatNumber || null,
      vatCountry: vatCountry || null,
      billingEmail: billingEmail || null,
      billingAddress: billingAddress || null,
      currency: currency || undefined,
      isBusiness: isBusiness !== undefined ? Boolean(isBusiness) : undefined,
      taxTreatment: taxTreatment || null,
    });

    if (currency) {
      await prisma.shop.update({
        where: { id: storeId },
        data: { currency },
      });
    }

    const stripeCustomerId = await ensureStripeCustomer({
      shopId: storeId,
      shopDomain: shop?.shopDomain,
      shopName: shop?.shopName,
      currency: currency || shop?.currency || 'EUR',
      stripeCustomerId: shop?.stripeCustomerId,
      billingProfile: profile,
    });

    await syncStripeCustomerBillingProfile({
      stripeCustomerId,
      billingProfile: profile,
    });

    return sendSuccess(res, profile, 'Billing profile updated');
  } catch (error) {
    logger.error('Update billing profile error', {
      error: error.message,
      storeId: req.ctx?.store?.id,
    });
    next(error);
  }
}

/**
 * Sync billing profile from Stripe customer
 * @route POST /billing/profile/sync-from-stripe
 */
export async function syncProfileFromStripe(req, res, next) {
  try {
    const storeId = getStoreId(req);
    const shop = req.ctx?.store || (await prisma.shop.findUnique({
      where: { id: storeId },
      select: { id: true, stripeCustomerId: true },
    }));

    if (!shop?.stripeCustomerId) {
      return sendError(
        res,
        400,
        'MISSING_CUSTOMER_ID',
        'No Stripe customer found. Please subscribe to a plan first.',
      );
    }

    if (!stripe) {
      return sendError(
        res,
        503,
        'STRIPE_NOT_CONFIGURED',
        'Payment processing unavailable',
      );
    }

    // Fetch customer from Stripe
    let customer;
    try {
      customer = await stripe.customers.retrieve(shop.stripeCustomerId, {
        expand: ['tax_ids'],
      });
    } catch (err) {
      logger.error('Failed to retrieve Stripe customer', {
        storeId,
        customerId: shop.stripeCustomerId,
        error: err.message,
      });
      return sendError(
        res,
        404,
        'CUSTOMER_NOT_FOUND',
        'Stripe customer not found. Please contact support.',
      );
    }

    // Map Stripe customer to billing profile
    const taxId = customer.tax_ids?.data?.find((t) => t.type === 'eu_vat') || customer.tax_ids?.data?.[0];
    const address = customer.address;

    const profile = await upsertBillingProfile(storeId, {
      billingEmail: customer.email || null,
      legalName: customer.name || null,
      billingAddress: address
        ? {
          line1: address.line1 || null,
          line2: address.line2 || null,
          city: address.city || null,
          state: address.state || null,
          postalCode: address.postal_code || null,
          country: address.country || null,
        }
        : null,
      vatNumber: taxId?.value ? String(taxId.value).replace(/\s+/g, '').toUpperCase() : null,
      vatCountry: taxId?.country || address?.country || null,
    });

    // Also sync to Stripe customer (bidirectional sync)
    if (profile.billingEmail || profile.legalName || profile.billingAddress) {
      await syncStripeCustomerBillingProfile({
        stripeCustomerId: shop.stripeCustomerId,
        billingProfile: profile,
      });
    }

    logger.info('Billing profile synced from Stripe', {
      storeId,
      customerId: shop.stripeCustomerId,
      hasEmail: !!profile.billingEmail,
      hasName: !!profile.legalName,
      hasAddress: !!profile.billingAddress,
    });

    return sendSuccess(res, profile, 'Billing profile synced from Stripe');
  } catch (error) {
    logger.error('Sync billing profile from Stripe error', {
      error: error.message,
      storeId: req.ctx?.store?.id,
      stack: error.stack,
    });
    next(error);
  }
}

/**
 * List invoices for shop
 * @route GET /billing/invoices
 */
export async function getInvoices(req, res, next) {
  try {
    const storeId = getStoreId(req);
    await logBillingDiagnostics({
      storeId,
      shopDomain: req.ctx?.store?.shopDomain,
      endpoint: 'invoices',
    });
    const filters = {
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
    };

    const result = await listInvoices(storeId, filters);

    return sendPaginated(res, result.invoices, result.pagination, {
      invoices: result.invoices,
    });
  } catch (error) {
    logger.error('Get invoices error', {
      error: error.message,
      storeId: req.ctx?.store?.id,
      query: req.query,
    });
    next(error);
  }
}

export default {
  getBalance,
  getPackages,
  createPurchase,
  calculateTopup,
  createTopup,
  getHistory,
  getBillingHistory,
  getSummary,
  getProfile,
  updateProfile,
  getInvoices,
};
