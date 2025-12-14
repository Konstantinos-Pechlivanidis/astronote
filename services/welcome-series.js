import { logger } from '../utils/logger.js';
import prisma from './prisma.js';
import { scheduleAutomation, cancelScheduledAutomation } from './automation-scheduler.js';
import { triggerWelcome } from './automations.js';

/**
 * Schedule welcome series for a new subscriber
 * Based on cursor_instructions.txt lines 180-190
 * @param {string} contactId - Contact ID
 * @param {string} shopId - Shop ID
 * @returns {Promise<Object>} Scheduled jobs information
 */
export async function scheduleWelcomeSeries(contactId, shopId) {
  try {
    // Check if contact already has an active welcome series
    const existingSequence = await prisma.automationSequence.findFirst({
      where: {
        shopId,
        contactId,
        sequenceType: 'welcome',
        status: 'active',
      },
    });

    if (existingSequence) {
      logger.info('Welcome series already active for contact', {
        contactId,
        shopId,
        sequenceId: existingSequence.id,
      });
      return {
        success: false,
        reason: 'Welcome series already active',
        sequenceId: existingSequence.id,
      };
    }

    // Check if contact has already purchased (no need for welcome series)
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { hasPurchased: true },
    });

    if (contact?.hasPurchased) {
      logger.info('Contact has already purchased, skipping welcome series', {
        contactId,
        shopId,
      });
      return {
        success: false,
        reason: 'Contact has already purchased',
      };
    }

    // Create automation sequence record
    const sequence = await prisma.automationSequence.create({
      data: {
        shopId,
        contactId,
        sequenceType: 'welcome',
        currentStep: 1,
        totalSteps: 3,
        status: 'active',
        startedAt: new Date(),
      },
    });

    const scheduledJobs = [];

    // SMS #1: Immediate welcome with discount code (WELCOME10)
    const job1 = await scheduleAutomation({
      jobName: 'welcome',
      data: {
        shopId,
        contactId,
        welcomeData: {
          step: 1,
          discountCode: 'WELCOME10',
        },
      },
      delayMs: 0, // Immediate
      jobId: `welcome-${shopId}-${contactId}-1-${Date.now()}`,
    });
    scheduledJobs.push(job1.id);

    // SMS #2: 2-3 days later - Product suggestions (if hasPurchased == false)
    const delay2Days = (2 + Math.floor(Math.random() * 2)) * 24 * 60 * 60 * 1000; // 2-3 days
    const job2 = await scheduleAutomation({
      jobName: 'welcome',
      data: {
        shopId,
        contactId,
        welcomeData: {
          step: 2,
          discountCode: 'WELCOME10',
        },
      },
      delayMs: delay2Days,
      jobId: `welcome-${shopId}-${contactId}-2-${Date.now()}`,
    });
    scheduledJobs.push(job2.id);

    // SMS #3: 7 days later - Final reminder (if hasPurchased == false)
    const delay7Days = 7 * 24 * 60 * 60 * 1000; // 7 days
    const job3 = await scheduleAutomation({
      jobName: 'welcome',
      data: {
        shopId,
        contactId,
        welcomeData: {
          step: 3,
          discountCode: 'WELCOME10',
        },
      },
      delayMs: delay7Days,
      jobId: `welcome-${shopId}-${contactId}-3-${Date.now()}`,
    });
    scheduledJobs.push(job3.id);

    // Update sequence with job IDs
    await prisma.automationSequence.update({
      where: { id: sequence.id },
      data: {
        scheduledJobs,
      },
    });

    logger.info('Welcome series scheduled', {
      contactId,
      shopId,
      sequenceId: sequence.id,
      scheduledJobs: scheduledJobs.length,
    });

    return {
      success: true,
      sequenceId: sequence.id,
      scheduledJobs: scheduledJobs.length,
    };
  } catch (error) {
    logger.error('Failed to schedule welcome series', {
      contactId,
      shopId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Cancel remaining welcome series messages if contact has purchased
 * @param {string} contactId - Contact ID
 * @param {string} shopId - Shop ID
 * @returns {Promise<number>} Number of jobs cancelled
 */
export async function cancelWelcomeSeriesOnPurchase(contactId, shopId) {
  try {
    const sequence = await prisma.automationSequence.findFirst({
      where: {
        shopId,
        contactId,
        sequenceType: 'welcome',
        status: 'active',
      },
    });

    if (!sequence) {
      return 0;
    }

    let cancelledCount = 0;

    // Cancel all scheduled jobs
    if (sequence.scheduledJobs && sequence.scheduledJobs.length > 0) {
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

    logger.info('Welcome series cancelled due to purchase', {
      contactId,
      shopId,
      sequenceId: sequence.id,
      cancelledCount,
    });

    return cancelledCount;
  } catch (error) {
    logger.error('Failed to cancel welcome series', {
      contactId,
      shopId,
      error: error.message,
    });
    return 0;
  }
}

/**
 * Handle welcome series step execution
 * Checks if contact has purchased before sending
 * @param {string} contactId - Contact ID
 * @param {string} shopId - Shop ID
 * @param {number} step - Step number (1, 2, or 3)
 * @returns {Promise<Object>} Result of automation trigger
 */
export async function executeWelcomeSeriesStep(
  contactId,
  shopId,
  step,
) {
  try {
    // Check if contact has purchased
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { hasPurchased: true },
    });

    if (contact?.hasPurchased) {
      logger.info('Contact has purchased, skipping welcome series step', {
        contactId,
        shopId,
        step,
      });

      // Cancel remaining steps
      await cancelWelcomeSeriesOnPurchase(contactId, shopId);

      return {
        success: false,
        reason: 'Contact has already purchased',
      };
    }

    // Update sequence current step
    const sequence = await prisma.automationSequence.findFirst({
      where: {
        shopId,
        contactId,
        sequenceType: 'welcome',
        status: 'active',
      },
    });

    if (sequence) {
      await prisma.automationSequence.update({
        where: { id: sequence.id },
        data: {
          currentStep: step,
        },
      });
    }

    // Trigger welcome automation
    const result = await triggerWelcome({
      shopId,
      contactId,
      welcomeData: {
        step,
        discountCode: 'WELCOME10',
      },
    });

    // If this is the last step, mark sequence as completed
    if (step === 3 && sequence) {
      await prisma.automationSequence.update({
        where: { id: sequence.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
    }

    return result;
  } catch (error) {
    logger.error('Failed to execute welcome series step', {
      contactId,
      shopId,
      step,
      error: error.message,
    });
    throw error;
  }
}

export default {
  scheduleWelcomeSeries,
  cancelWelcomeSeriesOnPurchase,
  executeWelcomeSeriesStep,
};
