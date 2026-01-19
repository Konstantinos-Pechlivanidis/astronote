const express = require('express');
const prisma = require('../lib/prisma');
const { createLimiter, rateLimitByIp } = require('../lib/ratelimit');
const pino = require('pino');

const logger = pino({ name: 'public-short-route' });
const router = express.Router();
const shortLimiter = createLimiter({ keyPrefix: 'rl:public:short', points: 300, duration: 60 });

function isValidShortCode(code) {
  return /^[A-Za-z0-9_-]{4,64}$/.test(code || '');
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
      // Fallback: treat shortCode as unsubscribe token and redirect to long form
      const fallbackUnsub = `${process.env.PUBLIC_RETAIL_BASE_URL || process.env.PUBLIC_WEB_BASE_URL || process.env.FRONTEND_URL || 'https://astronote-retail-frontend.onrender.com'}/unsubscribe/${encodeURIComponent(shortCode)}`;
      return res.redirect(302, fallbackUnsub);
    }

    await prisma.shortLink.update({
      where: { shortCode },
      data: {
        clickCount: { increment: 1 },
        lastClickedAt: new Date(),
      },
    });

    const target = link.targetUrl || link.originalUrl;
    if (!target) {
      logger.warn({ shortCode }, 'Short link missing targetUrl/originalUrl');
      return res.status(404).json({ message: 'Short link not found', code: 'NOT_FOUND' });
    }

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
      // Fallback: treat token as trackingId and redirect to offer page
      const fallbackOffer = `${process.env.PUBLIC_RETAIL_BASE_URL || process.env.PUBLIC_WEB_BASE_URL || process.env.FRONTEND_URL || 'https://astronote-retail-frontend.onrender.com'}/tracking/offer/${encodeURIComponent(shortCode)}`;
      return res.redirect(302, fallbackOffer);
    }

    await prisma.shortLink.update({
      where: { shortCode },
      data: {
        clickCount: { increment: 1 },
        lastClickedAt: new Date(),
      },
    });

    const target = link.targetUrl || link.originalUrl;
    if (!target) {
      logger.warn({ shortCode }, 'Short link missing targetUrl/originalUrl');
      return res.status(404).json({ message: 'Short link not found', code: 'NOT_FOUND' });
    }

    return res.redirect(302, target);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
