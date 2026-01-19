// apps/api/src/services/urlShortener.service.js
const { nanoid } = require('nanoid');
const prisma = require('../lib/prisma');
const pino = require('pino');

const logger = pino({ name: 'url-shortener-service' });

/**
 * URL Shortening Service
 * Supports multiple strategies:
 * 1. Custom shortener (using base64url encoding)
 * 2. External services (Bitly, TinyURL, etc.)
 * 3. Fallback to original URL if shortening fails
 */

const SHORTENER_TYPE = process.env.URL_SHORTENER_TYPE || 'custom'; // 'custom', 'bitly', 'tinyurl', 'none'
const SHORTENER_BASE_URL =
  process.env.PUBLIC_RETAIL_BASE_URL ||
  process.env.PUBLIC_WEB_BASE_URL ||
  process.env.URL_SHORTENER_BASE_URL ||
  process.env.FRONTEND_URL ||
  'https://astronote.onrender.com';
const BITLY_API_TOKEN = process.env.BITLY_API_TOKEN;
const TINYURL_API_KEY = process.env.TINYURL_API_KEY;
const URL_SHORTENER_TIMEOUT_MS = Number(process.env.URL_SHORTENER_TIMEOUT_MS || 1200);

function withTimeout(promise, ms, label = 'operation') {
  const timeoutMs = Number(ms);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

async function fetchWithTimeout(fetchFn, url, init = {}, timeoutMs = 1200) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// Helper function to ensure base URL includes /retail path
function normalizeBase(url) {
  if (!url) {return '';}
  return url.trim().replace(/\/$/, '');
}

/**
 * Generate a short code for custom URL shortener
 * @param {string} originalUrl - Original URL to shorten
 * @returns {string} Short code (base64url encoded hash)
 */
function generateShortCode() {
  return nanoid(8);
}

/**
 * Shorten URL using custom shortener (base64url encoding)
 * @param {string} originalUrl - Original URL to shorten
 * @returns {string} Shortened URL
 */
async function shortenCustom(originalUrl, opts = {}) {
  try {
    const shortCode = opts.shortCode || generateShortCode();
    const baseUrl = normalizeBase(SHORTENER_BASE_URL);
    const shortUrl = `${baseUrl}/s/${shortCode}`;

    // Persist mapping
    await withTimeout(
      prisma.shortLink.upsert({
        where: { shortCode },
        update: {
          originalUrl,
          targetUrl: opts.targetUrl || originalUrl,
          kind: opts.kind || null,
          ownerId: opts.ownerId || null,
          campaignId: opts.campaignId || null,
          type: opts.type || null,
        },
        create: {
          shortCode,
          originalUrl,
          targetUrl: opts.targetUrl || originalUrl,
          kind: opts.kind || null,
          ownerId: opts.ownerId || null,
          campaignId: opts.campaignId || null,
          type: opts.type || null,
        },
      }),
      URL_SHORTENER_TIMEOUT_MS,
      'prisma.shortLink.upsert',
    );

    return shortUrl;
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
    // Use built-in fetch (Node.js 18+) or fallback to node-fetch
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    const response = await fetchWithTimeout(fetchFn, 'https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BITLY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ long_url: originalUrl }),
    }, URL_SHORTENER_TIMEOUT_MS);

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
    // Use built-in fetch (Node.js 18+) or fallback to node-fetch
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    const response = await fetchWithTimeout(fetchFn, 'https://api.tinyurl.com/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TINYURL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: originalUrl }),
    }, URL_SHORTENER_TIMEOUT_MS);

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
 * @returns {Promise<string>} Shortened URL (or original if shortening disabled/failed)
 */
async function shortenUrl(originalUrl, opts = {}) {
  if (!originalUrl || typeof originalUrl !== 'string') {
    return originalUrl;
  }

  // If shortening is disabled, return original
  if (SHORTENER_TYPE === 'none') {
    return originalUrl;
  }

  const forceShort = Boolean(opts.forceShort);

  // Skip shortening if URL is already short (heuristic: less than 50 chars)
  if (!forceShort && originalUrl.length < 50) {
    return originalUrl;
  }

  try {
    switch (SHORTENER_TYPE) {
    case 'bitly':
      return await shortenBitly(originalUrl);
    case 'tinyurl':
      return await shortenTinyURL(originalUrl);
    case 'custom':
    default:
      return shortenCustom(originalUrl, opts);
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
 * @returns {Promise<string>} Text with shortened URLs
 */
async function shortenUrlsInText(text) {
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

    // Never shorten unsubscribe URLs here; unsubscribe is handled explicitly elsewhere
    if (normalizedUrl.includes('/unsubscribe/')) {
      return { original: url, shortened: url };
    }

    // Check cache first
    if (urlMap.has(normalizedUrl)) {
      return { original: url, shortened: urlMap.get(normalizedUrl) };
    }

    // Shorten URL
    const shortened = await shortenUrl(normalizedUrl);
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
 * Shorten URLs in a message (wrapper for backward compatibility)
 * @param {string} message - Message text
 * @returns {Promise<string>} Message with shortened URLs
 */
async function shortenMessageUrls(message) {
  return await shortenUrlsInText(message);
}

module.exports = {
  shortenUrl,
  shortenUrlsInText,
  shortenMessageUrls,
};
