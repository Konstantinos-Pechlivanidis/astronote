const express = require('express');
const crypto = require('node:crypto');
const prisma = require('../lib/prisma');
const { rateLimitByIp } = require('../services/rateLimiter.service');
const { normalizePhoneToE164 } = require('../lib/phone');

const router = express.Router();

const infoLimiter = { points: 30, duration: 60 };
const submitLimiter = { points: 20, duration: 60 };

function isValidToken(token) {
  return /^[A-Za-z0-9_-]{8,64}$/.test(token || '');
}

function publicBase() {
  const base =
    process.env.PUBLIC_RETAIL_BASE_URL ||
    process.env.PUBLIC_WEB_BASE_URL ||
    process.env.FRONTEND_URL ||
    'https://astronote-retail-frontend.onrender.com';
  return base.replace(/\/$/, '');
}

// GET /public/nfc/:token -> resolve store info
router.get('/public/nfc/:token', rateLimitByIp(infoLimiter), async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!isValidToken(token)) {
      return res.status(400).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
    }

    const tag = await prisma.nfcTag.findFirst({
      where: { publicId: token, status: 'active', type: 'opt_in' },
      select: {
        id: true,
        storeId: true,
        label: true,
        store: { select: { company: true, senderName: true } }
      }
    });
    if (!tag) {
      return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    }

    const storeName = tag.store?.company || tag.store?.senderName || 'Store';
    res.json({
      ok: true,
      storeName,
      tagLabel: tag.label,
      phoneDefaultCountry: 'GR',
      gdprConsentVersion: 'nfc-v1',
      publicBaseUrl: publicBase(),
    });
  } catch (e) {
    next(e);
  }
});

// POST /public/nfc/:token/submit -> create/update contact with consent
router.post('/public/nfc/:token/submit', rateLimitByIp(submitLimiter), async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!isValidToken(token)) {
      return res.status(400).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
    }

    const { firstName, lastName, email, phoneCountryCode, phoneNational, gdprConsent } = req.body || {};

    if (!gdprConsent) {
      return res.status(400).json({ message: 'Consent required', code: 'CONSENT_REQUIRED' });
    }
    if (!firstName || typeof firstName !== 'string') {
      return res.status(400).json({ message: 'First name required', code: 'VALIDATION_ERROR' });
    }
    const country = (phoneCountryCode || '+30').replace('+', '') || '30';
    const national = (phoneNational || '').replace(/\D/g, '');
    const combined = `+${country}${national}`;
    const phone = normalizePhoneToE164(combined, 'GR');
    if (!phone) {
      return res.status(400).json({ message: 'Invalid phone', code: 'INVALID_PHONE' });
    }

    const tag = await prisma.nfcTag.findFirst({
      where: { publicId: token, status: 'active', type: 'opt_in' },
      select: { id: true, storeId: true }
    });
    if (!tag) {
      return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    }

    const now = new Date();
    const contact = await prisma.contact.upsert({
      where: {
        ownerId_phone: { ownerId: tag.storeId, phone }
      },
      create: {
        ownerId: tag.storeId,
        phone,
        firstName,
        lastName: lastName || null,
        email: email || null,
        isSubscribed: true,
        gdprConsentAt: now,
        gdprConsentSource: 'nfc',
        gdprConsentVersion: 'nfc-v1'
      },
      update: {
        firstName,
        lastName: lastName || null,
        email: email || null,
        isSubscribed: true,
        gdprConsentAt: { set: now },
        gdprConsentSource: 'nfc',
        gdprConsentVersion: 'nfc-v1'
      }
    });

    await prisma.nfcScan.create({
      data: {
        tagId: tag.id,
        storeId: tag.storeId,
        contactId: contact.id,
        status: 'submitted',
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        deviceType: null
      }
    });

    res.json({
      ok: true,
      contactId: contact.id,
      phone,
      status: 'ok'
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
