const express = require('express');
const prisma = require('../lib/prisma');
const { createLimiter } = require('../lib/ratelimit');
const { normalizePhoneToE164 } = require('../lib/phone');
const pino = require('pino');

const router = express.Router();
const logger = pino({ name: 'public-join-route' });
// generous for views: 300 requests / 5 minutes per ip
const viewLimiter = createLimiter({ keyPrefix: 'rl:public:join:view', points: 300, duration: 300 });
// safer for submits: 30 requests / 5 minutes per ip+token
const submitLimiter = createLimiter({ keyPrefix: 'rl:public:join:submit', points: 30, duration: 300 });

function publicBase() {
  const base =
    process.env.PUBLIC_RETAIL_BASE_URL ||
    process.env.PUBLIC_WEB_BASE_URL ||
    process.env.FRONTEND_URL ||
    'https://astronote-retail-frontend.onrender.com';
  return base.replace(/\/$/, '');
}

function requestBase(req) {
  const protoHeader = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'];
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || req.protocol || 'http';
  const host = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader) || req.get('host');
  if (!host) {return '';}
  return `${proto}`.includes('://') ? `${proto}${host}` : `${proto}://${host}`;
}

function buildAssetUrl(req, assetId) {
  if (!assetId) {return null;}
  const base = requestBase(req);
  const path = `/public/assets/${assetId}`;
  return base ? `${base}${path}` : path;
}

async function ensureBranding(ownerId) {
  const branding = await prisma.retailJoinBranding.findUnique({
    where: { ownerId },
    include: { logoAsset: true, ogImageAsset: true },
  });
  if (branding) {return branding;}
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  const storeName = owner?.company || owner?.senderName || 'Store';
  return prisma.retailJoinBranding.create({
    data: { ownerId, storeDisplayName: storeName },
    include: { logoAsset: true, ogImageAsset: true },
  });
}

async function getToken(token) {
  return prisma.publicLinkToken.findFirst({
    where: { token, isActive: true, type: 'signup' },
    select: { id: true, ownerId: true },
  });
}

// GET /public/join/:token
router.get('/public/join/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const key = req.ip || 'unknown';
    try {
      const consumed = await viewLimiter.consume(key);
      res.set('X-RateLimit-Remaining', String(consumed.remainingPoints ?? ''));
    } catch (rl) {
      const ms = rl?.msBeforeNext ?? 60_000;
      res.set('Retry-After', Math.ceil(ms / 1000));
      logger.warn({ ip: req.ip, token, path: req.path, userAgent: req.headers['user-agent'] || null, referer: req.headers.referer || null }, 'Public join view rate limited');
      return res.status(429).json({ message: 'Too many requests', code: 'RATE_LIMITED' });
    }

    const link = await getToken(token);
    if (!link) {
      return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    }

    const branding = await ensureBranding(link.ownerId);
    const primaryColor = branding.primaryColor || '#111827';
    const accentColor = branding.accentColor || '#3B82F6';
    const logoUrl = buildAssetUrl(req, branding.logoAssetId) || branding.logoUrl || null;
    const ogImageUrl = buildAssetUrl(req, branding.ogImageAssetId) || branding.ogImageUrl || null;
    await prisma.publicSignupEvent.create({
      data: {
        ownerId: link.ownerId,
        tokenId: link.id,
        ip: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        meta: { action: 'view' },
      },
    });

    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      ok: true,
      active: true,
      storeName: branding.storeDisplayName,
      branding: {
        storeName: branding.storeDisplayName,
        storeDisplayName: branding.storeDisplayName,
        logoUrl,
        ogImageUrl,
        primaryColor,
        secondaryColor: branding.secondaryColor || '#4B5563',
        backgroundColor: branding.backgroundColor || '#FFFFFF',
        textColor: branding.textColor || '#111827',
        accentColor,
        headline: branding.marketingHeadline,
        headlineOverride: branding.marketingHeadline,
        subheadline: null,
        benefits: branding.marketingBullets,
        benefitsOverride: branding.marketingBullets,
        incentiveText: null,
        merchantBlurb: branding.merchantBlurb,
        extraTextBox: branding.merchantBlurb,
        // Bilingual fields
        headlineEn: branding.headlineEn || null,
        headlineEl: branding.headlineEl || null,
        subheadlineEn: branding.subheadlineEn || null,
        subheadlineEl: branding.subheadlineEl || null,
        bulletsEn: branding.bulletsEn || null,
        bulletsEl: branding.bulletsEl || null,
        merchantBlurbEn: branding.merchantBlurbEn || null,
        merchantBlurbEl: branding.merchantBlurbEl || null,
        pageTitle: branding.pageTitle,
        pageDescription: branding.pageDescription,
        websiteUrl: branding.websiteUrl,
        facebookUrl: branding.facebookUrl,
        instagramUrl: branding.instagramUrl,
        rotateEnabled: branding.rotateEnabled,
        showPoweredBy: branding.showPoweredBy !== false,
      },
      defaults: {
        phoneCountryCode: '+30',
      },
      publicBase: publicBase(),
    });
  } catch (e) {
    next(e);
  }
});

// POST /public/join/:token (alias keeps /submit for backward compatibility)
const joinSubmitHandler = async (req, res, next) => {
  try {
    const { token } = req.params;
    const key = `${req.ip || 'unknown'}:${token || ''}`;
    try {
      const consumed = await submitLimiter.consume(key);
      res.set('X-RateLimit-Remaining', String(consumed.remainingPoints ?? ''));
    } catch (rl) {
      const ms = rl?.msBeforeNext ?? 60_000;
      res.set('Retry-After', Math.ceil(ms / 1000));
      logger.warn({ ip: req.ip, token, path: req.path, userAgent: req.headers['user-agent'] || null, referer: req.headers.referer || null }, 'Public join submit rate limited');
      return res.status(429).json({ message: 'Too many requests', code: 'RATE_LIMITED' });
    }

    const link = await getToken(token);
    if (!link) {
      return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    }

    const { firstName, lastName, email, phoneCountryCode, phoneNational, countryCode } = req.body || {};
    if (!firstName || typeof firstName !== 'string') {
      return res.status(400).json({ message: 'First name is required', code: 'VALIDATION_ERROR' });
    }
    const cc = countryCode || phoneCountryCode || '+30';
    const country = cc.replace('+', '') || '30';
    const national = (phoneNational || '').replace(/\D/g, '');
    const combined = `+${country}${national}`;
    const phone = normalizePhoneToE164(combined, 'GR');
    if (!phone) {
      return res.status(400).json({ message: 'Invalid phone', code: 'INVALID_PHONE' });
    }

    const now = new Date();
    const contact = await prisma.contact.upsert({
      where: { ownerId_phone: { ownerId: link.ownerId, phone } },
      create: {
        ownerId: link.ownerId,
        phone,
        firstName,
        lastName: lastName || null,
        email: email || null,
        isSubscribed: true,
        gdprConsentAt: now,
        gdprConsentSource: 'public_signup',
        gdprConsentVersion: 'public_signup_v1',
        smsConsentStatus: 'opted_in',
        smsConsentAt: now,
        smsConsentSource: 'public_signup',
        consentEvidence: {
          tokenId: link.id,
          ip: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
          url: req.originalUrl,
        },
      },
      update: {
        firstName,
        lastName: lastName || null,
        email: email || null,
        isSubscribed: true,
        gdprConsentAt: { set: now },
        gdprConsentSource: 'public_signup',
        gdprConsentVersion: 'public_signup_v1',
        smsConsentStatus: 'opted_in',
        smsConsentAt: { set: now },
        smsConsentSource: 'public_signup',
        consentEvidence: {
          tokenId: link.id,
          ip: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
          url: req.originalUrl,
        },
      },
    });

    await prisma.publicSignupEvent.create({
      data: {
        ownerId: link.ownerId,
        tokenId: link.id,
        contactId: contact.id,
        ip: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        meta: { action: 'submit' },
      },
    });

    res.json({
      ok: true,
      status: 'ok',
      contactId: contact.id,
      phone,
    });
  } catch (e) {
    next(e);
  }
};

router.post('/public/join/:token', joinSubmitHandler);
router.post('/public/join/:token/submit', joinSubmitHandler);

module.exports = router;
