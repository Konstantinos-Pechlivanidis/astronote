const express = require('express');
const prisma = require('../lib/prisma');
const { rateLimitByIp } = require('../services/rateLimiter.service');
const { normalizePhoneToE164 } = require('../lib/phone');

const router = express.Router();

const viewLimiter = { points: 60, duration: 60 };
const submitLimiter = { points: 30, duration: 60 };

function publicBase() {
  const base =
    process.env.PUBLIC_RETAIL_BASE_URL ||
    process.env.PUBLIC_WEB_BASE_URL ||
    process.env.FRONTEND_URL ||
    'https://astronote-retail-frontend.onrender.com';
  return base.replace(/\/$/, '');
}

async function ensureBranding(ownerId) {
  const branding = await prisma.retailBranding.findUnique({ where: { ownerId } });
  if (branding) return branding;
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  const storeName = owner?.company || owner?.senderName || 'Store';
  return prisma.retailBranding.upsert({
    where: { ownerId },
    update: { storeName },
    create: { ownerId, storeName }
  });
}

async function getToken(token) {
  return prisma.publicLinkToken.findFirst({
    where: { token, isActive: true, type: 'signup' },
    select: { id: true, ownerId: true }
  });
}

// GET /public/join/:token
router.get('/public/join/:token', rateLimitByIp(viewLimiter), async (req, res, next) => {
  try {
    const { token } = req.params;
    const link = await getToken(token);
    if (!link) {
      return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    }

    const branding = await ensureBranding(link.ownerId);
    await prisma.publicSignupEvent.create({
      data: {
        ownerId: link.ownerId,
        tokenId: link.id,
        ip: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        meta: { action: 'view' }
      }
    });

    res.json({
      ok: true,
      branding: {
        storeName: branding.storeName,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        headline: branding.headline,
        benefits: branding.benefits,
        privacyUrl: branding.privacyUrl,
        termsUrl: branding.termsUrl,
      },
      defaults: {
        phoneCountryCode: '+30'
      },
      publicBase: publicBase()
    });
  } catch (e) {
    next(e);
  }
});

// POST /public/join/:token/submit
router.post('/public/join/:token/submit', rateLimitByIp(submitLimiter), async (req, res, next) => {
  try {
    const { token } = req.params;
    const link = await getToken(token);
    if (!link) {
      return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    }

    const { firstName, lastName, email, phoneCountryCode, phoneNational } = req.body || {};
    if (!firstName || typeof firstName !== 'string') {
      return res.status(400).json({ message: 'First name is required', code: 'VALIDATION_ERROR' });
    }
    const country = (phoneCountryCode || '+30').replace('+', '');
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
          url: req.originalUrl
        }
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
          url: req.originalUrl
        }
      }
    });

    await prisma.publicSignupEvent.create({
      data: {
        ownerId: link.ownerId,
        tokenId: link.id,
        contactId: contact.id,
        ip: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        meta: { action: 'submit' }
      }
    });

    res.json({
      ok: true,
      status: 'ok',
      contactId: contact.id,
      phone
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
