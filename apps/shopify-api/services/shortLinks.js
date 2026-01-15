import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';
import crypto from 'crypto';
import { getFrontendBaseUrlSync } from '../utils/frontendUrl.js';

/**
 * Short Link Service
 * Handles creation and management of short links for URL shortening
 */

export function getShortLinkBaseUrl() {
  return (
    process.env.URL_SHORTENER_BASE_URL ||
    process.env.FRONTEND_URL ||
    getFrontendBaseUrlSync() ||
    process.env.HOST ||
    'https://astronote.onrender.com'
  );
}

export function buildShortUrl(token) {
  const baseUrl = getShortLinkBaseUrl();
  return `${baseUrl.replace(/\/+$/, '')}/r/${token}`;
}

/**
 * Generate a unique token for short links
 * Uses crypto.randomBytes for secure random generation
 * @param {number} length - Token length (default: 10)
 * @returns {string} URL-safe token
 */
function generateToken(length = 10) {
  // Generate random bytes and convert to base64url (URL-safe)
  const bytes = crypto.randomBytes(Math.ceil(length * 0.75)); // 0.75 ratio for base64
  return bytes.toString('base64url').substring(0, length);
}

/**
 * Validate destination URL for security
 * @param {string} url - URL to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateDestinationUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // Parse URL
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Must be HTTPS (or HTTP for localhost in development)
  if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
    return { valid: false, error: 'URL must use https:// or http:// protocol' };
  }

  // In production, only allow HTTPS
  if (process.env.NODE_ENV === 'production' && urlObj.protocol !== 'https:') {
    return { valid: false, error: 'URL must use https:// in production' };
  }

  // Check allowlist if configured
  const allowedHosts = process.env.REDIRECT_ALLOWED_HOSTS;
  if (allowedHosts) {
    const hosts = allowedHosts.split(',').map(h => h.trim());
    const hostname = urlObj.hostname;

    // Check if hostname matches any allowed pattern
    const isAllowed = hosts.some(pattern => {
      // Remove protocol if present (e.g., "https://example.com" -> "example.com")
      const cleanPattern = pattern.replace(/^https?:\/\//, '').replace(/\/$/, '');
      // Support wildcards like *.myshopify.com
      if (cleanPattern.startsWith('*.')) {
        const domain = cleanPattern.substring(2);
        return hostname.endsWith(`.${domain}`) || hostname === domain;
      }
      return hostname === cleanPattern;
    });

    if (!isAllowed) {
      return {
        valid: false,
        error: `Hostname ${hostname} is not in allowed list`,
      };
    }
  }

  return { valid: true };
}

/**
 * Create a short link
 * @param {Object} params - Short link parameters
 * @param {string} params.destinationUrl - Destination URL to redirect to
 * @param {string} [params.shopId] - Optional shop ID for tenant scoping
 * @param {string} [params.campaignId] - Optional campaign ID
 * @param {string} [params.contactId] - Optional contact ID
 * @param {Date} [params.expiresAt] - Optional expiration date
 * @param {Object} [params.meta] - Optional metadata
 * @returns {Promise<Object>} Created short link with token and shortUrl
 */
export async function createShortLink({
  destinationUrl,
  shopId = null,
  campaignId = null,
  contactId = null,
  expiresAt = null,
  meta = null,
}) {
  // Validate destination URL
  const validation = validateDestinationUrl(destinationUrl);
  if (!validation.valid) {
    throw new ValidationError(validation.error);
  }

  // Generate unique token (retry if collision)
  let token;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    token = generateToken(10);

    // Check if token already exists
    const existing = await prisma.shortLink.findUnique({
      where: { token },
      select: { id: true },
    });

    if (!existing) {
      break; // Token is unique
    }

    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique token after multiple attempts');
    }
  }

  // Create short link
  const shortLink = await prisma.shortLink.create({
    data: {
      token,
      destinationUrl,
      shopId,
      campaignId,
      contactId,
      expiresAt,
      meta: meta || undefined,
    },
  });

  // Generate short URL
  const shortUrl = buildShortUrl(token);

  logger.info('Short link created', {
    token,
    shopId,
    campaignId,
    destinationUrl: `${destinationUrl.substring(0, 50)}...`,
  });

  return {
    id: shortLink.id,
    token: shortLink.token,
    shortUrl,
    destinationUrl: shortLink.destinationUrl,
    clicks: shortLink.clicks,
    createdAt: shortLink.createdAt,
    expiresAt: shortLink.expiresAt,
  };
}

/**
 * Get short link by token
 * @param {string} token - Short link token
 * @returns {Promise<Object|null>} Short link or null if not found
 */
export async function getShortLinkByToken(token) {
  return await prisma.shortLink.findUnique({
    where: { token },
  });
}

/**
 * Increment click count for a short link
 * @param {string} token - Short link token
 * @returns {Promise<Object>} Updated short link
 */
export async function incrementClickCount(token) {
  return await prisma.shortLink.update({
    where: { token },
    data: {
      clicks: { increment: 1 },
      lastClickedAt: new Date(),
    },
  });
}

/**
 * Get short link statistics
 * @param {string} shopId - Shop ID
 * @param {string} [campaignId] - Optional campaign ID
 * @returns {Promise<Object>} Statistics
 */
export async function getShortLinkStats(shopId, campaignId = null) {
  const where = { shopId };
  if (campaignId) {
    where.campaignId = campaignId;
  }

  const [total, totalClicks] = await Promise.all([
    prisma.shortLink.count({ where }),
    prisma.shortLink.aggregate({
      where,
      _sum: { clicks: true },
    }),
  ]);

  return {
    total,
    totalClicks: totalClicks._sum.clicks || 0,
  };
}

