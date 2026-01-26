// apps/api/src/routes/messageLogs.js
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { listMessageLogs } = require('../services/messageLogs.service');
const { generateMessagingExport } = require('../services/messaging-export.service');

const router = express.Router();

router.get('/message-logs', requireAuth, async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const page = req.query.page || '1';
    const pageSize = req.query.pageSize || '50';
    const status = req.query.status || undefined;
    const messageType = req.query.messageType || undefined;
    const source = req.query.source || undefined;
    const phone = req.query.phone || undefined;
    const from = req.query.from || undefined;
    const to = req.query.to || undefined;

    const result = await listMessageLogs({
      ownerId,
      page,
      pageSize,
      status,
      messageType,
      source,
      phone,
      from,
      to,
    });

    return res.json(result);
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        message: err.message,
        code: 'VALIDATION_ERROR',
      });
    }
    return next(err);
  }
});

router.get('/message-logs/export', requireAuth, async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const from = req.query.from;
    const to = req.query.to;

    if (!from || !to) {
      return res.status(400).json({
        message: 'from and to are required for export',
        code: 'VALIDATION_ERROR',
      });
    }

    const exportPayload = await generateMessagingExport({ start: from, end: to, ownerId });
    const fileStamp = `${exportPayload.range.start.toISOString().slice(0, 10)}_${exportPayload.range.end.toISOString().slice(0, 10)}`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="message_logs_${fileStamp}.csv"`);
    return res.send(exportPayload.csv);
  } catch (err) {
    if (err.message && err.message.includes('Invalid date range')) {
      return res.status(400).json({
        message: 'Invalid date range',
        code: 'VALIDATION_ERROR',
      });
    }
    return next(err);
  }
});

module.exports = router;
