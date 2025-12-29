import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { createHash } from 'crypto';

/**
 * Idempotency Service (P0)
 * Handles idempotency keys for financial operations and endpoints
 */

/**
 * Generate idempotency key from components
 * @param {...string} components - Components to hash
 * @returns {string} SHA256 hash
 */
export function generateIdempotencyKey(...components) {
  const combined = components.filter(Boolean).join(':');
  return createHash('sha256').update(combined).digest('hex');
}

/**
 * Check if enqueue request already exists (endpoint-level idempotency)
 * @param {string} shopId - Shop ID
 * @param {string} campaignId - Campaign ID
 * @param {string} idempotencyKey - Idempotency key from header
 * @returns {Promise<Object|null>} Existing request or null
 */
export async function checkEnqueueRequest(shopId, campaignId, idempotencyKey) {
  if (!idempotencyKey) return null;

  try {
    const existing = await prisma.enqueueRequest.findUnique({
      where: {
        shopId_campaignId_idempotencyKey: {
          shopId,
          campaignId,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      logger.info('Enqueue request already processed (idempotency)', {
        shopId,
        campaignId,
        idempotencyKey: `${idempotencyKey.substring(0, 8)}...`,
        status: existing.status,
      });
      return existing;
    }

    return null;
  } catch (error) {
    logger.error('Error checking enqueue request', {
      shopId,
      campaignId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Record enqueue request (idempotent)
 * @param {string} shopId - Shop ID
 * @param {string} campaignId - Campaign ID
 * @param {string} idempotencyKey - Idempotency key
 * @param {Object} result - Result to store
 * @returns {Promise<Object>} EnqueueRequest record
 */
export async function recordEnqueueRequest(shopId, campaignId, idempotencyKey, result) {
  if (!idempotencyKey) {
    // Generate deterministic key if not provided
    idempotencyKey = generateIdempotencyKey(shopId, campaignId, Date.now().toString());
  }

  try {
    const request = await prisma.enqueueRequest.create({
      data: {
        shopId,
        campaignId,
        idempotencyKey,
        status: 'completed',
        result,
      },
    });

    logger.debug('Enqueue request recorded', {
      shopId,
      campaignId,
      idempotencyKey: `${idempotencyKey.substring(0, 8)}...`,
    });

    return request;
  } catch (error) {
    // Handle unique constraint violation (duplicate)
    if (error.code === 'P2002') {
      const existing = await prisma.enqueueRequest.findUnique({
        where: {
          shopId_campaignId_idempotencyKey: {
            shopId,
            campaignId,
            idempotencyKey,
          },
        },
      });
      logger.warn('Enqueue request already exists (race condition)', {
        shopId,
        campaignId,
      });
      return existing;
    }
    throw error;
  }
}

/**
 * Check if credit transaction with idempotency key already exists
 * @param {string} shopId - Shop ID
 * @param {string} idempotencyKey - Idempotency key
 * @returns {Promise<Object|null>} Existing transaction or null
 */
export async function checkCreditTransactionIdempotency(shopId, idempotencyKey) {
  if (!idempotencyKey) return null;

  try {
    const existing = await prisma.creditTransaction.findUnique({
      where: {
        shopId_idempotencyKey: {
          shopId,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      logger.info('Credit transaction already processed (idempotency)', {
        shopId,
        idempotencyKey: `${idempotencyKey.substring(0, 8)}...`,
        transactionId: existing.id,
      });
      return existing;
    }

    return null;
  } catch (error) {
    logger.error('Error checking credit transaction idempotency', {
      shopId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Check if billing transaction with idempotency key already exists
 * @param {string} shopId - Shop ID
 * @param {string} idempotencyKey - Idempotency key (e.g., stripeEventId)
 * @returns {Promise<Object|null>} Existing transaction or null
 */
export async function checkBillingTransactionIdempotency(shopId, idempotencyKey) {
  if (!idempotencyKey) return null;

  try {
    const existing = await prisma.billingTransaction.findUnique({
      where: {
        shopId_idempotencyKey: {
          shopId,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      logger.info('Billing transaction already processed (idempotency)', {
        shopId,
        idempotencyKey: `${idempotencyKey.substring(0, 8)}...`,
        transactionId: existing.id,
      });
      return existing;
    }

    return null;
  } catch (error) {
    logger.error('Error checking billing transaction idempotency', {
      shopId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Generate reservation key for credit reservation idempotency
 * @param {string} shopId - Shop ID
 * @param {string} campaignId - Campaign ID (optional)
 * @param {string} customKey - Custom key (optional)
 * @returns {string} Reservation key
 */
export function generateReservationKey(shopId, campaignId = null, customKey = null) {
  if (customKey) return customKey;
  if (campaignId) return `campaign:${campaignId}`;
  return generateIdempotencyKey(shopId, Date.now().toString());
}

/**
 * Check if credit reservation with key already exists
 * @param {string} shopId - Shop ID
 * @param {string} reservationKey - Reservation key
 * @returns {Promise<Object|null>} Existing reservation or null
 */
export async function checkCreditReservationIdempotency(shopId, reservationKey) {
  if (!reservationKey) return null;

  try {
    const existing = await prisma.creditReservation.findUnique({
      where: {
        shopId_reservationKey: {
          shopId,
          reservationKey,
        },
      },
    });

    if (existing && existing.status === 'active') {
      logger.info('Credit reservation already exists (idempotency)', {
        shopId,
        reservationKey,
        reservationId: existing.id,
      });
      return existing;
    }

    return null;
  } catch (error) {
    logger.error('Error checking credit reservation idempotency', {
      shopId,
      error: error.message,
    });
    throw error;
  }
}

export default {
  generateIdempotencyKey,
  checkEnqueueRequest,
  recordEnqueueRequest,
  checkCreditTransactionIdempotency,
  checkBillingTransactionIdempotency,
  generateReservationKey,
  checkCreditReservationIdempotency,
};

