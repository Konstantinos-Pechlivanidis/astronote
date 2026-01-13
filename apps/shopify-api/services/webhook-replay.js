import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { createHash } from 'crypto';

/**
 * Webhook Replay Protection Service (P0)
 * Prevents duplicate processing of webhook events
 */

/**
 * Generate event hash for deduplication
 * @param {Object} payload - Webhook payload
 * @returns {string} SHA256 hash
 */
export function generateEventHash(payload) {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return createHash('sha256').update(payloadStr).digest('hex');
}

/**
 * Check if webhook event was already processed (replay protection)
 * @param {string} provider - 'shopify', 'stripe', 'mitto'
 * @param {string} eventId - Provider's event ID
 * @param {string} eventHash - Optional hash for additional deduplication
 * @param {string} shopId - Optional shop ID
 * @returns {Promise<Object|null>} Existing event record or null
 */
export async function checkWebhookReplay(provider, eventId, eventHash = null, shopId = null) {
  try {
    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });

    if (existing) {
      logger.info('Webhook event already processed (replay detected)', {
        provider,
        eventId,
        shopId,
        previousStatus: existing.status,
        receivedAt: existing.receivedAt,
      });
      return existing;
    }

    // Optional: Check by hash if provided (for events without stable IDs)
    if (eventHash) {
      const byHash = await prisma.webhookEvent.findFirst({
        where: {
          provider,
          shopId: shopId || undefined,
          OR: [
            { eventHash },
            { payloadHash: eventHash },
          ],
        },
        orderBy: { receivedAt: 'desc' },
      });

      if (byHash) {
        logger.info('Webhook event duplicate detected by hash', {
          provider,
          eventId,
          eventHash,
          shopId,
          previousEventId: byHash.eventId,
        });
        return byHash;
      }
    }

    return null;
  } catch (error) {
    logger.error('Error checking webhook replay', {
      provider,
      eventId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Record webhook event (idempotent)
 * @param {string} provider - 'shopify', 'stripe', 'mitto'
 * @param {string} eventId - Provider's event ID
 * @param {Object} options - Options
 * @param {string} options.eventHash - Optional hash
 * @param {string} options.shopId - Optional shop ID
 * @param {Object} options.payload - Full payload (optional, for debugging)
 * @returns {Promise<Object>} WebhookEvent record
 */
export async function recordWebhookEvent(provider, eventId, options = {}) {
  const { eventHash, payloadHash, eventType, shopId, payload, status } = options;

  try {
    // Use create with skipDuplicates for idempotency
    const event = await prisma.webhookEvent.create({
      data: {
        provider,
        eventId,
        eventHash: eventHash || payloadHash || null,
        payloadHash: payloadHash || eventHash || null,
        eventType: eventType || null,
        shopId: shopId || null,
        payload: payload || null,
        status: status || 'received',
      },
    });

    logger.debug('Webhook event recorded', {
      provider,
      eventId,
      shopId,
    });

    return event;
  } catch (error) {
    // Handle unique constraint violation (duplicate)
    if (error.code === 'P2002') {
      const existing = await prisma.webhookEvent.findUnique({
        where: {
          provider_eventId: {
            provider,
            eventId,
          },
        },
      });
      logger.warn('Webhook event already exists (race condition)', {
        provider,
        eventId,
        shopId,
      });
      return existing;
    }
    throw error;
  }
}

/**
 * Mark webhook event as processed
 * @param {string} eventId - WebhookEvent ID
 * @param {Object} options - Options
 * @param {string} options.status - 'processed' | 'failed'
 * @param {string} options.error - Error message if failed
 * @returns {Promise<Object>} Updated event
 */
export async function markWebhookProcessed(eventId, options = {}) {
  const { status = 'processed', error = null } = options;

  return await prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      status,
      processedAt: new Date(),
      error,
      updatedAt: new Date(),
    },
  });
}

/**
 * Validate webhook timestamp (reject too old events)
 * @param {Date|string} eventTimestamp - Event timestamp
 * @param {number} maxAgeMinutes - Maximum age in minutes (default: 5)
 * @returns {boolean} True if valid, false if too old
 */
export function validateWebhookTimestamp(eventTimestamp, maxAgeMinutes = 5) {
  if (!eventTimestamp) return true; // No timestamp, allow

  const eventDate = new Date(eventTimestamp);
  const now = new Date();
  const ageMinutes = (now - eventDate) / (1000 * 60);

  if (ageMinutes > maxAgeMinutes) {
    logger.warn('Webhook event too old, rejecting', {
      eventTimestamp,
      ageMinutes: Math.round(ageMinutes * 100) / 100,
      maxAgeMinutes,
    });
    return false;
  }

  return true;
}

/**
 * Process webhook with replay protection wrapper
 * @param {string} provider - 'shopify', 'stripe', 'mitto'
 * @param {string} eventId - Provider's event ID
 * @param {Function} processor - Async function to process the event
 * @param {Object} options - Options
 * @returns {Promise<Object>} Processing result
 */
export async function processWebhookWithReplayProtection(
  provider,
  eventId,
  processor,
  options = {},
) {
  const { eventHash, payloadHash, eventType, shopId, payload, eventTimestamp } = options;

  // Check replay
  const replayHash = eventHash || payloadHash || null;
  const existing = await checkWebhookReplay(provider, eventId, replayHash, shopId);
  if (existing) {
    // Return 200 OK but do nothing (prevent retries)
    logger.info('Webhook replay detected, returning success without processing', {
      provider,
      eventId,
      shopId,
    });
    return {
      processed: false,
      reason: 'duplicate',
      existingEvent: existing,
    };
  }

  // Validate timestamp if provided
  if (eventTimestamp && !validateWebhookTimestamp(eventTimestamp)) {
    return {
      processed: false,
      reason: 'too_old',
    };
  }

  // Record event
  const webhookEvent = await recordWebhookEvent(provider, eventId, {
    eventHash,
    payloadHash,
    eventType,
    shopId,
    payload,
  });

  try {
    // Process event
    const result = await processor();

    // Mark as processed
    await markWebhookProcessed(webhookEvent.id, { status: 'processed' });

    return {
      processed: true,
      result,
      webhookEventId: webhookEvent.id,
    };
  } catch (error) {
    // Mark as failed
    await markWebhookProcessed(webhookEvent.id, {
      status: 'failed',
      error: error.message,
    });

    throw error;
  }
}

export default {
  checkWebhookReplay,
  recordWebhookEvent,
  markWebhookProcessed,
  validateWebhookTimestamp,
  processWebhookWithReplayProtection,
  generateEventHash,
};
