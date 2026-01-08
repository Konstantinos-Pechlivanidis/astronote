const express = require('express');
const multer = require('multer');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/requireAuth');
const { saveAssetFile, deleteAssetFile } = require('../lib/retailAssetStorage');

const router = express.Router();

const DEFAULT_PRIMARY = '#111827';
const DEFAULT_SECONDARY = '#4B5563';
const DEFAULT_BACKGROUND = '#FFFFFF';
const DEFAULT_TEXT = '#111827';
const DEFAULT_ACCENT = '#3B82F6';

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const MAX_OG_SIZE = 4 * 1024 * 1024;

const LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const OG_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function isHexColor(value) {
  if (value === null || value === undefined || value === '') {return true;}
  return /^#[0-9A-Fa-f]{6}$/.test(String(value));
}

function isHttpUrl(value) {
  if (value === null || value === undefined || value === '') {return true;}
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeOptionalString(value, maxLength) {
  if (value === null || value === undefined) {return null;}
  const trimmed = String(value).trim();
  if (!trimmed) {return null;}
  if (maxLength && trimmed.length > maxLength) {
    return null;
  }
  return trimmed;
}

function normalizeBullets(value) {
  if (value === undefined) {return { value: undefined };}
  if (value === null) {return { value: null };}
  if (!Array.isArray(value)) {
    return { error: 'marketingBullets must be an array' };
  }
  const cleaned = [];
  for (const item of value) {
    if (item === null || item === undefined) {continue;}
    const trimmed = String(item).trim();
    if (!trimmed) {continue;}
    if (trimmed.length > 120) {
      return { error: 'marketingBullets entries must be <= 120 characters' };
    }
    cleaned.push(trimmed);
  }
  const limited = cleaned.slice(0, 5);
  return { value: limited.length ? limited : null };
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

function formatBrandingResponse(req, branding) {
  return {
    storeName: branding.storeDisplayName,
    storeDisplayName: branding.storeDisplayName,
    logoUrl: buildAssetUrl(req, branding.logoAssetId) || branding.logoUrl || null,
    ogImageUrl: buildAssetUrl(req, branding.ogImageAssetId) || branding.ogImageUrl || null,
    primaryColor: branding.primaryColor || DEFAULT_PRIMARY,
    secondaryColor: branding.secondaryColor || DEFAULT_SECONDARY,
    backgroundColor: branding.backgroundColor || DEFAULT_BACKGROUND,
    textColor: branding.textColor || DEFAULT_TEXT,
    accentColor: branding.accentColor || DEFAULT_ACCENT,
    marketingHeadline: branding.marketingHeadline || null,
    marketingBullets: branding.marketingBullets || null,
    merchantBlurb: branding.merchantBlurb || null,
    // Bilingual fields
    headlineEn: branding.headlineEn || null,
    headlineEl: branding.headlineEl || null,
    subheadlineEn: branding.subheadlineEn || null,
    subheadlineEl: branding.subheadlineEl || null,
    bulletsEn: branding.bulletsEn || null,
    bulletsEl: branding.bulletsEl || null,
    merchantBlurbEn: branding.merchantBlurbEn || null,
    merchantBlurbEl: branding.merchantBlurbEl || null,
    pageTitle: branding.pageTitle || null,
    pageDescription: branding.pageDescription || null,
    websiteUrl: branding.websiteUrl || null,
    facebookUrl: branding.facebookUrl || null,
    instagramUrl: branding.instagramUrl || null,
    rotateEnabled: Boolean(branding.rotateEnabled),
    showPoweredBy: branding.showPoweredBy !== false,
  };
}

async function ensureBranding(ownerId) {
  const existing = await prisma.retailJoinBranding.findUnique({
    where: { ownerId },
    include: { logoAsset: true, ogImageAsset: true },
  });
  if (existing) {return existing;}
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { company: true, senderName: true },
  });
  const storeName = owner?.company || owner?.senderName || 'Store';
  return prisma.retailJoinBranding.create({
    data: {
      ownerId,
      storeDisplayName: storeName,
    },
    include: { logoAsset: true, ogImageAsset: true },
  });
}

async function removeAsset(assetId) {
  if (!assetId) {return;}
  const asset = await prisma.retailAsset.findUnique({ where: { id: assetId } });
  if (!asset) {return;}
  await deleteAssetFile(asset.storagePath);
  await prisma.retailAsset.delete({ where: { id: assetId } });
}

function handleUpload(upload) {
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (!err) {return next();}
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large', code: 'VALIDATION_ERROR' });
      }
      return res.status(400).json({ message: err.message || 'Upload failed', code: 'VALIDATION_ERROR' });
    });
  };
}

const logoUpload = handleUpload(
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_LOGO_SIZE },
  }).single('file'),
);

const ogUpload = handleUpload(
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_OG_SIZE },
  }).single('file'),
);

async function getBranding(req, res, next) {
  try {
    const branding = await ensureBranding(req.user.id);
    res.json({
      ok: true,
      branding: formatBrandingResponse(req, branding),
    });
  } catch (e) {
    next(e);
  }
}

async function updateBranding(req, res, next) {
  try {
    const payload = req.body || {};
    const updates = {};

    if (payload.storeDisplayName !== undefined) {
      const value = normalizeOptionalString(payload.storeDisplayName, 120);
      if (!value) {
        return res.status(400).json({ message: 'storeDisplayName required', code: 'VALIDATION_ERROR' });
      }
      updates.storeDisplayName = value;
    }

    const colorFields = [
      ['primaryColor', DEFAULT_PRIMARY],
      ['secondaryColor', DEFAULT_SECONDARY],
      ['backgroundColor', DEFAULT_BACKGROUND],
      ['textColor', DEFAULT_TEXT],
      ['accentColor', DEFAULT_ACCENT],
    ];

    for (const [field, fallback] of colorFields) {
      if (payload[field] !== undefined) {
        const value = payload[field] || fallback;
        if (!isHexColor(value)) {
          return res.status(400).json({ message: `Invalid ${field}`, code: 'VALIDATION_ERROR' });
        }
        updates[field] = value;
      }
    }

    const urlFields = ['logoUrl', 'ogImageUrl', 'websiteUrl', 'facebookUrl', 'instagramUrl'];
    for (const field of urlFields) {
      if (payload[field] !== undefined) {
        if (!isHttpUrl(payload[field])) {
          return res.status(400).json({ message: `Invalid ${field}`, code: 'VALIDATION_ERROR' });
        }
        updates[field] = normalizeOptionalString(payload[field], 400);
        if (field === 'logoUrl') {
          updates.logoAssetId = null;
        }
        if (field === 'ogImageUrl') {
          updates.ogImageAssetId = null;
        }
      }
    }

    if (payload.marketingHeadline !== undefined) {
      updates.marketingHeadline = normalizeOptionalString(payload.marketingHeadline, 140);
    }

    if (payload.pageTitle !== undefined) {
      updates.pageTitle = normalizeOptionalString(payload.pageTitle, 140);
    }

    if (payload.pageDescription !== undefined) {
      updates.pageDescription = normalizeOptionalString(payload.pageDescription, 280);
    }

    if (payload.merchantBlurb !== undefined) {
      const blurb = normalizeOptionalString(payload.merchantBlurb, 500);
      if (payload.merchantBlurb && !blurb) {
        return res.status(400).json({ message: 'merchantBlurb too long', code: 'VALIDATION_ERROR' });
      }
      updates.merchantBlurb = blurb;
    }

    if (payload.marketingBullets !== undefined) {
      const normalized = normalizeBullets(payload.marketingBullets);
      if (normalized.error) {
        return res.status(400).json({ message: normalized.error, code: 'VALIDATION_ERROR' });
      }
      updates.marketingBullets = normalized.value;
    }

    // Bilingual fields
    if (payload.headlineEn !== undefined) {
      updates.headlineEn = normalizeOptionalString(payload.headlineEn, 140);
    }
    if (payload.headlineEl !== undefined) {
      updates.headlineEl = normalizeOptionalString(payload.headlineEl, 140);
    }
    if (payload.subheadlineEn !== undefined) {
      updates.subheadlineEn = normalizeOptionalString(payload.subheadlineEn, 280);
    }
    if (payload.subheadlineEl !== undefined) {
      updates.subheadlineEl = normalizeOptionalString(payload.subheadlineEl, 280);
    }
    if (payload.bulletsEn !== undefined) {
      const normalized = normalizeBullets(payload.bulletsEn);
      if (normalized.error) {
        return res.status(400).json({ message: normalized.error, code: 'VALIDATION_ERROR' });
      }
      updates.bulletsEn = normalized.value;
    }
    if (payload.bulletsEl !== undefined) {
      const normalized = normalizeBullets(payload.bulletsEl);
      if (normalized.error) {
        return res.status(400).json({ message: normalized.error, code: 'VALIDATION_ERROR' });
      }
      updates.bulletsEl = normalized.value;
    }
    if (payload.merchantBlurbEn !== undefined) {
      const blurb = normalizeOptionalString(payload.merchantBlurbEn, 500);
      if (payload.merchantBlurbEn && !blurb) {
        return res.status(400).json({ message: 'merchantBlurbEn too long', code: 'VALIDATION_ERROR' });
      }
      updates.merchantBlurbEn = blurb;
    }
    if (payload.merchantBlurbEl !== undefined) {
      const blurb = normalizeOptionalString(payload.merchantBlurbEl, 500);
      if (payload.merchantBlurbEl && !blurb) {
        return res.status(400).json({ message: 'merchantBlurbEl too long', code: 'VALIDATION_ERROR' });
      }
      updates.merchantBlurbEl = blurb;
    }

    if (payload.rotateEnabled !== undefined) {
      if (typeof payload.rotateEnabled !== 'boolean') {
        return res.status(400).json({ message: 'rotateEnabled must be boolean', code: 'VALIDATION_ERROR' });
      }
      updates.rotateEnabled = payload.rotateEnabled;
    }

    if (payload.showPoweredBy !== undefined) {
      if (typeof payload.showPoweredBy !== 'boolean') {
        return res.status(400).json({ message: 'showPoweredBy must be boolean', code: 'VALIDATION_ERROR' });
      }
      updates.showPoweredBy = payload.showPoweredBy;
    }

    const branding = await ensureBranding(req.user.id);
    const updated = Object.keys(updates).length
      ? await prisma.retailJoinBranding.update({
        where: { ownerId: req.user.id },
        data: updates,
        include: { logoAsset: true, ogImageAsset: true },
      })
      : branding;

    res.json({
      ok: true,
      branding: formatBrandingResponse(req, updated),
    });
  } catch (e) {
    next(e);
  }
}

async function uploadLogo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded', code: 'VALIDATION_ERROR' });
    }
    if (!LOGO_MIME_TYPES.has(req.file.mimetype)) {
      return res.status(400).json({ message: 'Unsupported logo file type', code: 'VALIDATION_ERROR' });
    }

    const branding = await ensureBranding(req.user.id);
    const stored = await saveAssetFile({ ownerId: req.user.id, kind: 'logo', file: req.file });

    const asset = await prisma.retailAsset.create({
      data: {
        ownerId: req.user.id,
        kind: 'logo',
        mimeType: req.file.mimetype,
        fileName: stored.fileName,
        byteSize: req.file.size,
        storagePath: stored.storagePath,
      },
    });

    const updated = await prisma.retailJoinBranding.update({
      where: { ownerId: req.user.id },
      data: {
        logoAssetId: asset.id,
        logoUrl: null,
      },
      include: { logoAsset: true, ogImageAsset: true },
    });

    if (branding.logoAssetId && branding.logoAssetId !== asset.id) {
      await removeAsset(branding.logoAssetId);
    }

    res.json({
      ok: true,
      branding: formatBrandingResponse(req, updated),
    });
  } catch (e) {
    next(e);
  }
}

async function uploadOgImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded', code: 'VALIDATION_ERROR' });
    }
    if (!OG_MIME_TYPES.has(req.file.mimetype)) {
      return res.status(400).json({ message: 'Unsupported OG image type', code: 'VALIDATION_ERROR' });
    }

    const branding = await ensureBranding(req.user.id);
    const stored = await saveAssetFile({ ownerId: req.user.id, kind: 'og-image', file: req.file });

    const asset = await prisma.retailAsset.create({
      data: {
        ownerId: req.user.id,
        kind: 'og-image',
        mimeType: req.file.mimetype,
        fileName: stored.fileName,
        byteSize: req.file.size,
        storagePath: stored.storagePath,
      },
    });

    const updated = await prisma.retailJoinBranding.update({
      where: { ownerId: req.user.id },
      data: {
        ogImageAssetId: asset.id,
        ogImageUrl: null,
      },
      include: { logoAsset: true, ogImageAsset: true },
    });

    if (branding.ogImageAssetId && branding.ogImageAssetId !== asset.id) {
      await removeAsset(branding.ogImageAssetId);
    }

    res.json({
      ok: true,
      branding: formatBrandingResponse(req, updated),
    });
  } catch (e) {
    next(e);
  }
}

async function deleteLogo(req, res, next) {
  try {
    const branding = await ensureBranding(req.user.id);
    const assetId = branding.logoAssetId;

    const updated = await prisma.retailJoinBranding.update({
      where: { ownerId: req.user.id },
      data: { logoAssetId: null },
      include: { logoAsset: true, ogImageAsset: true },
    });

    if (assetId) {
      await removeAsset(assetId);
    }

    res.json({
      ok: true,
      branding: formatBrandingResponse(req, updated),
    });
  } catch (e) {
    next(e);
  }
}

async function deleteOgImage(req, res, next) {
  try {
    const branding = await ensureBranding(req.user.id);
    const assetId = branding.ogImageAssetId;

    const updated = await prisma.retailJoinBranding.update({
      where: { ownerId: req.user.id },
      data: { ogImageAssetId: null },
      include: { logoAsset: true, ogImageAsset: true },
    });

    if (assetId) {
      await removeAsset(assetId);
    }

    res.json({
      ok: true,
      branding: formatBrandingResponse(req, updated),
    });
  } catch (e) {
    next(e);
  }
}

router.get('/retail/join-branding', requireAuth, getBranding);
router.get('/retail/branding', requireAuth, getBranding);

router.put('/retail/join-branding', requireAuth, updateBranding);
router.put('/retail/branding', requireAuth, updateBranding);

router.post('/retail/join-branding/logo', requireAuth, logoUpload, uploadLogo);
router.post('/retail/branding/logo', requireAuth, logoUpload, uploadLogo);

router.post('/retail/join-branding/og-image', requireAuth, ogUpload, uploadOgImage);
router.post('/retail/branding/og-image', requireAuth, ogUpload, uploadOgImage);

router.delete('/retail/join-branding/logo', requireAuth, deleteLogo);
router.delete('/retail/branding/logo', requireAuth, deleteLogo);

router.delete('/retail/join-branding/og-image', requireAuth, deleteOgImage);
router.delete('/retail/branding/og-image', requireAuth, deleteOgImage);

module.exports = router;
