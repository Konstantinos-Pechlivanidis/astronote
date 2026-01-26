const express = require('express');
const prisma = require('../lib/prisma');
const { isValidAbsoluteUrl, normalizeBaseUrl } = require('../lib/url-helpers');
const { verifyUnsubscribeToken, verifyUnsubscribeTokenForStore } = require('../services/token.service');
const { createLimiter, rateLimitByIp } = require('../lib/ratelimit');
const pino = require('pino');

const logger = pino({ name: 'public-short-route' });
const router = express.Router();
const shortLimiter = createLimiter({ keyPrefix: 'rl:public:short', points: 300, duration: 60 });

const allowedRedirectOrigins = (() => {
  const candidates = [
    process.env.PUBLIC_WEB_BASE_URL,
    process.env.PUBLIC_RETAIL_BASE_URL,
    process.env.URL_SHORTENER_BASE_URL,
    process.env.FRONTEND_URL,
    process.env.APP_URL,
    process.env.PUBLIC_BASE_URL,
  ].filter(Boolean);

  if (candidates.length === 0) {
    candidates.push('https://astronote.onrender.com');
  }

  const origins = new Set();
  for (const base of candidates) {
    const normalized = normalizeBaseUrl(base);
    if (!normalized) {continue;}
    try {
      origins.add(new URL(normalized).origin);
    } catch {
      // ignore invalid base urls
    }
  }

  if (origins.size === 0) {
    origins.add('https://astronote.onrender.com');
  }

  return origins;
})();

function isValidShortCode(code) {
  return /^[A-Za-z0-9_-]{4,64}$/.test(code || '');
}

function extractUnsubscribeToken(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return null;
  }
  try {
    const url = new URL(targetUrl);
    const match = url.pathname.match(/\/unsubscribe\/([^/]+)$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function isSafeRedirectTarget(targetUrl) {
  if (!isValidAbsoluteUrl(targetUrl)) {
    return false;
  }
  try {
    const origin = new URL(targetUrl).origin;
    return allowedRedirectOrigins.has(origin);
  } catch {
    return false;
  }
}

// GET /public/s/:shortCode -> redirects (302) to targetUrl and increments counters
router.get('/public/s/:shortCode', rateLimitByIp(shortLimiter), async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    if (!shortCode || !isValidShortCode(shortCode)) {
      return res.status(400).json({ message: 'shortCode required', code: 'VALIDATION_ERROR' });
    }

    const link = await prisma.shortLink.findUnique({ where: { shortCode } });
    if (!link) {
      logger.warn({ shortCode }, 'shortlink_not_found');
      return res.status(404).json({ message: 'Short link not found', code: 'NOT_FOUND' });
    }

    const target = link.targetUrl || link.originalUrl;
    if (!target || !isSafeRedirectTarget(target)) {
      logger.warn({ shortCode }, target ? 'shortlink_target_not_allowed' : 'shortlink_target_missing');
      return res.status(404).json({ message: 'Short link not found', code: 'NOT_FOUND' });
    }

    if (link.kind === 'unsubscribe') {
      const token = extractUnsubscribeToken(target);
      const verified = link.ownerId
        ? verifyUnsubscribeTokenForStore(token, link.ownerId)
        : verifyUnsubscribeToken(token);
      if (!verified) {
        logger.warn({ shortCode, ownerId: link.ownerId }, 'Short link unsubscribe token mismatch');
        return res.status(404).json({ message: 'Short link not found', code: 'NOT_FOUND' });
      }
    }

    await prisma.shortLink.update({
      where: { shortCode },
      data: {
        clickCount: { increment: 1 },
        lastClickedAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    return res.redirect(302, target);
  } catch (e) {
    next(e);
  }
});

// GET /public/o/:shortCode -> same resolver as /public/s (offer/tracking links)
router.get('/public/o/:shortCode', rateLimitByIp(shortLimiter), async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    if (!shortCode || !isValidShortCode(shortCode)) {
      return res.status(400).json({ message: 'shortCode required', code: 'VALIDATION_ERROR' });
    }

    const link = await prisma.shortLink.findUnique({ where: { shortCode } });
    if (!link) {
      logger.warn({ shortCode }, 'shortlink_not_found');
      return res.status(404).json({ message: 'Short link not found', code: 'NOT_FOUND' });
    }

    const target = link.targetUrl || link.originalUrl;
    if (!target || !isSafeRedirectTarget(target)) {
      logger.warn({ shortCode }, target ? 'shortlink_target_not_allowed' : 'shortlink_target_missing');
      return res.status(404).json({ message: 'Short link not found', code: 'NOT_FOUND' });
    }

    if (link.kind === 'unsubscribe') {
      const token = extractUnsubscribeToken(target);
      const verified = link.ownerId
        ? verifyUnsubscribeTokenForStore(token, link.ownerId)
        : verifyUnsubscribeToken(token);
      if (!verified) {
        logger.warn({ shortCode, ownerId: link.ownerId }, 'Short link unsubscribe token mismatch');
        return res.status(404).json({ message: 'Short link not found', code: 'NOT_FOUND' });
      }
    }

    await prisma.shortLink.update({
      where: { shortCode },
      data: {
        clickCount: { increment: 1 },
        lastClickedAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    return res.redirect(302, target);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
