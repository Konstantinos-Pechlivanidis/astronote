import crypto from 'crypto';
import { logger } from './logger.js';
import prisma from '../services/prisma.js';
import { buildShortUrl, createShortLink } from '../services/shortLinks.js';

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
) {
  // Generate unsubscribe URL
  const unsubscribeUrl = await generateUnsubscribeUrl(
    contactId,
    shopId,
    phoneE164,
    req,
  );

  // Create a system-owned short link token that redirects to the long, signed unsubscribe URL.
  // This keeps the SMS short, avoids exposing the signed token, and stores the mapping in DB.
  // Expire the short link slightly after the unsubscribe token window (30 days).
  const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
  let shortUrl = unsubscribeUrl;
  try {
    // Prefer reusing an existing unsubscribe short link for this contact to keep URLs stable
    // across multiple campaigns (best-effort; if JSON filtering isn't supported, we fallback).
    const existing = await prisma.shortLink.findFirst({
      where: {
        shopId,
        contactId,
        expiresAt: { gt: new Date() },
        meta: { path: ['type'], equals: 'unsubscribe' },
      },
      select: { token: true },
    }).catch(() => null);

    if (existing?.token) {
      shortUrl = buildShortUrl(existing.token);
    } else {
      const shortLink = await createShortLink({
        destinationUrl: unsubscribeUrl,
        shopId,
        contactId,
        expiresAt,
        meta: { type: 'unsubscribe' },
      });
      shortUrl = shortLink.shortUrl;
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
