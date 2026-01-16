import { logger } from './logger.js';
import crypto from 'crypto';
import { createShortLink } from '../services/shortLinks.js';
import { sha256Hex } from './redisSafe.js';

/**
 * URL Shortening Service
 * Supports multiple strategies:
 * 1. Backend-driven shortener (using database, recommended)
 * 2. Custom shortener (using base64url encoding, legacy)
 * 3. External services (Bitly, TinyURL, etc.)
 * 4. Fallback to original URL if shortening fails
 */

const SHORTENER_TYPE = process.env.URL_SHORTENER_TYPE || 'custom'; // 'custom', 'bitly', 'tinyurl', 'none' (backend is deprecated, use 'custom')
const SHORTENER_BASE_URL = process.env.URL_SHORTENER_BASE_URL || process.env.FRONTEND_URL || 'https://astronote-shopify-frontend.onrender.com';
const BITLY_API_TOKEN = process.env.BITLY_API_TOKEN;
const TINYURL_API_KEY = process.env.TINYURL_API_KEY;

function withTimeout(promise, ms, label = 'operation') {
  const timeoutMs = Number(ms);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 1200) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Generate a short code for custom URL shortener (legacy)
 * @param {string} originalUrl - Original URL to shorten
 * @returns {string} Short code (base64url encoded hash)
 */
function generateShortCode(originalUrl) {
  // Create a hash of the URL for consistent short codes
  const hash = crypto.createHash('sha256').update(originalUrl).digest('hex');
  // Use first 8 characters of hash, encode to base64url for URL safety
  const shortCode = Buffer.from(hash.substring(0, 8), 'hex').toString('base64url').substring(0, 8);
  return shortCode;
}

/**
 * Shorten URL using backend-driven shortener (database-backed)
 * @param {string} originalUrl - Original URL to shorten
 * @param {Object} [options] - Optional parameters
 * @param {string} [options.shopId] - Shop ID for tenant scoping
 * @param {string} [options.campaignId] - Campaign ID
 * @param {string} [options.contactId] - Contact ID
 * @returns {Promise<string>} Shortened URL
 */
async function shortenBackend(originalUrl, options = {}) {
  try {
    const timeoutMs = Number(process.env.URL_SHORTENER_TIMEOUT_MS || 1200);
    const shortLink = await withTimeout(
      createShortLink({
        destinationUrl: originalUrl,
        shopId: options.shopId || null,
        campaignId: options.campaignId || null,
        contactId: options.contactId || null,
      }),
      timeoutMs,
      'createShortLink(urlShortener)',
    );
    logger.info(
      {
        inputHash: sha256Hex(originalUrl).slice(0, 12),
        shortHash: sha256Hex(shortLink.shortUrl).slice(0, 8),
        shopId: options.shopId || null,
        campaignId: options.campaignId || null,
        cacheHit: false,
        idempotencyKey: sha256Hex(`${options.shopId || 'na'}:${originalUrl}`).slice(0, 12),
      },
      'Shortlink generated (backend)',
    );
    return shortLink.shortUrl;
  } catch (error) {
    logger.warn({ err: error.message, originalUrl }, 'Failed to create backend short link, falling back');
    return originalUrl; // Fallback to original
  }
}

/**
 * Shorten URL using custom shortener (base64url encoding, legacy)
 * @param {string} originalUrl - Original URL to shorten
 * @returns {string} Shortened URL
 */
function shortenCustom(originalUrl) {
  try {
    const shortCode = generateShortCode(originalUrl);
    // Ensure base URL doesn't have trailing slash
    const baseUrl = SHORTENER_BASE_URL.replace(/\/$/, '');
    return `${baseUrl}/s/${shortCode}`;
  } catch (error) {
    logger.warn({ err: error.message, originalUrl }, 'Failed to generate custom short URL');
    return originalUrl; // Fallback to original
  }
}

/**
 * Shorten URL using Bitly API
 * @param {string} originalUrl - Original URL to shorten
 * @returns {Promise<string>} Shortened URL
 */
async function shortenBitly(originalUrl) {
  if (!BITLY_API_TOKEN) {
    logger.warn('Bitly API token not configured, falling back to custom shortener');
    return shortenCustom(originalUrl);
  }

  try {
    const timeoutMs = Number(process.env.URL_SHORTENER_TIMEOUT_MS || 1200);
    const response = await fetchWithTimeout('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BITLY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ long_url: originalUrl }),
    }, timeoutMs);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bitly API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.link || originalUrl;
  } catch (error) {
    logger.warn({ err: error.message, originalUrl }, 'Bitly shortening failed, falling back to custom');
    return shortenCustom(originalUrl);
  }
}

/**
 * Shorten URL using TinyURL API
 * @param {string} originalUrl - Original URL to shorten
 * @returns {Promise<string>} Shortened URL
 */
async function shortenTinyURL(originalUrl) {
  if (!TINYURL_API_KEY) {
    logger.warn('TinyURL API key not configured, falling back to custom shortener');
    return shortenCustom(originalUrl);
  }

  try {
    const timeoutMs = Number(process.env.URL_SHORTENER_TIMEOUT_MS || 1200);
    const response = await fetchWithTimeout('https://api.tinyurl.com/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TINYURL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: originalUrl }),
    }, timeoutMs);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TinyURL API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.data?.tiny_url || originalUrl;
  } catch (error) {
    logger.warn({ err: error.message, originalUrl }, 'TinyURL shortening failed, falling back to custom');
    return shortenCustom(originalUrl);
  }
}

/**
 * Shorten a single URL
 * @param {string} originalUrl - Original URL to shorten
 * @param {Object} [options] - Optional parameters for backend shortener
 * @param {string} [options.shopId] - Shop ID for tenant scoping
 * @param {string} [options.campaignId] - Campaign ID
 * @param {string} [options.contactId] - Contact ID
 * @returns {Promise<string>} Shortened URL (or original if shortening disabled/failed)
 */
export async function shortenUrl(originalUrl, options = {}) {
  if (!originalUrl || typeof originalUrl !== 'string') {
    return originalUrl;
  }

  // If shortening is disabled, return original
  if (SHORTENER_TYPE === 'none') {
    return originalUrl;
  }

  // Skip shortening if URL is already short (heuristic: less than 50 chars)
  if (originalUrl.length < 50) {
    return originalUrl;
  }

  try {
    switch (SHORTENER_TYPE) {
    case 'custom':
      // 'custom' uses backend shortener (database-backed) for production
      // Fallback to custom encoding if backend fails
      try {
        return await shortenBackend(originalUrl, options);
      } catch (err) {
        logger.warn({ err: err.message }, 'Backend shortener failed, using custom encoding');
        return shortenCustom(originalUrl);
      }
    case 'bitly':
      return await shortenBitly(originalUrl);
    case 'tinyurl':
      return await shortenTinyURL(originalUrl);
    default:
      return shortenCustom(originalUrl);
    }
  } catch (error) {
    logger.error({ err: error.message, originalUrl, type: SHORTENER_TYPE }, 'URL shortening failed, using original');
    return originalUrl; // Always fallback to original URL
  }
}

/**
 * Shorten all URLs found in a text string
 * Finds URLs using regex and replaces them with shortened versions
 * @param {string} text - Text containing URLs
 * @param {Object} [options] - Optional parameters for backend shortener
 * @param {string} [options.shopId] - Shop ID for tenant scoping
 * @param {string} [options.campaignId] - Campaign ID
 * @param {string} [options.contactId] - Contact ID
 * @returns {Promise<string>} Text with shortened URLs
 */
export async function shortenUrlsInText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Regex to find URLs (http://, https://, www.)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const urls = text.match(urlRegex);

  if (!urls || urls.length === 0) {
    return text; // No URLs found
  }

  let result = text;
  const urlMap = new Map(); // Cache to avoid shortening same URL multiple times

  // Process all URLs in parallel
  const shortenPromises = urls.map(async (url) => {
    // Normalize URL (add https:// if missing)
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    // CRITICAL: Never shorten unsubscribe URLs
    // Unsubscribe URLs contain /shopify/unsubscribe/ and must remain intact
    // because they are signed tokens that need to be verified by the backend
    if (normalizedUrl.includes('/shopify/unsubscribe/') || normalizedUrl.includes('/unsubscribe/')) {
      return { original: url, shortened: url }; // Return unchanged
    }

    // Check cache first
    if (urlMap.has(normalizedUrl)) {
      return { original: url, shortened: urlMap.get(normalizedUrl) };
    }

    // Shorten URL with options
    const shortened = await shortenUrl(normalizedUrl, options);
    urlMap.set(normalizedUrl, shortened);

    return { original: url, shortened };
  });

  const results = await Promise.all(shortenPromises);

  // Replace all occurrences of each URL
  results.forEach(({ original, shortened }) => {
    // Escape special regex characters in original URL
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedOriginal, 'g'), shortened);
  });

  return result;
}

/**
 * Shorten URLs in a message (synchronous version for backward compatibility)
 * This is a wrapper that processes URLs but doesn't block
 * @param {string} message - Message text
 * @returns {Promise<string>} Message with shortened URLs
 */
export async function shortenMessageUrls(message) {
  return await shortenUrlsInText(message);
}

export default {
  shortenUrl,
  shortenUrlsInText,
  shortenMessageUrls,
};
