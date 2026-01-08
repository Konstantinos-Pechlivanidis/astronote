const express = require('express');
const crypto = require('node:crypto');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

function publicBase() {
  const base =
    process.env.PUBLIC_RETAIL_BASE_URL ||
    process.env.PUBLIC_WEB_BASE_URL ||
    process.env.FRONTEND_URL ||
    'https://astronote-retail-frontend.onrender.com';
  return base.replace(/\/$/, '');
}

function randomToken() {
  return crypto.randomBytes(10).toString('base64url');
}

async function ensureSignupToken(ownerId) {
  const existing = await prisma.publicLinkToken.findFirst({
    where: { ownerId, type: 'signup', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {return existing;}
  return prisma.publicLinkToken.create({
    data: {
      ownerId,
      token: randomToken(),
      type: 'signup',
      isActive: true,
    },
  });
}

function buildJoinUrl(token) {
  return `${publicBase()}/join/${token}`;
}

function buildJoinPayload(token) {
  return {
    ok: true,
    token: token.token,
    joinUrl: buildJoinUrl(token.token),
    qrValue: buildJoinUrl(token.token),
  };
}

router.get('/me/public-links', requireAuth, async (req, res, next) => {
  try {
    const token = await ensureSignupToken(req.user.id);
    res.json(buildJoinPayload(token));
  } catch (e) {
    next(e);
  }
});

router.get('/retail/join-token', requireAuth, async (req, res, next) => {
  try {
    const token = await ensureSignupToken(req.user.id);
    res.json(buildJoinPayload(token));
  } catch (e) {
    next(e);
  }
});

router.post('/me/public-links/rotate', requireAuth, async (req, res, next) => {
  try {
    await prisma.publicLinkToken.updateMany({
      where: { ownerId: req.user.id, type: 'signup', isActive: true },
      data: { isActive: false, rotatedAt: new Date() },
    });
    const token = await prisma.publicLinkToken.create({
      data: {
        ownerId: req.user.id,
        token: randomToken(),
        type: 'signup',
        isActive: true,
      },
    });
    res.json(buildJoinPayload(token));
  } catch (e) {
    next(e);
  }
});

router.get('/me/retail-branding', requireAuth, async (req, res, next) => {
  try {
    const branding = await prisma.retailBranding.upsert({
      where: { ownerId: req.user.id },
      update: {},
      create: { ownerId: req.user.id, storeName: req.user.company || req.user.senderName || 'Store' },
    });
    res.json(branding);
  } catch (e) {
    next(e);
  }
});

router.put('/me/retail-branding', requireAuth, async (req, res, next) => {
  try {
    const { storeName, logoUrl, primaryColor, accentColor, headline, benefits, privacyUrl, termsUrl } = req.body || {};
    if (!storeName) {
      return res.status(400).json({ message: 'storeName required', code: 'VALIDATION_ERROR' });
    }
    const branding = await prisma.retailBranding.upsert({
      where: { ownerId: req.user.id },
      update: {
        storeName,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        accentColor: accentColor || null,
        headline: headline || null,
        benefits: benefits || null,
        privacyUrl: privacyUrl || null,
        termsUrl: termsUrl || null,
      },
      create: {
        ownerId: req.user.id,
        storeName,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        accentColor: accentColor || null,
        headline: headline || null,
        benefits: benefits || null,
        privacyUrl: privacyUrl || null,
        termsUrl: termsUrl || null,
      },
    });
    res.json(branding);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
