import crypto from 'crypto';
import { logger } from './logger.js';
import { createOrGetShortLink } from '../services/shortLinks.js';
import { cacheRedis } from '../config/redis.js';
import { redisSetExBestEffort, sha256Hex } from './redisSafe.js';

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

/**
 * Generate an unsubscribe token for a contact
 * @param {string} contactId - Contact ID
 * @param {string} shopId - Shop ID
 * @param {string} phoneE164 - Phone number (E.164 format)
 * @returns {string} Unsubscribe token
 */
export function generateUnsubscribeToken(contactId, shopId, phoneE164) {
  // Create a payload with contact info
  const payload = {
    contactId,
    shopId,
    phoneE164,
    timestamp: Date.now(),
  };

  // Create a signed token using HMAC
  const secret =
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.JWT_SECRET ||
    'default-secret-change-in-production';
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');

  // Combine payload and signature
  const token = `${Buffer.from(payloadString).toString('base64url')}.${signature}`;

  return token;
}

/**
 * Verify and decode an unsubscribe token
 * @param {string} token - Unsubscribe token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function verifyUnsubscribeToken(token) {
  try {
    const [payloadBase64, signature] = token.split('.');

    if (!payloadBase64 || !signature) {
      logger.warn('Invalid unsubscribe token format', {
        token: `${token.substring(0, 20)}...`,
      });
      return null;
    }

    // Decode payload
    const payloadString = Buffer.from(payloadBase64, 'base64url').toString(
      'utf-8',
    );
    const payload = JSON.parse(payloadString);

    // Verify signature
    const secret =
      process.env.UNSUBSCRIBE_SECRET ||
      process.env.JWT_SECRET ||
      'default-secret-change-in-production';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Invalid unsubscribe token signature', {
        token: `${token.substring(0, 20)}...`,
      });
      return null;
    }

    // Check token expiration (30 days)
    const tokenAge = Date.now() - payload.timestamp;
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    if (tokenAge > maxAge) {
      logger.warn('Unsubscribe token expired', {
        tokenAge: `${Math.floor(tokenAge / (24 * 60 * 60 * 1000))} days`,
        contactId: payload.contactId,
      });
      return null;
    }

    return payload;
  } catch (error) {
    logger.error('Error verifying unsubscribe token', {
      error: error.message,
      token: `${token?.substring(0, 20)}...`,
    });
    return null;
  }
}

import { getFrontendBaseUrl, getFrontendBaseUrlSync } from './frontendUrl.js';

/**
 * Generate unsubscribe URL (async, uses request context if available)
 * @param {string} contactId - Contact ID
 * @param {string} shopId - Shop ID
 * @param {string} phoneE164 - Phone number (E.164 format)
 * @param {Object} req - Optional Express request object
 * @returns {Promise<string>} Unsubscribe URL
 */
export async function generateUnsubscribeUrl(
  contactId,
  shopId,
  phoneE164,
  req = null,
) {
  const token = generateUnsubscribeToken(contactId, shopId, phoneE164);
  const baseUrl = req
    ? await getFrontendBaseUrl(req, shopId)
    : getFrontendBaseUrlSync();

  // Frontend route is /shopify/unsubscribe/:token
  // Always add /shopify/unsubscribe to the normalized base URL
  return `${baseUrl}/shopify/unsubscribe/${token}`;
}

/**
 * Generate unsubscribe URL (sync, fallback to env vars)
 * @param {string} contactId - Contact ID
 * @param {string} shopId - Shop ID
 * @param {string} phoneE164 - Phone number (E.164 format)
 * @returns {string} Unsubscribe URL
 */
export function generateUnsubscribeUrlSync(contactId, shopId, phoneE164) {
  const token = generateUnsubscribeToken(contactId, shopId, phoneE164);
  const baseUrl = getFrontendBaseUrlSync();

  // Frontend route is /shopify/unsubscribe/:token
  // Always add /shopify/unsubscribe to the normalized base URL
  return `${baseUrl}/shopify/unsubscribe/${token}`;
}

/**
 * Append unsubscribe link to SMS message
 * @param {string} message - Original message
 * @param {string} contactId - Contact ID
 * @param {string} shopId - Shop ID
 * @param {string} phoneE164 - Phone number (E.164 format)
 * @param {Object} req - Optional Express request object
 * @returns {Promise<string>} Message with unsubscribe link appended
 */
export async function appendUnsubscribeLink(
  message,
  contactId,
  shopId,
  phoneE164,
  req = null,
  options = null,
) {
  const campaignId = options?.campaignId || null;
  const recipientId = options?.recipientId || null;
  const shortlinkTimeoutMs = Number(process.env.SHORTLINK_TIMEOUT_MS || 1200);

  // Generate unsubscribe URL
  const unsubscribeUrl = await generateUnsubscribeUrl(
    contactId,
    shopId,
    phoneE164,
    req,
  );

  // If message already contains an unsubscribe line, ensure the URL is short and return.
  // Supports both previously appended long URLs and short URLs.
  const existingUnsubRegex = /(\n\nUnsubscribe:\s*)(\S+)/i;
  const existingMatch = typeof message === 'string' ? message.match(existingUnsubRegex) : null;
  if (existingMatch && existingMatch[2]) {
    const existingUrl = existingMatch[2];
    // If already a system short URL, keep as-is.
    if (existingUrl.includes('/s/') || existingUrl.includes('/r/')) {
      return message;
    }
    // Otherwise shorten the existing long unsubscribe URL (best-effort).
    try {
      const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      const shortLink = await withTimeout(
        createOrGetShortLink({
          destinationUrl: existingUrl,
          shopId,
          campaignId,
          contactId,
          expiresAt,
          meta: { type: 'unsubscribe', recipientId },
        }),
        shortlinkTimeoutMs,
        'createOrGetShortLink(unsubscribe-existing)',
      );
      return message.replace(existingUnsubRegex, `$1${shortLink.shortUrl}`);
    } catch (e) {
      // Fall back to original message
      return message;
    }
  }

  // Create a system-owned short link token that redirects to the long, signed unsubscribe URL.
  // This keeps the SMS short, avoids exposing the signed token, and stores the mapping in DB.
  // Expire the short link slightly after the unsubscribe token window (30 days).
  const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
  let shortUrl = unsubscribeUrl;
  try {
    const ttlSeconds = Number(process.env.UNSUBSCRIBE_SHORT_CACHE_TTL_SECONDS || 30 * 24 * 60 * 60);
    const cacheKey = `unsubscribe:short:${shopId || 'na'}:${sha256Hex(unsubscribeUrl).slice(0, 16)}`;
    const cached = await cacheRedis.get(cacheKey);
    if (cached) {
      shortUrl = cached;
    } else {
      const shortLink = await withTimeout(
        createOrGetShortLink({
          destinationUrl: unsubscribeUrl,
          shopId,
          campaignId,
          contactId,
          expiresAt,
          meta: { type: 'unsubscribe', recipientId },
        }),
        shortlinkTimeoutMs,
        'createOrGetShortLink(unsubscribe)',
      );
      shortUrl = shortLink.shortUrl;
      await redisSetExBestEffort(cacheRedis, cacheKey, ttlSeconds, String(shortUrl));
    }
  } catch (e) {
    logger.warn(
      { err: e?.message || String(e), shopId, contactId },
      'Failed to create short unsubscribe link; falling back to long URL',
    );
  }

  const unsubscribeText = `\n\nUnsubscribe: ${shortUrl}`;

  // Check if message + unsubscribe link exceeds SMS limits
  // Standard SMS: 160 characters, Concatenated SMS: 1600 characters
  const maxLength = 1600;
  const totalLength = message.length + unsubscribeText.length;

  if (totalLength > maxLength) {
    // Truncate message to fit unsubscribe link
    const truncatedMessage = `${message.substring(0, maxLength - unsubscribeText.length - 3)}...`;
    return truncatedMessage + unsubscribeText;
  }

  return message + unsubscribeText;
}
