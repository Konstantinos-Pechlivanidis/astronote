import { getStoreId } from '../middlewares/store-resolution.js';
import { logger } from '../utils/logger.js';
import billingService from '../services/billing.js';
import prisma from '../services/prisma.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

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

    const packages = billingService.getPackages(finalCurrency);

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
 * @route GET /billing/packages
 */
export async function getPackages(req, res, next) {
  try {
    const storeId = getStoreId(req);

    // Get currency from query param or shop/settings currency
    const requestedCurrency = req.query.currency;
    const validCurrencies = ['EUR', 'USD'];

    // Validate requested currency if provided
    let currency = 'EUR';
    if (requestedCurrency && validCurrencies.includes(requestedCurrency.toUpperCase())) {
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

      if (shop?.currency && validCurrencies.includes(shop.currency.toUpperCase())) {
        currency = shop.currency.toUpperCase();
      } else if (shop?.settings?.currency && validCurrencies.includes(shop.settings.currency.toUpperCase())) {
        currency = shop.settings.currency.toUpperCase();
      }
    }

    const packages = billingService.getPackages(currency);

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
 * Create Stripe checkout session for credit purchase
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
      storeContext: req.ctx?.store ? {
        id: req.ctx.store.id,
        shopDomain: req.ctx.store.shopDomain,
      } : null,
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

    const { packageId, successUrl, cancelUrl, currency } = req.body;

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

    logger.info('Creating purchase session', {
      storeId,
      packageId,
      currency: currency || 'EUR',
      successUrl,
      cancelUrl,
    });

    // Create Stripe checkout session
    const session = await billingService.createPurchaseSession(
      storeId,
      packageId,
      { successUrl, cancelUrl },
      currency, // Pass currency if provided
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

export default {
  getBalance,
  getPackages,
  createPurchase,
  getHistory,
  getBillingHistory,
};
