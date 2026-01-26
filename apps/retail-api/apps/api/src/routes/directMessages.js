// apps/api/src/routes/directMessages.js
const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/requireAuth');
const { normalizePhoneToE164 } = require('../lib/phone');
const { canSendOrSpendCredits } = require('../services/subscription.service');
const { getWalletSummary } = require('../services/wallet.service');
const { reserveCredits, commitReservationById, releaseReservationById } = require('../services/credit-reservation.service');
const { sendSingle } = require('../services/mitto.service');
const { shortenUrlsInText } = require('../services/urlShortener.service');
const { generateUnsubscribeToken } = require('../services/token.service');
const { buildUnsubscribeShortUrl } = require('../services/publicLinkBuilder.service');
const { getMessagePolicy, isMessageType, normalizeMessageType, normalizeMessageBody } = require('../services/messagePolicy');
const { checkMessageGuards } = require('../services/messageGuards.service');
const pino = require('pino');

const router = express.Router();
const logger = pino({ name: 'direct-messages' });

function normalizeIdempotencyKey(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 128);
}

function mapMittoToStatus(deliveryStatus) {
  const v = String(deliveryStatus || '').toLowerCase().trim();
  if (v === 'failure' || v === 'failed' || v === 'undelivered' || v === 'expired' || v === 'rejected' || v === 'error') {
    return 'failed';
  }
  return 'sent';
}

router.post('/direct-messages', requireAuth, async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const requestId = req.id || req.headers['x-request-id'] || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const { contactId, phone, messageBody, messageType } = req.body || {};
    const idempotencyKey = normalizeIdempotencyKey(req.headers['idempotency-key']);

    if (!messageBody || typeof messageBody !== 'string' || !messageBody.trim()) {
      return res.status(400).json({
        message: 'Message body is required',
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }

    if (idempotencyKey) {
      const existing = await prisma.directMessage.findFirst({
        where: { ownerId, idempotencyKey },
      });
      if (existing) {
        return res.json({
          id: existing.id,
          status: existing.status,
          deliveryStatus: existing.deliveryStatus,
          providerMessageId: existing.providerMessageId,
          creditsCharged: existing.creditsCharged,
          phoneE164: existing.phoneE164,
          messageBody: existing.messageBody,
          messageType: existing.messageType,
          requestId,
          idempotent: true,
        });
      }
    }

    let contact = null;
    if (contactId) {
      contact = await prisma.contact.findFirst({
        where: { id: Number(contactId), ownerId },
        select: { id: true, phone: true, isSubscribed: true, serviceAllowed: true },
      });
      if (!contact) {
        return res.status(404).json({
          message: 'Contact not found',
          code: 'RESOURCE_NOT_FOUND',
          requestId,
        });
      }
    }

    let phoneE164 = contact?.phone || null;
    if (!phoneE164) {
      const normalized = normalizePhoneToE164(phone);
      if (!normalized) {
        return res.status(400).json({
          message: 'Valid phone number is required (E.164)',
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }
      phoneE164 = normalized;
    }

    if (!contact) {
      contact = await prisma.contact.findFirst({
        where: { ownerId, phone: phoneE164 },
        select: { id: true, isSubscribed: true, serviceAllowed: true },
      });
    }

    if (messageType && !isMessageType(messageType)) {
      return res.status(400).json({
        message: 'Invalid message type. Use marketing or service.',
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }

    const normalizedMessageType = normalizeMessageType(messageType);

    if (normalizedMessageType === 'marketing' && contact && contact.isSubscribed === false) {
      return res.status(403).json({
        message: 'Contact is unsubscribed. Marketing messages are blocked.',
        code: 'CONTACT_UNSUBSCRIBED',
        requestId,
      });
    }

    if (normalizedMessageType === 'service') {
      if (!contact?.id) {
        return res.status(400).json({
          message: 'Contact is required for service messages.',
          code: 'CONTACT_REQUIRED',
          requestId,
        });
      }
      if (contact.serviceAllowed === false) {
        return res.status(403).json({
          message: 'Contact has not allowed service messages.',
          code: 'SERVICE_NOT_ALLOWED',
          requestId,
        });
      }
    }

    const subscriptionGate = await canSendOrSpendCredits(ownerId);
    if (!subscriptionGate.allowed) {
      return res.status(403).json({
        message: subscriptionGate.message || 'Active subscription required to send SMS.',
        code: 'SUBSCRIPTION_REQUIRED',
        requestId,
      });
    }

    const walletSummary = await getWalletSummary(ownerId);
    if ((walletSummary.available || 0) < 1) {
      return res.status(402).json({
        message: "You don't have enough credits to send this message.",
        code: 'INSUFFICIENT_CREDITS',
        requestId,
      });
    }

    const guard = await checkMessageGuards({
      ownerId,
      contactId: contact?.id || null,
      phoneE164,
      messageType: normalizedMessageType,
    });
    if (!guard.allowed) {
      const isRateLimit = String(guard.reason || '').includes('limit');
      return res.status(isRateLimit ? 429 : 403).json({
        message: guard.message || 'Sending is blocked by safety guardrails.',
        code: guard.reason || 'GUARD_BLOCKED',
        requestId,
      });
    }

    let finalText = await shortenUrlsInText(messageBody, { ownerId, kind: 'message' });
    const policy = getMessagePolicy(normalizedMessageType, false);
    let unsubscribeUrl = null;

    if (policy.appendUnsubscribe) {
      if (!contact?.id) {
        return res.status(400).json({
          message: 'Contact is required to generate unsubscribe link for marketing messages.',
          code: 'CONTACT_REQUIRED',
          requestId,
        });
      }
      try {
        const unsubscribeToken = generateUnsubscribeToken(contact.id, ownerId, null);
        const unsubscribe = await buildUnsubscribeShortUrl({
          token: unsubscribeToken,
          ownerId,
          campaignId: null,
          campaignMessageId: null,
        });
        unsubscribeUrl = unsubscribe?.shortUrl || null;
      } catch (tokenErr) {
        const errMsg = tokenErr?.message || 'Unable to shorten unsubscribe link';
        logger.error({ ownerId, contactId: contact.id, err: errMsg }, 'Failed to build unsubscribe short link');
        return res.status(500).json({
          message: 'Failed to prepare unsubscribe link',
          code: 'SHORTLINK_ERROR',
          requestId,
        });
      }
    }

    const normalized = normalizeMessageBody(finalText, policy, {
      offerUrl: null,
      unsubscribeUrl,
    });
    finalText = normalized.text;

    const directMessage = await prisma.directMessage.create({
      data: {
        ownerId,
        contactId: contact?.id || null,
        phoneE164,
        messageBody: finalText,
        messageType: normalizedMessageType,
        status: 'pending',
        idempotencyKey,
      },
    });

    let reservationId = null;
    try {
      const reservationKey = idempotencyKey ? `direct:${idempotencyKey}` : null;
      const reservationResult = await reserveCredits(ownerId, 1, {
        idempotencyKey: reservationKey,
        reason: 'direct:send',
        meta: { directMessageId: directMessage.id, contactId: contact?.id || null },
      });
      reservationId = reservationResult?.reservation?.id || null;
      if (reservationId) {
        await prisma.directMessage.update({
          where: { id: directMessage.id },
          data: { reservationId },
        });
      }
    } catch (reserveErr) {
      if (reserveErr.message === 'INSUFFICIENT_CREDITS') {
        await prisma.directMessage.update({
          where: { id: directMessage.id },
          data: { status: 'failed', error: 'INSUFFICIENT_CREDITS' },
        });
        return res.status(402).json({
          message: "You don't have enough credits to send this message.",
          code: 'INSUFFICIENT_CREDITS',
          requestId,
        });
      }
      throw reserveErr;
    }

    let sendResult = null;
    try {
      sendResult = await sendSingle({
        userId: ownerId,
        destination: phoneE164,
        text: finalText,
      });
    } catch (err) {
      if (reservationId) {
        try {
          await releaseReservationById(ownerId, reservationId);
        } catch (releaseErr) {
          logger.warn({ ownerId, reservationId, err: releaseErr.message }, 'Failed to release reservation after send failure');
        }
      }

      await prisma.directMessage.update({
        where: { id: directMessage.id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          error: err.message || 'SEND_FAILED',
        },
      });

      return res.status(502).json({
        message: err.message || 'Failed to send SMS',
        code: 'SEND_FAILED',
        requestId,
      });
    }

    const providerMessageId = sendResult?.messageId || null;
    await prisma.directMessage.update({
      where: { id: directMessage.id },
      data: {
        status: 'sent',
        providerMessageId,
        sentAt: new Date(),
        deliveryStatus: 'Sent',
      },
    });

    let transactionId = null;
    let creditsCharged = null;
    if (reservationId) {
      try {
        const commitResult = await commitReservationById(ownerId, reservationId, {
          reason: 'direct:send',
          meta: { directMessageId: directMessage.id, contactId: contact?.id || null },
        });
        transactionId = commitResult?.transactionId || null;
        await prisma.directMessage.update({
          where: { id: directMessage.id },
          data: {
            creditsCharged: 1,
            transactionId,
          },
        });
        creditsCharged = 1;
      } catch (commitErr) {
        logger.error({ ownerId, reservationId, err: commitErr.message }, 'Failed to commit reservation after send');
      }
    }

    return res.json({
      id: directMessage.id,
      status: 'sent',
      deliveryStatus: 'Sent',
      providerMessageId,
      creditsCharged,
      phoneE164,
      messageBody: finalText,
      messageType: normalizedMessageType,
      requestId,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/direct-messages/:id', requireAuth, async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        message: 'Invalid message ID',
        code: 'VALIDATION_ERROR',
      });
    }

    const message = await prisma.directMessage.findFirst({
      where: { id, ownerId },
    });

    if (!message) {
      return res.status(404).json({
        message: 'Message not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    return res.json(message);
  } catch (e) {
    next(e);
  }
});

router.post('/direct-messages/:id/refresh', requireAuth, async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        message: 'Invalid message ID',
        code: 'VALIDATION_ERROR',
      });
    }

    const message = await prisma.directMessage.findFirst({
      where: { id, ownerId },
    });

    if (!message) {
      return res.status(404).json({
        message: 'Message not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (!message.providerMessageId) {
      return res.status(400).json({
        message: 'Provider message ID is required for refresh',
        code: 'MISSING_PROVIDER_ID',
      });
    }

    const { getMessageStatus } = require('../services/mitto.service');
    const status = await getMessageStatus(message.providerMessageId);
    const delivery = status?.deliveryStatus || null;
    const internalStatus = mapMittoToStatus(delivery);

    const updateData = {
      status: internalStatus,
      deliveryStatus: delivery,
      deliveryLastCheckedAt: new Date(),
    };

    if (internalStatus === 'sent') {
      updateData.sentAt = message.sentAt || (status.updatedAt ? new Date(status.updatedAt) : new Date());
      if (delivery && String(delivery).toLowerCase().includes('deliv')) {
        updateData.deliveredAt = status.updatedAt ? new Date(status.updatedAt) : new Date();
      }
    } else if (internalStatus === 'failed') {
      updateData.failedAt = status.updatedAt ? new Date(status.updatedAt) : new Date();
      updateData.error = `Mitto status: ${delivery || 'failed'}`;
    }

    const updated = await prisma.directMessage.update({
      where: { id: message.id },
      data: updateData,
    });

    res.json({
      message: updated,
      providerStatus: status,
    });
  } catch (e) {
    if (e.message && e.message.includes('not found')) {
      return res.status(404).json({
        message: e.message,
        code: 'MESSAGE_NOT_FOUND',
      });
    }
    next(e);
  }
});

module.exports = router;
