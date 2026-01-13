const prisma = require('../lib/prisma');
const { createHash } = require('crypto');
const pino = require('pino');

const logger = pino({ name: 'webhook-replay' });

const generateEventHash = (payload) => {
  if (Buffer.isBuffer(payload)) {
    return createHash('sha256').update(payload).digest('hex');
  }
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return createHash('sha256').update(payloadStr).digest('hex');
};

async function checkWebhookReplay(provider, eventId, payloadHash = null, ownerId = null) {
  const existing = await prisma.webhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider,
        eventId,
      },
    },
  });

  if (existing) {
    logger.info({ provider, eventId, ownerId }, 'Webhook replay detected');
    return existing;
  }

  if (payloadHash) {
    const byHash = await prisma.webhookEvent.findFirst({
      where: {
        provider,
        ownerId: ownerId || undefined,
        payloadHash,
      },
      orderBy: { receivedAt: 'desc' },
    });

    if (byHash) {
      logger.info({ provider, eventId, ownerId }, 'Webhook duplicate detected by hash');
      return byHash;
    }
  }

  return null;
}

async function recordWebhookEvent(provider, eventId, options = {}) {
  const { payloadHash, eventType, ownerId, payload, status } = options;

  try {
    return await prisma.webhookEvent.create({
      data: {
        provider,
        eventId,
        payloadHash: payloadHash || null,
        eventType: eventType || null,
        ownerId: ownerId || null,
        payload: payload || null,
        status: status || 'received',
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const existing = await prisma.webhookEvent.findUnique({
        where: {
          provider_eventId: {
            provider,
            eventId,
          },
        },
      });
      logger.warn({ provider, eventId, ownerId }, 'Webhook event already exists');
      return existing;
    }
    throw error;
  }
}

async function markWebhookProcessed(eventId, options = {}) {
  const { status = 'processed', error = null } = options;

  return prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      status,
      processedAt: new Date(),
      error,
      updatedAt: new Date(),
    },
  });
}

const validateWebhookTimestamp = (eventTimestamp, maxAgeMinutes = 5) => {
  if (!eventTimestamp) {return true;}

  const eventDate = new Date(eventTimestamp);
  const now = new Date();
  const ageMinutes = (now - eventDate) / (1000 * 60);

  if (ageMinutes > maxAgeMinutes) {
    logger.warn({ eventTimestamp, ageMinutes }, 'Webhook event too old');
    return false;
  }

  return true;
};

async function processWebhookWithReplayProtection(
  provider,
  eventId,
  processor,
  options = {},
) {
  const { payloadHash, eventType, ownerId, payload, eventTimestamp } = options;

  const existing = await checkWebhookReplay(provider, eventId, payloadHash, ownerId);
  if (existing) {
    return { processed: false, reason: 'duplicate', existingEvent: existing };
  }

  if (eventTimestamp && !validateWebhookTimestamp(eventTimestamp)) {
    return { processed: false, reason: 'too_old' };
  }

  const webhookEvent = await recordWebhookEvent(provider, eventId, {
    payloadHash,
    eventType,
    ownerId,
    payload,
  });

  try {
    const result = await processor();
    await markWebhookProcessed(webhookEvent.id, { status: 'processed' });
    return { processed: true, result, webhookEventId: webhookEvent.id };
  } catch (error) {
    await markWebhookProcessed(webhookEvent.id, {
      status: 'failed',
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  generateEventHash,
  checkWebhookReplay,
  recordWebhookEvent,
  markWebhookProcessed,
  processWebhookWithReplayProtection,
  validateWebhookTimestamp,
};
