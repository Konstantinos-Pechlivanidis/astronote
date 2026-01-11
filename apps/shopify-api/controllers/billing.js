import { getStoreId } from '../middlewares/store-resolution.js';
import { logger } from '../utils/logger.js';
import billingService from '../services/billing.js';
import { getSubscriptionStatus } from '../services/subscription.js';
import { calculateTopupPrice } from '../services/subscription.js';
import { createCreditTopupCheckoutSession } from '../services/stripe.js';
import prisma from '../services/prisma.js';
import { sendSuccess, sendPaginated, sendError } from '../utils/response.js';
import crypto from 'crypto';

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

    if (!credits || !Number.isInteger(credits) || credits <= 0) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Credits must be a positive integer',
      );
    }

    const priceBreakdown = calculateTopupPrice(credits);

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
    const shopDomain = req.ctx?.store?.shopDomain;
    const { credits, successUrl, cancelUrl } = req.body;

    // Calculate price
    const priceBreakdown = calculateTopupPrice(credits);

    // Create Stripe checkout session
    const session = await createCreditTopupCheckoutSession({
      shopId: storeId,
      shopDomain,
      credits,
      priceEur: priceBreakdown.priceEurWithVat,
      currency: 'EUR',
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
        priceEur: priceBreakdown.priceEurWithVat,
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

export default {
  getBalance,
  getPackages,
  createPurchase,
  calculateTopup,
  createTopup,
  getHistory,
  getBillingHistory,
  getSummary,
};
