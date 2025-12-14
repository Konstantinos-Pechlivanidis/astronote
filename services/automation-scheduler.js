import { logger } from '../utils/logger.js';
import { automationQueue } from '../queue/index.js';
import prisma from './prisma.js';

/**
 * Schedule an automation job with optional delay
 * @param {Object} options - Scheduling options
 * @param {string} options.jobName - Job name (e.g., 'order-confirmation', 'abandoned-cart')
 * @param {Object} options.data - Job data
 * @param {number} options.delayMs - Delay in milliseconds (optional)
 * @param {string} options.jobId - Custom job ID (optional)
 * @returns {Promise<Object>} Bull job object
 */
export async function scheduleAutomation({
  jobName,
  data,
  delayMs = 0,
  jobId = null,
}) {
  try {
    const jobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    };

    if (delayMs > 0) {
      jobOptions.delay = delayMs;
    }

    if (jobId) {
      jobOptions.jobId = jobId;
    }

    const job = await automationQueue.add(jobName, data, jobOptions);

    // Store scheduled automation in database for tracking
    if (data.shopId && data.contactId) {
      try {
        await prisma.scheduledAutomation.create({
          data: {
            shopId: data.shopId,
            contactId: data.contactId,
            automationType: jobName,
            jobId: job.id,
            scheduledFor: delayMs > 0 ? new Date(Date.now() + delayMs) : new Date(),
            status: 'scheduled',
            orderId: data.orderData?.orderNumber || data.orderId || null,
            checkoutId: data.checkoutId || null,
            data,
          },
        });
      } catch (dbError) {
        // Don't fail if database write fails - job is still queued
        logger.warn('Failed to store scheduled automation in database', {
          jobId: job.id,
          error: dbError.message,
        });
      }
    }

    logger.info('Automation scheduled', {
      jobName,
      jobId: job.id,
      delayMs,
      shopId: data.shopId,
      contactId: data.contactId,
    });

    return job;
  } catch (error) {
    logger.error('Failed to schedule automation', {
      jobName,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Cancel a scheduled automation job
 * @param {string} jobId - Bull job ID
 * @param {string} shopId - Shop ID (for multi-tenant security)
 * @returns {Promise<boolean>} True if job was cancelled
 */
export async function cancelScheduledAutomation(jobId, shopId = null) {
  try {
    // Verify the job belongs to the shop (if shopId provided)
    if (shopId) {
      const scheduled = await prisma.scheduledAutomation.findFirst({
        where: {
          jobId,
          shopId,
        },
      });

      if (!scheduled) {
        logger.warn('Scheduled automation not found or shop mismatch', {
          jobId,
          shopId,
        });
        return false;
      }
    }

    const job = await automationQueue.getJob(jobId);

    if (!job) {
      logger.warn('Job not found for cancellation', { jobId });
      return false;
    }

    // Remove job from queue
    await job.remove();

    // Update database record (with shopId filter for security)
    try {
      const updateWhere = shopId ? { jobId, shopId } : { jobId };
      await prisma.scheduledAutomation.updateMany({
        where: updateWhere,
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });
    } catch (dbError) {
      logger.warn('Failed to update scheduled automation status', {
        jobId,
        shopId,
        error: dbError.message,
      });
    }

    logger.info('Scheduled automation cancelled', { jobId, shopId });
    return true;
  } catch (error) {
    logger.error('Failed to cancel scheduled automation', {
      jobId,
      shopId,
      error: error.message,
    });
    return false;
  }
}

/**
 * Cancel all scheduled automations for an order (e.g., abandoned checkout jobs)
 * @param {string} shopId - Shop ID
 * @param {string} orderId - Order ID or number
 * @returns {Promise<number>} Number of jobs cancelled
 */
export async function cancelAutomationsForOrder(shopId, orderId) {
  try {
    // Find all scheduled automations for this order
    const scheduledAutomations = await prisma.scheduledAutomation.findMany({
      where: {
        shopId,
        orderId: orderId.toString(),
        status: 'scheduled',
      },
    });

    let cancelledCount = 0;

    for (const scheduled of scheduledAutomations) {
      const cancelled = await cancelScheduledAutomation(scheduled.jobId);
      if (cancelled) {
        cancelledCount++;
      }
    }

    // Also cancel abandoned checkout jobs
    const abandonedCheckouts = await prisma.abandonedCheckout.findMany({
      where: {
        shopId,
        recoveredAt: null, // Not yet recovered
      },
    });

    for (const checkout of abandonedCheckouts) {
      if (checkout.scheduledJobIds && checkout.scheduledJobIds.length > 0) {
        for (const jobId of checkout.scheduledJobIds) {
          const cancelled = await cancelScheduledAutomation(jobId, shopId);
          if (cancelled) {
            cancelledCount++;
          }
        }

        // Mark checkout as recovered
        await prisma.abandonedCheckout.update({
          where: { id: checkout.id },
          data: {
            recoveredAt: new Date(),
            scheduledJobIds: [],
          },
        });
      }
    }

    logger.info('Cancelled automations for order', {
      shopId,
      orderId,
      cancelledCount,
    });

    return cancelledCount;
  } catch (error) {
    logger.error('Failed to cancel automations for order', {
      shopId,
      orderId,
      error: error.message,
    });
    return 0;
  }
}

/**
 * Cancel all scheduled automations for an abandoned checkout
 * @param {string} shopId - Shop ID
 * @param {string} checkoutId - Checkout ID
 * @returns {Promise<number>} Number of jobs cancelled
 */
export async function cancelAutomationsForCheckout(shopId, checkoutId) {
  try {
    const abandonedCheckout = await prisma.abandonedCheckout.findFirst({
      where: {
        shopId,
        checkoutId: checkoutId.toString(),
        recoveredAt: null,
      },
    });

    if (!abandonedCheckout) {
      return 0;
    }

    let cancelledCount = 0;

    if (
      abandonedCheckout.scheduledJobIds &&
      abandonedCheckout.scheduledJobIds.length > 0
    ) {
      for (const jobId of abandonedCheckout.scheduledJobIds) {
        const cancelled = await cancelScheduledAutomation(jobId, shopId);
        if (cancelled) {
          cancelledCount++;
        }
      }

      // Mark checkout as recovered
      await prisma.abandonedCheckout.update({
        where: { id: abandonedCheckout.id },
        data: {
          recoveredAt: new Date(),
          scheduledJobIds: [],
        },
      });
    }

    logger.info('Cancelled automations for abandoned checkout', {
      shopId,
      checkoutId,
      cancelledCount,
    });

    return cancelledCount;
  } catch (error) {
    logger.error('Failed to cancel automations for checkout', {
      shopId,
      checkoutId,
      error: error.message,
    });
    return 0;
  }
}

/**
 * Get scheduled automations for a shop
 * @param {string} shopId - Shop ID
 * @param {string} automationType - Optional automation type filter
 * @returns {Promise<Array>} Array of scheduled automations
 */
export async function getScheduledAutomations(shopId, automationType = null) {
  try {
    const where = {
      shopId,
      status: 'scheduled',
    };

    if (automationType) {
      where.automationType = automationType;
    }

    return await prisma.scheduledAutomation.findMany({
      where,
      orderBy: {
        scheduledFor: 'asc',
      },
    });
  } catch (error) {
    logger.error('Failed to get scheduled automations', {
      shopId,
      automationType,
      error: error.message,
    });
    return [];
  }
}

export default {
  scheduleAutomation,
  cancelScheduledAutomation,
  cancelAutomationsForOrder,
  cancelAutomationsForCheckout,
  getScheduledAutomations,
};
