import prisma from '../services/prisma.js';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';
import {
  verifyAppToken,
  verifyShopifySessionToken,
  generateAppToken,
} from '../services/auth.js';

/**
 * Store Resolution Middleware - Single Source of Truth
 *
 * This middleware extracts store information from various sources and ensures
 * all subsequent operations are scoped to the correct store (tenant).
 *
 * Sources (in order of precedence):
 * 1. X-Shopify-Shop-Domain header (PREFERRED - most reliable)
 * 2. JWT Token (Authorization: Bearer <token>) - App JWT or Shopify session token
 * 3. Query param `shop` (LAST RESORT - only for redirect/callback routes)
 *
 * Security: Shop domain must match pattern: [a-zA-Z0-9-]+\.myshopify\.com
 */

/**
 * Validate shop domain format strictly
 * @param {string} domain - Shop domain to validate
 * @returns {boolean} True if valid
 */
function isValidShopDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return false;
  }
  // Must match: alphanumeric, hyphens, ending with .myshopify.com
  const shopDomainPattern = /^[a-zA-Z0-9-]+\.myshopify\.com$/;
  return shopDomainPattern.test(domain.trim());
}

/**
 * Normalize shop domain (add .myshopify.com if missing)
 * @param {string} domain - Shop domain to normalize
 * @returns {string|null} Normalized domain or null if invalid
 */
function normalizeShopDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return null;
  }
  const trimmed = domain.trim();
  if (!trimmed) {
    return null;
  }
  // If already has .myshopify.com, validate and return
  if (trimmed.includes('.')) {
    return isValidShopDomain(trimmed) ? trimmed : null;
  }
  // Add .myshopify.com suffix
  const normalized = `${trimmed}.myshopify.com`;
  return isValidShopDomain(normalized) ? normalized : null;
}

/**
 * Check if route is a redirect/callback route (allows query param fallback)
 * @param {string} path - Request path
 * @returns {boolean} True if redirect/callback route
 */
function isRedirectRoute(path) {
  const redirectPaths = ['/auth/callback', '/auth/shopify', '/auth/shopify-token'];
  return redirectPaths.some(redirectPath => path.includes(redirectPath));
}

export async function resolveStore(req, res, next) {
  const requestId = req.id || req.headers['x-request-id'] || 'unknown';
  try {
    let storeId = null;
    let shopDomain = null;
    let store = null;
    let resolutionMethod = null;

    // Method 1: X-Shopify-Shop-Domain header (PREFERRED - highest priority)
    const headerShopDomain = req.headers['x-shopify-shop-domain'] || req.headers['x-shopify-shop'];
    if (headerShopDomain) {
      const normalized = normalizeShopDomain(headerShopDomain);
      if (normalized) {
        shopDomain = normalized;
        resolutionMethod = 'header';
        logger.debug('Shop domain from header', {
          requestId,
          shopDomain,
          header: req.headers['x-shopify-shop-domain'] ? 'x-shopify-shop-domain' : 'x-shopify-shop',
        });
      } else {
        logger.warn('Invalid shop domain format in header', {
          requestId,
          headerValue: headerShopDomain,
          path: req.path,
        });
      }
    }

    // Method 2: JWT Token Authentication (if header not provided)
    // Check Authorization header for Bearer token
    if (!shopDomain && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const token = req.headers.authorization.replace('Bearer ', '');

      try {
        // Try to verify as our app JWT token first
        const decoded = verifyAppToken(token);

        if (decoded.storeId) {
          storeId = decoded.storeId;
          store = await prisma.shop.findUnique({
            where: { id: storeId },
            include: { settings: true },
          });

          if (store) {
            shopDomain = store.shopDomain;
            resolutionMethod = 'jwt-storeId';
            logger.debug('Store resolved from app JWT token (storeId)', {
              requestId,
              storeId,
              shopDomain,
            });
          } else if (decoded.shopDomain) {
            // Store not found but token has shopDomain
            const normalized = normalizeShopDomain(decoded.shopDomain);
            if (normalized) {
              shopDomain = normalized;
              resolutionMethod = 'jwt-shopDomain';
              logger.debug('Using shopDomain from JWT token (store not found)', {
                requestId,
                shopDomain,
              });
            }
          }
        } else if (decoded.shopDomain) {
          // Token has shopDomain but no storeId
          const normalized = normalizeShopDomain(decoded.shopDomain);
          if (normalized) {
            shopDomain = normalized;
            resolutionMethod = 'jwt-shopDomain';
            logger.debug('Using shopDomain from JWT token (no storeId)', {
              requestId,
              shopDomain,
            });
          }
        }
      } catch (jwtError) {
        // Not our app token, might be Shopify session token from App Bridge
        logger.debug('App JWT token verification failed, trying Shopify session token', {
          requestId,
          error: jwtError.message,
        });

        try {
          const shopifySession = await verifyShopifySessionToken(token);
          const normalized = normalizeShopDomain(shopifySession.shop);
          
          if (normalized) {
            shopDomain = normalized;
            resolutionMethod = 'shopify-session-token';
            
            // Generate app token and get store
            const { store: storeFromToken } = await generateAppToken(shopifySession.shop);
            storeId = storeFromToken.id;

            store = await prisma.shop.findUnique({
              where: { id: storeId },
              include: { settings: true },
            });

            logger.debug('Store resolved from Shopify session token', {
              requestId,
              storeId,
              shopDomain,
            });
          }
        } catch (shopifyError) {
          // Neither token type worked
          logger.debug('Both token verification methods failed', {
            requestId,
            jwtError: jwtError.message,
            shopifyError: shopifyError.message,
          });
        }
      }
    }

    // Method 3: Query param `shop` (LAST RESORT - only for redirect/callback routes)
    if (!shopDomain && isRedirectRoute(req.path)) {
      const queryShop = req.query.shop || req.query.shop_domain;
      if (queryShop) {
        const normalized = normalizeShopDomain(queryShop);
        if (normalized) {
          shopDomain = normalized;
          resolutionMethod = 'query-param';
          logger.debug('Shop domain from query param (redirect route)', {
            requestId,
            shopDomain,
            path: req.path,
          });
        } else {
          logger.warn('Invalid shop domain format in query param', {
            requestId,
            queryValue: queryShop,
            path: req.path,
          });
        }
      }
    }

    // Final validation - shop domain is required
    if (!shopDomain || !isValidShopDomain(shopDomain)) {
      logger.error('Shop domain resolution failed', {
        requestId,
        method: req.method,
        path: req.path,
        url: req.url,
        hasHeader: !!req.headers['x-shopify-shop-domain'],
        hasToken: !!req.headers.authorization,
        isRedirectRoute: isRedirectRoute(req.path),
        headerValues: {
          'x-shopify-shop-domain': req.headers['x-shopify-shop-domain'],
          'x-shopify-shop': req.headers['x-shopify-shop'],
          authorization: req.headers.authorization ? 'Bearer ***' : undefined,
        },
        queryShop: req.query.shop,
      });

      // Set response headers
      res.setHeader('X-Astronote-Tenant-Required', 'true');
      res.setHeader('X-Request-ID', requestId);

      return res.status(400).json({
        success: false,
        error: 'Invalid shop domain',
        message:
          'Unable to determine shop domain from request. Please provide X-Shopify-Shop-Domain header or Bearer token.',
        code: 'INVALID_SHOP_DOMAIN',
        requestId,
        apiVersion: 'v1',
      });
    }

    // Fetch store from database (if not already fetched from token)
    if (!store && shopDomain) {
      try {
        store = await prisma.shop.findUnique({
          where: { shopDomain },
          include: {
            settings: true,
          },
        });

        if (store) {
          storeId = store.id;
          logger.debug('Store found in database', {
            requestId,
            storeId,
            shopDomain,
            resolutionMethod,
          });
        } else {
          // Auto-create store if it doesn't exist (only for certain routes)
          // Don't auto-create for most API routes - require proper installation
          if (isRedirectRoute(req.path) || resolutionMethod === 'shopify-session-token') {
            logger.info('Auto-creating new store', {
              requestId,
              shopDomain,
              resolutionMethod,
            });

            store = await prisma.shop.create({
              data: {
                shopDomain,
                shopName: shopDomain.replace('.myshopify.com', ''),
                accessToken: req.headers['x-shopify-access-token'] || 'pending',
                credits: 100, // Give some initial credits
                currency: 'EUR',
                status: 'active',
                settings: {
                  create: {
                    currency: 'EUR',
                    timezone: 'Europe/Athens',
                    senderNumber: process.env.MITTO_SENDER_NAME || 'Astronote',
                    senderName: process.env.MITTO_SENDER_NAME || 'Astronote',
                  },
                },
              },
              include: {
                settings: true,
              },
            });

            storeId = store.id;
          } else {
            logger.warn('Store not found and auto-create not allowed', {
              requestId,
              shopDomain,
              path: req.path,
              resolutionMethod,
            });
          }
        }
      } catch (dbError) {
        logger.error('Database error during store resolution', {
          requestId,
          shopDomain,
          error: dbError.message,
        });
        throw dbError;
      }
    }

    // Development-only methods removed for production

    // Method 5: Explicit store ID in headers (for internal services)
    if (!store && req.headers['x-store-id']) {
      storeId = req.headers['x-store-id'];
      store = await prisma.shop.findUnique({
        where: { id: storeId },
        include: {
          settings: true,
        },
      });

      if (store) {
        shopDomain = store.shopDomain;
      }
    }

    // Validation: Ensure store was found
    if (!store || !storeId) {
      logger.warn('Store resolution failed - store not found in database', {
        requestId,
        shopDomain,
        resolutionMethod,
        path: req.path,
        hasHeader: !!req.headers['x-shopify-shop-domain'],
        hasToken: !!req.headers.authorization,
      });

      res.setHeader('X-Astronote-Tenant-Required', 'true');
      res.setHeader('X-Request-ID', requestId);

      return res.status(401).json({
        success: false,
        error: 'Store not found',
        message:
          'Unable to resolve store context. Please ensure you are properly authenticated and the app is installed.',
        code: 'STORE_NOT_FOUND',
        requestId,
      });
    }

    // Attach store context to request
    req.ctx = {
      store: {
        id: store.id,
        shopDomain: store.shopDomain,
        credits: store.credits,
        currency: store.settings?.currency || 'EUR',
        timezone: store.settings?.timezone || 'UTC',
        senderNumber: store.settings?.senderNumber,
        senderName: store.settings?.senderName,
        settings: store.settings,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
      },
      resolutionMethod, // Track how store was resolved for debugging
    };

    // Add store context to logger for this request
    req.logger = logger;

    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);

    logger.debug('Store resolution successful', {
      requestId,
      storeId: store.id,
      shopDomain: store.shopDomain,
      resolutionMethod,
      path: req.path,
    });

    next();
  } catch (error) {
    const requestId = req.id || req.headers['x-request-id'] || 'unknown';
    logger.error('Store resolution middleware failed', {
      requestId,
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });

    res.setHeader('X-Astronote-Tenant-Required', 'true');
    res.setHeader('X-Request-ID', requestId);

    res.status(500).json({
      success: false,
      error: 'Store resolution failed',
      message: 'Internal error during store resolution',
      code: 'STORE_RESOLUTION_ERROR',
      requestId,
    });
  }
}

/**
 * Middleware to ensure store context exists
 * Use this on routes that require store context
 */
export function requireStore(req, res, next) {
  if (!req.ctx?.store?.id) {
    return res.status(401).json({
      success: false,
      error: 'Store context required',
      message:
        'This endpoint requires store context. Please ensure you are properly authenticated.',
      code: 'STORE_CONTEXT_REQUIRED',
    });
  }
  next();
}

/**
 * Helper to get store ID from request context
 */
export function getStoreId(req) {
  if (!req.ctx?.store?.id) {
    // Provide more context in error message
    const endpoint = req.originalUrl || req.url || 'unknown';
    const action = endpoint.includes('settings')
      ? 'fetch settings'
      : endpoint.includes('automations')
        ? 'fetch automations'
        : endpoint.includes('account')
          ? 'fetch account information'
          : 'access this resource';
    throw new ValidationError(
      `Shop context is required to ${action}. Please ensure you are properly authenticated.`,
      400,
    );
  }
  return req.ctx.store.id;
}

/**
 * Helper to get store domain from request context
 */
export function getStoreDomain(req) {
  if (!req.ctx?.store?.shopDomain) {
    throw new Error('Store context not available');
  }
  return req.ctx.store.shopDomain;
}

/**
 * Helper to get full store context
 */
export function getStoreContext(req) {
  if (!req.ctx?.store) {
    throw new Error('Store context not available');
  }
  return req.ctx.store;
}

export default {
  resolveStore,
  requireStore,
  getStoreId,
  getStoreDomain,
  getStoreContext,
};
