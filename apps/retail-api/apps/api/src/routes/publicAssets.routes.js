const express = require('express');
const fs = require('node:fs');
const prisma = require('../lib/prisma');
const { resolveStoragePath } = require('../lib/retailAssetStorage');

const router = express.Router();

router.get('/public/assets/:assetId', async (req, res, next) => {
  try {
    const assetId = Number(req.params.assetId);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      return res.status(400).json({ message: 'Invalid asset id', code: 'VALIDATION_ERROR' });
    }

    const asset = await prisma.retailAsset.findUnique({ where: { id: assetId } });
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found', code: 'NOT_FOUND' });
    }

    const absPath = resolveStoragePath(asset.storagePath);

    res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Disposition', `inline; filename="${asset.fileName}"`);

    const stream = fs.createReadStream(absPath);
    stream.on('error', (err) => {
      if (err && err.code === 'ENOENT') {
        return res.status(404).json({ message: 'Asset not found', code: 'NOT_FOUND' });
      }
      return next(err);
    });
    stream.pipe(res);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
