import { logger } from '../utils/logger.js';
import prisma from './prisma.js';
import { scheduleAutomation } from './automation-scheduler.js';

/**
 * Schedule post-purchase series automations
 * Based on cursor_instructions.txt lines 191-200
 * @param {string} shopId - Shop ID
 * @param {string} contactId - Contact ID
 * @param {string} orderId - Order ID
 * @param {Object} fulfillmentData - Fulfillment data with estimatedDeliveryAt
 * @returns {Promise<Object>} Scheduled jobs information
 */
export async function schedulePostPurchaseSeries(
  shopId,
  contactId,
  orderId,
  fulfillmentData = {},
) {
  try {
    // Check if post-purchase series already exists for this order
    const existingSequence = await prisma.automationSequence.findFirst({
      where: {
        shopId,
        contactId,
        sequenceType: 'post_purchase',
        status: 'active',
        metadata: {
          path: ['orderId'],
          equals: orderId,
        },
      },
    });

    if (existingSequence) {
      logger.info('Post-purchase series already active for order', {
        shopId,
        contactId,
        orderId,
        sequenceId: existingSequence.id,
      });
      return {
        success: false,
        reason: 'Post-purchase series already active',
        sequenceId: existingSequence.id,
      };
    }

    // Create automation sequence record
    const sequence = await prisma.automationSequence.create({
      data: {
        shopId,
        contactId,
        sequenceType: 'post_purchase',
        currentStep: 1,
        totalSteps: 4, // Thank you, review, loyalty, restock
        status: 'active',
        startedAt: new Date(),
        metadata: {
          orderId,
          fulfillmentAt: fulfillmentData.createdAt || new Date().toISOString(),
          estimatedDeliveryAt:
            fulfillmentData.estimatedDeliveryAt || null,
        },
      },
    });

    const scheduledJobs = [];

    // SMS #1: Thank you (immediate, via order_placed - already sent)
    // This is handled by order_placed automation, so we skip it here

    // SMS #2: Review request (5-7 days after fulfillment)
    const fulfillmentDate = fulfillmentData.estimatedDeliveryAt
      ? new Date(fulfillmentData.estimatedDeliveryAt)
      : fulfillmentData.createdAt
        ? new Date(fulfillmentData.createdAt)
        : new Date();

    // Randomize between 5-7 days
    const reviewDelayDays = 5 + Math.floor(Math.random() * 3); // 5, 6, or 7 days
    const reviewDate = new Date(fulfillmentDate);
    reviewDate.setDate(reviewDate.getDate() + reviewDelayDays);
    const reviewDelayMs = reviewDate.getTime() - Date.now();

    if (reviewDelayMs > 0) {
      const job2 = await scheduleAutomation({
        jobName: 'review-request',
        data: {
          shopId,
          contactId,
          orderData: {
            orderNumber: orderId,
            estimatedDeliveryAt: fulfillmentData.estimatedDeliveryAt,
            ...fulfillmentData,
          },
        },
        delayMs: reviewDelayMs,
        jobId: `post-purchase-review-${shopId}-${orderId}-${Date.now()}`,
      });
      scheduledJobs.push(job2.id);
    }

    // SMS #3: Loyalty/referral (10-14 days after fulfillment)
    const loyaltyDelayDays = 10 + Math.floor(Math.random() * 5); // 10-14 days
    const loyaltyDate = new Date(fulfillmentDate);
    loyaltyDate.setDate(loyaltyDate.getDate() + loyaltyDelayDays);
    const loyaltyDelayMs = loyaltyDate.getTime() - Date.now();

    if (loyaltyDelayMs > 0) {
      const job3 = await scheduleAutomation({
        jobName: 'order-confirmation', // Reuse order confirmation for loyalty message
        data: {
          shopId,
          contactId,
          orderData: {
            orderNumber: orderId,
            postPurchaseStep: 'loyalty',
            ...fulfillmentData,
          },
        },
        delayMs: loyaltyDelayMs,
        jobId: `post-purchase-loyalty-${shopId}-${orderId}-${Date.now()}`,
      });
      scheduledJobs.push(job3.id);
    }

    // SMS #4: Restock reminder (30 days, for consumables - optional)
    // This would require product type detection, so we'll make it optional
    const restockDelayDays = 30;
    const restockDate = new Date(fulfillmentDate);
    restockDate.setDate(restockDate.getDate() + restockDelayDays);
    const restockDelayMs = restockDate.getTime() - Date.now();

    if (restockDelayMs > 0) {
      // Only schedule if products are consumables (would need product data)
      // For now, we'll schedule it but it can be filtered later
      const job4 = await scheduleAutomation({
        jobName: 'reorder_reminder',
        data: {
          shopId,
          contactId,
          orderData: {
            orderNumber: orderId,
            postPurchaseStep: 'restock',
            ...fulfillmentData,
          },
        },
        delayMs: restockDelayMs,
        jobId: `post-purchase-restock-${shopId}-${orderId}-${Date.now()}`,
      });
      scheduledJobs.push(job4.id);
    }

    // Update sequence with job IDs
    await prisma.automationSequence.update({
      where: { id: sequence.id },
      data: {
        scheduledJobs,
      },
    });

    logger.info('Post-purchase series scheduled', {
      shopId,
      contactId,
      orderId,
      sequenceId: sequence.id,
      scheduledJobs: scheduledJobs.length,
    });

    return {
      success: true,
      sequenceId: sequence.id,
      scheduledJobs: scheduledJobs.length,
    };
  } catch (error) {
    logger.error('Failed to schedule post-purchase series', {
      shopId,
      contactId,
      orderId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Cancel post-purchase series if order is cancelled/refunded
 * @param {string} shopId - Shop ID
 * @param {string} orderId - Order ID
 * @returns {Promise<number>} Number of jobs cancelled
 */
export async function cancelPostPurchaseSeries(shopId, orderId) {
  try {
    const sequence = await prisma.automationSequence.findFirst({
      where: {
        shopId,
        sequenceType: 'post_purchase',
        status: 'active',
        metadata: {
          path: ['orderId'],
          equals: orderId,
        },
      },
    });

    if (!sequence) {
      return 0;
    }

    let cancelledCount = 0;

    // Cancel all scheduled jobs
    if (sequence.scheduledJobs && sequence.scheduledJobs.length > 0) {
      const { cancelScheduledAutomation } = await import(
        './automation-scheduler.js'
      );
      for (const jobId of sequence.scheduledJobs) {
        const cancelled = await cancelScheduledAutomation(jobId, shopId);
        if (cancelled) {
          cancelledCount++;
        }
      }
    }

    // Mark sequence as cancelled
    await prisma.automationSequence.update({
      where: { id: sequence.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        scheduledJobs: [],
      },
    });

    logger.info('Post-purchase series cancelled', {
      shopId,
      orderId,
      sequenceId: sequence.id,
      cancelledCount,
    });

    return cancelledCount;
  } catch (error) {
    logger.error('Failed to cancel post-purchase series', {
      shopId,
      orderId,
      error: error.message,
    });
    return 0;
  }
}

export default {
  schedulePostPurchaseSeries,
  cancelPostPurchaseSeries,
};
