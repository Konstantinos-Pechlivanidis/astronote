// apps/api/src/routes/automationLibrary.js
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  listAutomationLibrary,
  upsertAutomationRule,
} = require('../services/automationLibrary.service');

const router = express.Router();

router.get('/automation-library', requireAuth, async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const result = await listAutomationLibrary(ownerId);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.put('/automation-library/:presetKey', requireAuth, async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const presetKey = String(req.params.presetKey || '').trim();
    if (!presetKey) {
      return res.status(400).json({
        message: 'Preset key is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const { isActive, messageBody } = req.body || {};
    if (messageBody !== undefined && typeof messageBody !== 'string') {
      return res.status(400).json({
        message: 'Message body must be a string',
        code: 'VALIDATION_ERROR',
      });
    }

    const rule = await upsertAutomationRule(ownerId, presetKey, {
      isActive,
      messageBody,
    });

    res.json({ rule });
  } catch (e) {
    if (e.code === 'PRESET_NOT_FOUND') {
      return res.status(404).json({
        message: e.message,
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    next(e);
  }
});

module.exports = router;
