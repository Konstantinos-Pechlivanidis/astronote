// apps/api/src/routes/events.js
const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/requireAuth');
const { normalizePhoneToE164 } = require('../lib/phone');
const { sanitizeString } = require('../lib/sanitize');

const router = express.Router();

const EVENT_TYPES = ['appointment', 'membership', 'stay', 'purchase', 'visit', 'custom'];
const EVENT_STATUSES = ['scheduled', 'completed', 'canceled', 'no_show'];

function parseDate(value, label) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error(`Invalid ${label} date`);
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return date;
}

router.post('/events', requireAuth, async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const {
      contactId,
      phone,
      eventType,
      status,
      startAt,
      endAt,
      externalRef,
      meta,
    } = req.body || {};

    if (!eventType || !EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({
        message: 'Invalid event type',
        code: 'VALIDATION_ERROR',
      });
    }

    const normalizedStatus = status ? String(status) : 'scheduled';
    if (!EVENT_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        message: 'Invalid event status',
        code: 'VALIDATION_ERROR',
      });
    }

    let startDate = null;
    let endDate = null;
    try {
      startDate = parseDate(startAt, 'startAt');
      endDate = parseDate(endAt, 'endAt');
    } catch (err) {
      return res.status(400).json({
        message: err.message,
        code: err.code || 'VALIDATION_ERROR',
      });
    }

    if (meta !== undefined && (typeof meta !== 'object' || Array.isArray(meta))) {
      return res.status(400).json({
        message: 'Meta must be an object',
        code: 'VALIDATION_ERROR',
      });
    }

    let contact = null;
    let resolvedContactId = contactId ? Number(contactId) : null;
    if (resolvedContactId) {
      if (Number.isNaN(resolvedContactId)) {
        return res.status(400).json({
          message: 'Invalid contact ID',
          code: 'VALIDATION_ERROR',
        });
      }
      contact = await prisma.contact.findFirst({
        where: { id: resolvedContactId, ownerId },
        select: { id: true, phone: true },
      });
      if (!contact) {
        return res.status(404).json({
          message: 'Contact not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
    }

    let phoneE164 = null;
    if (phone) {
      const normalized = normalizePhoneToE164(phone);
      if (!normalized) {
        return res.status(400).json({
          message: 'Invalid phone number format. Use E.164 (e.g., +306912345678).',
          code: 'VALIDATION_ERROR',
        });
      }
      phoneE164 = normalized;
    }

    if (!contact && phoneE164) {
      contact = await prisma.contact.findFirst({
        where: { ownerId, phone: phoneE164 },
        select: { id: true, phone: true },
      });
      if (contact) {
        resolvedContactId = contact.id;
      }
    }

    if (!phoneE164 && contact?.phone) {
      phoneE164 = contact.phone;
    }

    const cleanedExternalRef = externalRef
      ? sanitizeString(String(externalRef), { maxLength: 200 })
      : null;

    const created = await prisma.customerEvent.create({
      data: {
        ownerId,
        contactId: resolvedContactId || null,
        phoneE164,
        externalRef: cleanedExternalRef,
        eventType,
        status: normalizedStatus,
        startAt: startDate,
        endAt: endDate,
        meta: meta || undefined,
      },
      include: {
        contact: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            isSubscribed: true,
            serviceAllowed: true,
          },
        },
      },
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

router.get('/events', requireAuth, async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
    const eventType = req.query.type ? String(req.query.type) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const contactIdRaw = req.query.contactId ? String(req.query.contactId) : null;
    const phone = req.query.phone ? String(req.query.phone) : null;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    if (eventType && !EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({
        message: 'Invalid event type',
        code: 'VALIDATION_ERROR',
      });
    }
    if (status && !EVENT_STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Invalid event status',
        code: 'VALIDATION_ERROR',
      });
    }

    const contactId = contactIdRaw ? Number(contactIdRaw) : null;
    if (contactIdRaw && Number.isNaN(contactId)) {
      return res.status(400).json({
        message: 'Invalid contact ID',
        code: 'VALIDATION_ERROR',
      });
    }

    let phoneE164 = null;
    if (phone) {
      const normalized = normalizePhoneToE164(phone);
      if (!normalized) {
        return res.status(400).json({
          message: 'Invalid phone number format. Use E.164 (e.g., +306912345678).',
          code: 'VALIDATION_ERROR',
        });
      }
      phoneE164 = normalized;
    }

    let rangeStart = null;
    let rangeEnd = null;
    try {
      rangeStart = parseDate(from, 'from');
      rangeEnd = parseDate(to, 'to');
    } catch (err) {
      return res.status(400).json({
        message: err.message,
        code: err.code || 'VALIDATION_ERROR',
      });
    }

    const where = {
      ownerId,
      ...(eventType ? { eventType } : {}),
      ...(status ? { status } : {}),
      ...(contactId ? { contactId } : {}),
      ...(phoneE164 ? { phoneE164 } : {}),
    };

    if (rangeStart || rangeEnd) {
      const range = {};
      if (rangeStart) {
        range.gte = rangeStart;
      }
      if (rangeEnd) {
        range.lte = rangeEnd;
      }
      where.OR = [{ startAt: range }, { endAt: range }];
    }

    const [items, total] = await Promise.all([
      prisma.customerEvent.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              isSubscribed: true,
              serviceAllowed: true,
            },
          },
        },
        orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customerEvent.count({ where }),
    ]);

    res.json({
      items,
      total,
      page,
      pageSize,
    });
  } catch (e) {
    next(e);
  }
});

router.patch('/events/:id/status', requireAuth, async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        message: 'Invalid event ID',
        code: 'VALIDATION_ERROR',
      });
    }

    const { status, startAt, endAt } = req.body || {};
    if (!status || !EVENT_STATUSES.includes(String(status))) {
      return res.status(400).json({
        message: 'Invalid event status',
        code: 'VALIDATION_ERROR',
      });
    }

    let startDate = null;
    let endDate = null;
    try {
      startDate = parseDate(startAt, 'startAt');
      endDate = parseDate(endAt, 'endAt');
    } catch (err) {
      return res.status(400).json({
        message: err.message,
        code: err.code || 'VALIDATION_ERROR',
      });
    }

    const updated = await prisma.customerEvent.updateMany({
      where: { id, ownerId },
      data: {
        status: String(status),
        ...(startDate ? { startAt: startDate } : {}),
        ...(endDate ? { endAt: endDate } : {}),
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({
        message: 'Event not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const event = await prisma.customerEvent.findFirst({
      where: { id, ownerId },
      include: {
        contact: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            isSubscribed: true,
            serviceAllowed: true,
          },
        },
      },
    });

    res.json(event);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
