const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const prisma = require('../lib/prisma');
const router = express.Router();

function defaultStoreName(user) {
  return user?.company || user?.senderName || 'Store';
}

function isHex(color) {
  return !color || /^#?[0-9A-Fa-f]{3,8}$/.test(color);
}

function sanitizeBenefits(benefits) {
  if (!benefits) {return null;}
  if (!Array.isArray(benefits)) {return null;}
  const trimmed = benefits.map((b) => (typeof b === 'string' ? b.trim() : '')).filter(Boolean);
  if (!trimmed.length) {return null;}
  return trimmed.slice(0, 5);
}

router.get('/branding', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const branding = await prisma.retailBranding.upsert({
      where: { ownerId: req.user.id },
      update: {},
      create: {
        ownerId: req.user.id,
        storeName: defaultStoreName(user),
        storeDisplayName: defaultStoreName(user),
      },
    });
    res.json(branding);
  } catch (e) {
    next(e);
  }
});

router.put('/branding', requireAuth, async (req, res, next) => {
  try {
    const {
      storeName,
      storeDisplayName,
      logoUrl,
      primaryColor,
      accentColor,
      backgroundStyle,
      headline,
      subheadline,
      benefits,
      incentiveText,
      legalText,
      privacyUrl,
      termsUrl,
    } = req.body || {};

    if (!storeName) {
      return res.status(400).json({ message: 'storeName required', code: 'VALIDATION_ERROR' });
    }
    if (!isHex(primaryColor) || !isHex(accentColor)) {
      return res.status(400).json({ message: 'Invalid color format', code: 'VALIDATION_ERROR' });
    }
    const safeBenefits = sanitizeBenefits(benefits);

    const branding = await prisma.retailBranding.upsert({
      where: { ownerId: req.user.id },
      update: {
        storeName,
        storeDisplayName: storeDisplayName || storeName,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        accentColor: accentColor || null,
        backgroundStyle: backgroundStyle || null,
        headline: headline || null,
        subheadline: subheadline || null,
        benefits: safeBenefits,
        benefitsJson: safeBenefits,
        incentiveText: incentiveText || null,
        legalText: legalText || null,
        privacyUrl: privacyUrl || null,
        termsUrl: termsUrl || null,
      },
      create: {
        ownerId: req.user.id,
        storeName,
        storeDisplayName: storeDisplayName || storeName,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        accentColor: accentColor || null,
        backgroundStyle: backgroundStyle || null,
        headline: headline || null,
        subheadline: subheadline || null,
        benefits: safeBenefits,
        benefitsJson: safeBenefits,
        incentiveText: incentiveText || null,
        legalText: legalText || null,
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
