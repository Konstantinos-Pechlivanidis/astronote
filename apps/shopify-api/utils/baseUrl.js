import prisma from '../services/prisma.js';
import { logger } from './logger.js';

/**
 * Validate protocol to prevent header injection
 */
function isValidProtocol(proto) {
  return proto === 'http' || proto === 'https';
}

/**
 * Validate host to prevent header injection
 */
function isValidHost(host) {
  // Allow alphanumeric, dots, hyphens, colons (for ports)
  // Reject anything that looks like injection
  const hostRegex = /^[a-zA-Z0-9.-]+(:\d+)?$/;
  return hostRegex.test(host) && host.length <= 255;
}

/**
 * Normalize URL (remove trailing slashes)
 */
function normalizeUrl(url) {
  if (!url) return url;
  return url.trim().replace(/\/+$/, '');
}

/**
 * Get base URL for the application
 * Priority:
 * 1. Per-tenant override (from DB, if shopId provided)
 * 2. Proxy headers (X-Forwarded-Proto, X-Forwarded-Host)
 * 3. PUBLIC_BASE_URL env var
 * 4. HOST env var (fallback)
 *
 * @param {Object} req - Express request object
 * @param {string} shopId - Optional shop ID for tenant-specific URL
 * @returns {Promise<string>} Base URL (e.g., "https://api.example.com")
 */
export async function getBaseUrl(req, shopId = null) {
  // 1. Check per-tenant override (if shopId provided)
  if (shopId) {
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        include: { settings: true },
      });
      if (shop?.settings?.baseUrl) {
        const url = normalizeUrl(shop.settings.baseUrl);
        // Validate URL to prevent injection
        if (isValidHost(new URL(url).hostname)) {
          logger.debug('Using per-tenant base URL', { shopId, url });
          return url;
        } else {
          logger.warn('Invalid baseUrl in shop settings, ignoring', { shopId, url });
        }
      }
    } catch (error) {
      logger.warn('Error fetching shop settings for base URL', {
        shopId,
        error: error.message,
      });
      // Continue to fallback methods
    }
  }

  // 2. Check proxy headers (trust proxy enabled in app.js)
  const forwardedProto = req?.get?.('X-Forwarded-Proto');
  const forwardedHost = req?.get?.('X-Forwarded-Host');
  if (forwardedProto && forwardedHost) {
    // Validate to prevent header injection
    if (isValidProtocol(forwardedProto) && isValidHost(forwardedHost)) {
      const url = `${forwardedProto}://${forwardedHost}`;
      logger.debug('Using proxy header base URL', { url });
      return url;
    } else {
      logger.warn('Invalid proxy headers, ignoring', {
        proto: forwardedProto,
        host: forwardedHost,
      });
    }
  }

  // 3. Check PUBLIC_BASE_URL env var
  if (process.env.PUBLIC_BASE_URL) {
    const url = normalizeUrl(process.env.PUBLIC_BASE_URL);
    logger.debug('Using PUBLIC_BASE_URL env var', { url });
    return url;
  }

  // 4. Fallback to HOST env var
  if (process.env.HOST) {
    const url = normalizeUrl(process.env.HOST);
    logger.debug('Using HOST env var', { url });
    return url;
  }

  // 5. Last resort: construct from request
  if (req) {
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get?.('Host') || 'localhost:8080';
    const url = `${protocol}://${host}`;
    logger.debug('Using request-derived base URL', { url });
    return url;
  }

  // 6. Final fallback
  logger.warn('No base URL could be determined, using localhost');
  return 'http://localhost:8080';
}

/**
 * Synchronous version for cases where req is not available
 * Uses only env vars (no proxy headers, no per-tenant override)
 */
export function getBaseUrlSync() {
  if (process.env.PUBLIC_BASE_URL) {
    return normalizeUrl(process.env.PUBLIC_BASE_URL);
  }
  if (process.env.HOST) {
    return normalizeUrl(process.env.HOST);
  }
  return 'http://localhost:8080';
}

