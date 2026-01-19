// apps/api/src/services/urlShortener.service.js
const { nanoid } = require('nanoid');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const pino = require('pino');

const logger = pino({ name: 'url-shortener-service' });

const SHORTENER_TYPE = process.env.URL_SHORTENER_TYPE || 'custom'; // 'custom', 'bitly', 'tinyurl', 'none'
const PUBLIC_WEB_BASE =
  process.env.PUBLIC_WEB_BASE_URL ||
  process.env.PUBLIC_RETAIL_BASE_URL ||
  process.env.URL_SHORTENER_BASE_URL ||
  process.env.FRONTEND_URL ||
  'https://astronote.onrender.com';
const BITLY_API_TOKEN = process.env.BITLY_API_TOKEN;
const TINYURL_API_KEY = process.env.TINYURL_API_KEY;
const URL_SHORTENER_TIMEOUT_MS = Number(process.env.URL_SHORTENER_TIMEOUT_MS || 1200);
const MEMORY_CACHE_LIMIT = 500;

const memoryCache = new Map();

class ShortenerError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'ShortenerError';
    this.code = 'SHORTENER_FAILED';
    Object.assign(this, meta);
  }
}

function withTimeout(promise, ms, label = 'operation') {
  const timeoutMs = Number(ms);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new ShortenerError(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
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

// Helper function to ensure base URL includes no trailing slash
function normalizeBase(url) {
  if (!url) {return '';}
  let out = url.trim();
  out = out.replace(/\/+$/, '');
  // strip trailing /api to avoid mispointing short links
  if (out.toLowerCase().endsWith('/api')) {
    out = out.slice(0, -4);
    logger.warn({ base: url }, 'SHORTENER_BASE_URL contained /api; stripped for short links');
  }
  return out;
}

function normalizeUrl(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }
  let working = input.trim();
  if (!working) {
    return null;
  }

  try {
    // Default protocol to https for bare domains
    if (!/^https?:\/\//i.test(working)) {
      working = `https://${working}`;
    }

    const url = new URL(working);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();

    // Collapse duplicate slashes, keep a single trailing slash only for root
    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }

    // Sort query params for stable hashing
    const sortedParams = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    url.search = sortedParams.length
      ? `?${sortedParams.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
      : '';

    return url.toString();
  } catch (err) {
    logger.warn({ err: err?.message || String(err), input }, 'Failed to normalize URL');
    return null;
  }
}

function hashUrl(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function cacheKey({ ownerId, kind, hash }) {
  return `${ownerId ?? 'na'}|${kind || 'generic'}|${hash}`;
}

function remember(key, value) {
  memoryCache.set(key, value);
  if (memoryCache.size > MEMORY_CACHE_LIMIT) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  return value;
}

function buildShortUrl(shortCode) {
  const baseUrl = normalizeBase(PUBLIC_WEB_BASE);
  return `${baseUrl}/s/${shortCode}`;
}

function generateShortCode() {
  return nanoid(8);
}

async function getOrCreateShortLink(originalUrl, opts = {}) {
  const normalized = normalizeUrl(originalUrl);
  if (!normalized) {
    throw new ShortenerError('Invalid URL for shortening', { originalUrl });
  }

  const hash = hashUrl(normalized);
  const ownerId = opts.ownerId ?? null;
  const kind = opts.kind || 'generic';
  const targetUrl = opts.targetUrl || normalized;
  const cache = memoryCache.get(cacheKey({ ownerId, kind, hash }));
  if (cache) {
    return cache;
  }

  const where = { ownerId, kind, longUrlHash: hash };
  const existing = await prisma.shortLink.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    const shortUrl = buildShortUrl(existing.shortCode);
    remember(cacheKey({ ownerId, kind, hash }), shortUrl);
    prisma.shortLink.update({
      where: { id: existing.id },
      data: {
        lastUsedAt: new Date(),
        targetUrl,
        originalUrl: normalized,
        longUrlNormalized: normalized,
      },
    }).catch(() => {});
    return shortUrl;
  }

  const shortCode = opts.shortCode || generateShortCode();
  const data = {
    shortCode,
    kind,
    ownerId,
    campaignId: opts.campaignId || null,
    campaignMessageId: opts.campaignMessageId || null,
    originalUrl: normalized,
    targetUrl,
    longUrlHash: hash,
    longUrlNormalized: normalized,
    lastUsedAt: new Date(),
  };

  try {
    const created = await withTimeout(
      prisma.shortLink.create({ data }),
      URL_SHORTENER_TIMEOUT_MS,
      'prisma.shortLink.create',
    );
    const shortUrl = buildShortUrl(created.shortCode);
    remember(cacheKey({ ownerId, kind, hash }), shortUrl);
    return shortUrl;
  } catch (error) {
    if (error?.code === 'P2002') {
      const retry = await prisma.shortLink.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
      });
      if (retry) {
        const shortUrl = buildShortUrl(retry.shortCode);
        remember(cacheKey({ ownerId, kind, hash }), shortUrl);
        return shortUrl;
      }
    }
    throw new ShortenerError(error?.message || 'Failed to create short link', { cause: error });
  }
}

async function shortenCustom(originalUrl, opts = {}) {
  return getOrCreateShortLink(originalUrl, opts);
}

async function shortenBitly(originalUrl, opts = {}) {
  if (!BITLY_API_TOKEN) {
    logger.warn('Bitly API token not configured, falling back to custom shortener');
    return shortenCustom(originalUrl, opts);
  }

  try {
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    const response = await fetchWithTimeout(
      fetchFn,
      'https://api-ssl.bitly.com/v4/shorten',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BITLY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ long_url: originalUrl }),
      },
      URL_SHORTENER_TIMEOUT_MS,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ShortenerError(`Bitly API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.link || shortenCustom(originalUrl, opts);
  } catch (error) {
    logger.warn({ err: error?.message || String(error), originalUrl }, 'Bitly shortening failed, falling back to custom');
    return shortenCustom(originalUrl, opts);
  }
}

async function shortenTinyURL(originalUrl, opts = {}) {
  if (!TINYURL_API_KEY) {
    logger.warn('TinyURL API key not configured, falling back to custom shortener');
    return shortenCustom(originalUrl, opts);
  }

  try {
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    const response = await fetchWithTimeout(
      fetchFn,
      'https://api.tinyurl.com/create',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TINYURL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: originalUrl }),
      },
      URL_SHORTENER_TIMEOUT_MS,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ShortenerError(`TinyURL API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.data?.tiny_url || shortenCustom(originalUrl, opts);
  } catch (error) {
    logger.warn({ err: error?.message || String(error), originalUrl }, 'TinyURL shortening failed, falling back to custom');
    return shortenCustom(originalUrl, opts);
  }
}

async function shortenUrl(originalUrl, opts = {}) {
  const requireShort = Boolean(opts.requireShort);
  const normalized = normalizeUrl(originalUrl);

  if (!normalized) {
    if (requireShort) {
      throw new ShortenerError('Invalid URL input', { originalUrl });
    }
    return originalUrl;
  }

  if (SHORTENER_TYPE === 'none') {
    if (requireShort) {
      throw new ShortenerError('Shortening is disabled', { originalUrl });
    }
    return normalized;
  }

  const forceShort = Boolean(opts.forceShort || requireShort);

  if (!forceShort && normalized.length < 50) {
    return normalized;
  }

  try {
    switch (SHORTENER_TYPE) {
    case 'bitly':
      return await shortenBitly(normalized, opts);
    case 'tinyurl':
      return await shortenTinyURL(normalized, opts);
    case 'custom':
    default:
      return await shortenCustom(normalized, opts);
    }
  } catch (error) {
    const shortErr = error instanceof ShortenerError
      ? error
      : new ShortenerError(error?.message || 'URL shortening failed', { cause: error });
    logger.error({ err: shortErr.message, originalUrl: normalized, type: SHORTENER_TYPE }, 'URL shortening failed');
    if (requireShort) {
      throw shortErr;
    }
    return normalized;
  }
}

async function shortenUrlsInText(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const urls = text.match(urlRegex);

  if (!urls || urls.length === 0) {
    return text;
  }

  let result = text;
  const urlMap = new Map();

  const shortenPromises = urls.map(async (url) => {
    const normalizedUrl = normalizeUrl(url.startsWith('http') ? url : `https://${url}`);

    if (!normalizedUrl) {
      return { original: url, shortened: url };
    }

    // Never shorten unsubscribe URLs here; unsubscribe is handled explicitly elsewhere
    if (normalizedUrl.includes('/unsubscribe/')) {
      return { original: url, shortened: url };
    }

    if (urlMap.has(normalizedUrl)) {
      return { original: url, shortened: urlMap.get(normalizedUrl) };
    }

    const shortened = await shortenUrl(normalizedUrl, { ...opts, kind: opts.kind || 'generic' });
    urlMap.set(normalizedUrl, shortened);

    return { original: url, shortened };
  });

  const results = await Promise.all(shortenPromises);

  results.forEach(({ original, shortened }) => {
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedOriginal, 'g'), shortened);
  });

  return result;
}

async function shortenMessageUrls(message, opts = {}) {
  return await shortenUrlsInText(message, opts);
}

module.exports = {
  shortenUrl,
  shortenUrlsInText,
  shortenMessageUrls,
  normalizeUrl,
  hashUrl,
  getOrCreateShortLink,
  ShortenerError,
};
