import { logger } from '../../utils/logger.js';
import {
  triggerAbandonedCart,
  triggerOrderConfirmation,
  triggerOrderFulfilled,
  triggerCustomerReengagement,
  triggerBirthdayOffer,
  triggerWelcome,
  triggerReviewRequest,
  triggerCrossSell,
} from '../../services/automations.js';
import prisma from '../../services/prisma.js';
import {
  validateAndConsumeCredits,
  InsufficientCreditsError,
  SubscriptionRequiredError,
  logAutomationSkip,
} from '../../services/credit-validation.js';

/**
 * Handle abandoned cart automation trigger
 */
export async function handleAbandonedCartTrigger(job) {
  const { shopId, contactId, cartData, checkoutId, automationId } = job.data;

  try {
    logger.info('Processing abandoned cart automation', {
      shopId,
      contactId,
      cartData,
      checkoutId,
      automationId,
    });

    // Check if checkout was recovered (order completed)
    if (checkoutId) {
      const abandonedCheckout = await prisma.abandonedCheckout.findFirst({
        where: {
          shopId,
          checkoutId: checkoutId.toString(),
        },
      });

      if (abandonedCheckout && abandonedCheckout.recoveredAt) {
        logger.info('Abandoned checkout was recovered, skipping automation', {
          shopId,
          contactId,
          checkoutId,
        });
        return {
          success: false,
          reason: 'checkout_recovered',
        };
      }
    }

    // Validate credits before triggering automation
    try {
      await validateAndConsumeCredits(shopId, 1);
    } catch (error) {
      if (error instanceof SubscriptionRequiredError) {
        await logAutomationSkip(automationId, shopId, 'Subscription required');
        logger.warn(
          'Abandoned cart automation skipped due to inactive subscription',
          {
            shopId,
            contactId,
            automationId,
          },
        );
        return {
          success: false,
          reason: 'subscription_required',
          error: error.message,
        };
      }
      if (error instanceof InsufficientCreditsError) {
        await logAutomationSkip(automationId, shopId, 'Insufficient credits');
        logger.warn(
          'Abandoned cart automation skipped due to insufficient credits',
          {
            shopId,
            contactId,
            automationId,
          },
        );
        return {
          success: false,
          reason: 'insufficient_credits',
          error: error.message,
        };
      }
      throw error;
    }

    const result = await triggerAbandonedCart({
      shopId,
      contactId,
      cartData,
      checkoutData: cartData, // Pass as checkoutData for template variables
    });

    if (result.success) {
      logger.info('Abandoned cart automation triggered successfully', {
        shopId,
        contactId,
        messageId: result.messageId,
      });
    } else {
      logger.warn('Abandoned cart automation failed', {
        shopId,
        contactId,
        reason: result.reason,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logger.error('Abandoned cart automation job failed', {
      error: error.message,
      shopId,
      contactId,
    });
    throw error;
  }
}

/**
 * Handle order confirmation automation trigger
 */
export async function handleOrderConfirmationTrigger(job) {
  const { shopId, contactId, orderData, automationId } = job.data;

  try {
    logger.info('Processing order confirmation automation', {
      jobId: job.id,
      shopId,
      contactId,
      orderData,
      automationId,
    });

    // Validate credits before triggering automation
    try {
      await validateAndConsumeCredits(shopId, 1);
    } catch (error) {
      if (error instanceof SubscriptionRequiredError) {
        await logAutomationSkip(automationId, shopId, 'Subscription required');
        logger.warn(
          'Order confirmation automation skipped due to inactive subscription',
          {
            shopId,
            contactId,
            automationId,
          },
        );
        return {
          success: false,
          reason: 'subscription_required',
          error: error.message,
        };
      }
      if (error instanceof InsufficientCreditsError) {
        await logAutomationSkip(automationId, shopId, 'Insufficient credits');
        logger.warn(
          'Order confirmation automation skipped due to insufficient credits',
          {
            shopId,
            contactId,
            automationId,
          },
        );
        return {
          success: false,
          reason: 'insufficient_credits',
          error: error.message,
        };
      }
      throw error;
    }

    const result = await triggerOrderConfirmation({
      shopId,
      contactId,
      orderData,
    });

    if (result.success) {
      logger.info('Order confirmation automation triggered successfully', {
        jobId: job.id,
        shopId,
        contactId,
        messageId: result.messageId,
      });
    } else {
      logger.warn('Order confirmation automation failed', {
        jobId: job.id,
        shopId,
        contactId,
        reason: result.reason,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logger.error('Order confirmation automation job failed', {
      jobId: job.id,
      error: error.message,
      stack: error.stack,
      shopId,
      contactId,
    });
    throw error;
  }
}

/**
 * Handle order fulfillment automation trigger
 */
export async function handleOrderFulfilledTrigger(job) {
  const { shopId, contactId, orderData, automationId } = job.data;

  try {
    logger.info('Processing order fulfillment automation', {
      jobId: job.id,
      shopId,
      contactId,
      orderData,
      automationId,
    });

    // Validate credits before triggering automation
    try {
      await validateAndConsumeCredits(shopId, 1);
    } catch (error) {
      if (error instanceof SubscriptionRequiredError) {
        await logAutomationSkip(automationId, shopId, 'Subscription required');
        logger.warn(
          'Order fulfillment automation skipped due to inactive subscription',
          {
            shopId,
            contactId,
            automationId,
          },
        );
        return {
          success: false,
          reason: 'subscription_required',
          error: error.message,
        };
      }
      if (error instanceof InsufficientCreditsError) {
        await logAutomationSkip(automationId, shopId, 'Insufficient credits');
        logger.warn(
          'Order fulfillment automation skipped due to insufficient credits',
          {
            shopId,
            contactId,
            automationId,
          },
        );
        return {
          success: false,
          reason: 'insufficient_credits',
          error: error.message,
        };
      }
      throw error;
    }

    const result = await triggerOrderFulfilled({
      shopId,
      contactId,
      orderData,
    });

    if (result.success) {
      logger.info('Order fulfillment automation triggered successfully', {
        jobId: job.id,
        shopId,
        contactId,
        messageId: result.messageId,
      });
    } else {
      logger.warn('Order fulfillment automation failed', {
        jobId: job.id,
        shopId,
        contactId,
        reason: result.reason,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logger.error('Order fulfillment automation job failed', {
      jobId: job.id,
      error: error.message,
      stack: error.stack,
      shopId,
      contactId,
    });
    throw error;
  }
}

/**
 * Handle customer re-engagement automation trigger
 */
export async function handleCustomerReengagementTrigger(job) {
  const { shopId, contactId, reengagementData, automationId } = job.data;

  try {
    logger.info('Processing customer re-engagement automation', {
      shopId,
      contactId,
      reengagementData,
      automationId,
    });

    // Validate credits before triggering automation
    try {
      await validateAndConsumeCredits(shopId, 1);
    } catch (error) {
      if (error instanceof SubscriptionRequiredError) {
        await logAutomationSkip(automationId, shopId, 'Subscription required');
        logger.warn(
          'Customer re-engagement automation skipped due to inactive subscription',
          {
            shopId,
            contactId,
            automationId,
          },
        );
        return {
          success: false,
          reason: 'subscription_required',
          error: error.message,
        };
      }
      if (error instanceof InsufficientCreditsError) {
        await logAutomationSkip(automationId, shopId, 'Insufficient credits');
        logger.warn(
          'Customer re-engagement automation skipped due to insufficient credits',
          {
            shopId,
            contactId,
            automationId,
          },
        );
        return {
          success: false,
          reason: 'insufficient_credits',
          error: error.message,
        };
      }
      throw error;
    }

    const result = await triggerCustomerReengagement({
      shopId,
      contactId,
      reengagementData,
    });

    if (result.success) {
      logger.info('Customer re-engagement automation triggered successfully', {
        shopId,
        contactId,
        messageId: result.messageId,
      });
    } else {
      logger.warn('Customer re-engagement automation failed', {
        shopId,
        contactId,
        reason: result.reason,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logger.error('Customer re-engagement automation job failed', {
      error: error.message,
      shopId,
      contactId,
    });
    throw error;
  }
}

/**
 * Handle birthday automation trigger
 */
export async function handleBirthdayTrigger(_job) {
  const { shopId, contactId, birthdayData, automationId } = _job.data;

  try {
    logger.info('Processing birthday automation', {
      shopId,
      contactId,
      birthdayData,
      automationId,
    });

    // Validate credits before triggering automation
    try {
      await validateAndConsumeCredits(shopId, 1);
    } catch (error) {
      if (error instanceof SubscriptionRequiredError) {
        await logAutomationSkip(automationId, shopId, 'Subscription required');
        logger.warn('Birthday automation skipped due to inactive subscription', {
          shopId,
          contactId,
          automationId,
        });
        return {
          success: false,
          reason: 'subscription_required',
          error: error.message,
        };
      }
      if (error instanceof InsufficientCreditsError) {
        await logAutomationSkip(automationId, shopId, 'Insufficient credits');
        logger.warn('Birthday automation skipped due to insufficient credits', {
          shopId,
          contactId,
          automationId,
        });
        return {
          success: false,
          reason: 'insufficient_credits',
          error: error.message,
        };
      }
      throw error;
    }

    const result = await triggerBirthdayOffer({
      shopId,
      contactId,
      birthdayData,
    });

    if (result.success) {
      logger.info('Birthday automation triggered successfully', {
        shopId,
        contactId,
        messageId: result.messageId,
      });
    } else {
      logger.warn('Birthday automation failed', {
        shopId,
        contactId,
        reason: result.reason,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logger.error('Birthday automation job failed', {
      error: error.message,
      shopId,
      contactId,
    });
    throw error;
  }
}

/**
 * Handle welcome automation trigger
 * Supports both single welcome messages and welcome series steps
 */
export async function handleWelcomeTrigger(job) {
  const { shopId, contactId, welcomeData, automationId, step } = job.data;

  try {
    logger.info('Processing welcome automation', {
      jobId: job.id,
      shopId,
      contactId,
      welcomeData,
      step,
      automationId,
    });

    // If this is part of a welcome series, check if contact has purchased
    if (step !== undefined) {
      const { executeWelcomeSeriesStep } = await import(
        '../../services/welcome-series.js'
      );
      return await executeWelcomeSeriesStep(contactId, shopId, step);
    }

    // Validate credits before triggering automation
    try {
      await validateAndConsumeCredits(shopId, 1);
    } catch (error) {
      if (error instanceof SubscriptionRequiredError) {
        await logAutomationSkip(automationId, shopId, 'Subscription required');
        logger.warn('Welcome automation skipped due to inactive subscription', {
          shopId,
          contactId,
          automationId,
        });
        return {
          success: false,
          reason: 'subscription_required',
          error: error.message,
        };
      }
      if (error instanceof InsufficientCreditsError) {
        await logAutomationSkip(automationId, shopId, 'Insufficient credits');
        logger.warn('Welcome automation skipped due to insufficient credits', {
          shopId,
          contactId,
          automationId,
        });
        return {
          success: false,
          reason: 'insufficient_credits',
          error: error.message,
        };
      }
      throw error;
    }

    const result = await triggerWelcome({
      shopId,
      contactId,
      welcomeData,
    });

    if (result.success) {
      logger.info('Welcome automation triggered successfully', {
        jobId: job.id,
        shopId,
        contactId,
        messageId: result.messageId,
      });
    } else {
      logger.warn('Welcome automation failed', {
        jobId: job.id,
        shopId,
        contactId,
        reason: result.reason,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logger.error('Welcome automation job failed', {
      jobId: job.id,
      error: error.message,
      stack: error.stack,
      shopId,
      contactId,
    });
    throw error;
  }
}

/**
 * Monthly job to check for inactive customers and trigger win-back automation
 * Based on cursor_instructions.txt lines 202-211
 */
export async function handleMonthlyWinBackCheck(_job) {
  try {
    logger.info('Starting monthly win-back check');

    const { processWinBackAutomations } = await import(
      '../../services/win-back.js'
    );

    const results = await processWinBackAutomations();

    logger.info('Monthly win-back check completed', results);

    return {
      success: true,
      ...results,
    };
  } catch (error) {
    logger.error('Monthly win-back check failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Daily job to check for inactive customers and trigger re-engagement (30 days)
 * @deprecated Use handleMonthlyWinBackCheck for 90-180 day win-back
 */
export async function handleDailyReengagementCheck(_job) {
  try {
    logger.info('Starting daily re-engagement check (30 days)');

    // Get all shops
    const shops = await prisma.shop.findMany({
      select: { id: true, shopDomain: true },
    });

    let totalProcessed = 0;
    let totalTriggered = 0;

    for (const shop of shops) {
      // Find customers who haven't placed an order in 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const contacts = await prisma.contact.findMany({
        where: {
          shopId: shop.id,
          smsConsent: 'opted_in',
          hasPurchased: true,
          lastOrderAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      for (const contact of contacts) {
        totalProcessed++;

        const result = await triggerCustomerReengagement({
          shopId: shop.id,
          contactId: contact.id,
          reengagementData: {
            daysSinceLastOrder: 30,
          },
        });

        if (result.success) {
          totalTriggered++;
        }
      }
    }

    logger.info('Daily re-engagement check completed', {
      totalProcessed,
      totalTriggered,
      shopsProcessed: shops.length,
    });

    return {
      success: true,
      totalProcessed,
      totalTriggered,
      shopsProcessed: shops.length,
    };
  } catch (error) {
    logger.error('Daily re-engagement check failed', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Handle cross-sell/upsell automation trigger
 */
export async function handleCrossSellTrigger(job) {
  const { shopId, contactId, orderData, automationId } = job.data;

  try {
    logger.info('Processing cross-sell automation', {
      jobId: job.id,
      shopId,
      contactId,
      orderData,
      automationId,
    });

    // Validate credits before triggering automation
    try {
      await validateAndConsumeCredits(shopId, 1);
    } catch (error) {
      if (error instanceof SubscriptionRequiredError) {
        await logAutomationSkip(automationId, shopId, 'Subscription required');
        logger.warn('Cross-sell automation skipped due to inactive subscription', {
          shopId,
          contactId,
          automationId,
        });
        return {
          success: false,
          reason: 'subscription_required',
          error: error.message,
        };
      }
      if (error instanceof InsufficientCreditsError) {
        await logAutomationSkip(automationId, shopId, 'Insufficient credits');
        logger.warn('Cross-sell automation skipped due to insufficient credits', {
          shopId,
          contactId,
          automationId,
        });
        return {
          success: false,
          reason: 'insufficient_credits',
          error: error.message,
        };
      }
      throw error;
    }

    const result = await triggerCrossSell({
      shopId,
      contactId,
      orderData,
      recommendedProducts: orderData.recommendedProducts || [],
    });

    if (result.success) {
      logger.info('Cross-sell automation triggered successfully', {
        jobId: job.id,
        shopId,
        contactId,
        messageId: result.messageId,
      });
    } else {
      logger.warn('Cross-sell automation failed', {
        jobId: job.id,
        shopId,
        contactId,
        reason: result.reason,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logger.error('Cross-sell automation job failed', {
      jobId: job.id,
      error: error.message,
      stack: error.stack,
      shopId,
      contactId,
    });
    throw error;
  }
}

/**
 * Handle review request automation trigger
 */
export async function handleReviewRequestTrigger(job) {
  const { shopId, contactId, orderData, automationId } = job.data;

  try {
    logger.info('Processing review request automation', {
      jobId: job.id,
      shopId,
      contactId,
      orderData,
      automationId,
    });

    // Validate credits before triggering automation
    try {
      await validateAndConsumeCredits(shopId, 1);
    } catch (error) {
      if (error instanceof SubscriptionRequiredError) {
        await logAutomationSkip(automationId, shopId, 'Subscription required');
        logger.warn(
          'Review request automation skipped due to inactive subscription',
          {
            shopId,
            contactId,
            automationId,
          },
        );
        return {
          success: false,
          reason: 'subscription_required',
          error: error.message,
        };
      }
      if (error instanceof InsufficientCreditsError) {
        await logAutomationSkip(automationId, shopId, 'Insufficient credits');
        logger.warn(
          'Review request automation skipped due to insufficient credits',
          {
            shopId,
            contactId,
            automationId,
          },
        );
        return {
          success: false,
          reason: 'insufficient_credits',
          error: error.message,
        };
      }
      throw error;
    }

    const result = await triggerReviewRequest({
      shopId,
      contactId,
      orderData,
    });

    if (result.success) {
      logger.info('Review request automation triggered successfully', {
        jobId: job.id,
        shopId,
        contactId,
        messageId: result.messageId,
      });
    } else {
      logger.warn('Review request automation failed', {
        jobId: job.id,
        shopId,
        contactId,
        reason: result.reason,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logger.error('Review request automation job failed', {
      jobId: job.id,
      error: error.message,
      stack: error.stack,
      shopId,
      contactId,
    });
    throw error;
  }
}

/**
 * Daily job to check for birthdays and trigger birthday offers
 */
export async function handleDailyBirthdayCheck(_job) {
  try {
    logger.info('Starting daily birthday check');

    // Get all shops
    const shops = await prisma.shop.findMany({
      select: { id: true, shopDomain: true },
    });

    let totalProcessed = 0;
    let totalTriggered = 0;

    for (const shop of shops) {
      // Find contacts with birthdays today
      const today = new Date();
      // const todayMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
      // const todayDay = today.getDate();

      // This would need to be implemented based on your contact birthday tracking
      // For now, we'll get all contacts and simulate the check
      const contacts = await prisma.contact.findMany({
        where: {
          shopId: shop.id,
          smsConsent: 'opted_in',
        },
      });

      for (const contact of contacts) {
        totalProcessed++;

        // In a real implementation, you would check birthday data here
        // For now, we'll trigger for a subset of contacts
        if (Math.random() < 0.05) {
          // 5% chance for demo
          const result = await triggerBirthdayOffer({
            shopId: shop.id,
            contactId: contact.id,
            birthdayData: {
              birthday: today.toISOString().split('T')[0],
            },
          });

          if (result.success) {
            totalTriggered++;
          }
        }
      }
    }

    logger.info('Daily birthday check completed', {
      totalProcessed,
      totalTriggered,
      shopsProcessed: shops.length,
    });

    return {
      success: true,
      totalProcessed,
      totalTriggered,
      shopsProcessed: shops.length,
    };
  } catch (error) {
    logger.error('Daily birthday check failed', {
      error: error.message,
    });
    throw error;
  }
}

export default {
  handleAbandonedCartTrigger,
  handleOrderConfirmationTrigger,
  handleOrderFulfilledTrigger,
  handleCustomerReengagementTrigger,
  handleBirthdayTrigger,
  handleWelcomeTrigger,
  handleReviewRequestTrigger,
  handleCrossSellTrigger,
  handleDailyReengagementCheck,
  handleMonthlyWinBackCheck,
  handleDailyBirthdayCheck,
};
