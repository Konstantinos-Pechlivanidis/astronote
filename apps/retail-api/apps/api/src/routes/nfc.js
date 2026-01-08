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
  return crypto.randomBytes(9).toString('base64url');
}

async function ensureDefaultTag(ownerId) {
  const existing = await prisma.nfcTag.findFirst({
    where: { storeId: ownerId, type: 'opt_in', status: 'active' },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {return existing;}
  return prisma.nfcTag.create({
    data: {
      publicId: randomToken(),
      storeId: ownerId,
      campaignId: null,
      label: 'Default NFC',
      type: 'opt_in',
      status: 'active',
      createdById: ownerId,
    },
  });
}

function buildNfcUrl(publicId) {
  return `${publicBase()}/nfc/${publicId}`;
}

// GET /api/me/nfc -> ensure token exists
router.get('/me/nfc', requireAuth, async (req, res, next) => {
  try {
    const tag = await ensureDefaultTag(req.user.id);
    res.json({
      ok: true,
      token: tag.publicId,
      nfcUrl: buildNfcUrl(tag.publicId),
      label: tag.label,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/me/nfc/rotate -> rotate token
router.post('/me/nfc/rotate', requireAuth, async (req, res, next) => {
  try {
    // deactivate old
    await prisma.nfcTag.updateMany({
      where: { storeId: req.user.id, type: 'opt_in', status: 'active' },
      data: { status: 'inactive', updatedAt: new Date() },
    });
    const tag = await prisma.nfcTag.create({
      data: {
        publicId: randomToken(),
        storeId: req.user.id,
        label: 'Default NFC',
        type: 'opt_in',
        status: 'active',
        createdById: req.user.id,
      },
    });
    res.json({
      ok: true,
      token: tag.publicId,
      nfcUrl: buildNfcUrl(tag.publicId),
      label: tag.label,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
