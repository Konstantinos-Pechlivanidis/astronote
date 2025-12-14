import { logger } from '../utils/logger.js';
import prisma from './prisma.js';
import { triggerCustomerReengagement } from './automations.js';

/**
 * Find inactive customers for win-back automation
 * Based on cursor_instructions.txt lines 202-211
 * @param {string} shopId - Shop ID
 * @param {number} daysInactive - Days since last order (default: 90)
 * @returns {Promise<Array>} Array of inactive contacts
 */
export async function findInactiveCustomers(shopId, daysInactive = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    // Find contacts who:
    // 1. Have opted in to SMS
    // 2. Have purchased before (hasPurchased = true)
    // 3. Last order was more than daysInactive days ago
    const inactiveContacts = await prisma.contact.findMany({
      where: {
        shopId,
        smsConsent: 'opted_in',
        hasPurchased: true,
        OR: [
          {
            lastOrderAt: {
              lt: cutoffDate,
            },
          },
          {
            lastOrderAt: null,
            // If lastOrderAt is null but hasPurchased is true, they might be old contacts
            // We'll include them but they should be updated with lastOrderAt
            createdAt: {
              lt: cutoffDate,
            },
          },
        ],
      },
      include: {
        shop: {
          select: {
            shopDomain: true,
            shopName: true,
          },
        },
      },
    });

    logger.info('Found inactive customers for win-back', {
      shopId,
      daysInactive,
      count: inactiveContacts.length,
    });

    return inactiveContacts;
  } catch (error) {
    logger.error('Failed to find inactive customers', {
      shopId,
      daysInactive,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Trigger win-back automation for a contact
 * @param {string} shopId - Shop ID
 * @param {string} contactId - Contact ID
 * @param {number} daysInactive - Days since last order
 * @returns {Promise<Object>} Result of automation trigger
 */
export async function triggerWinBack(shopId, contactId, daysInactive) {
  try {
    const result = await triggerCustomerReengagement({
      shopId,
      contactId,
      reengagementData: {
        daysSinceLastOrder: daysInactive,
        type: 'win_back',
        discountCode: 'COMEBACK',
      },
    });

    return result;
  } catch (error) {
    logger.error('Failed to trigger win-back automation', {
      shopId,
      contactId,
      daysInactive,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Process win-back automation for all shops
 * Should be called monthly via cron job
 * @returns {Promise<Object>} Processing results
 */
export async function processWinBackAutomations() {
  try {
    logger.info('Starting win-back automation processing');

    // Get all active shops
    const shops = await prisma.shop.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        shopDomain: true,
      },
    });

    const results = {
      shopsProcessed: shops.length,
      totalInactive: 0,
      totalTriggered: 0,
      totalFailed: 0,
      details: [],
    };

    for (const shop of shops) {
      try {
        // Find inactive customers (90-180 days)
        const inactive90 = await findInactiveCustomers(shop.id, 90);
        const inactive180 = await findInactiveCustomers(shop.id, 180);

        // Filter out contacts that already received win-back in last 30 days
        // (to avoid spamming)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentWinBacks = await prisma.automationSequence.findMany({
          where: {
            shopId: shop.id,
            sequenceType: 'win_back',
            startedAt: {
              gte: thirtyDaysAgo,
            },
          },
          select: {
            contactId: true,
          },
        });

        const recentContactIds = new Set(
          recentWinBacks.map(wb => wb.contactId),
        );

        // Process 90-day inactive customers
        for (const contact of inactive90) {
          if (recentContactIds.has(contact.id)) {
            continue; // Skip if already sent win-back recently
          }

          results.totalInactive++;

          try {
            const result = await triggerWinBack(shop.id, contact.id, 90);

            if (result.success) {
              results.totalTriggered++;
              results.details.push({
                shopId: shop.id,
                contactId: contact.id,
                daysInactive: 90,
                status: 'sent',
                messageId: result.messageId,
              });

              // Create win-back sequence record
              await prisma.automationSequence.create({
                data: {
                  shopId: shop.id,
                  contactId: contact.id,
                  sequenceType: 'win_back',
                  currentStep: 1,
                  totalSteps: 2, // Initial + follow-up
                  status: 'active',
                  startedAt: new Date(),
                  metadata: {
                    daysInactive: 90,
                  },
                },
              });
            } else {
              results.totalFailed++;
              results.details.push({
                shopId: shop.id,
                contactId: contact.id,
                daysInactive: 90,
                status: 'failed',
                reason: result.reason,
              });
            }
          } catch (error) {
            results.totalFailed++;
            results.details.push({
              shopId: shop.id,
              contactId: contact.id,
              daysInactive: 90,
              status: 'error',
              error: error.message,
            });
          }
        }

        // Process 180-day inactive customers with stronger offer
        for (const contact of inactive180) {
          if (recentContactIds.has(contact.id)) {
            continue;
          }

          // Skip if already processed in 90-day batch
          const alreadyProcessed = results.details.some(
            d => d.contactId === contact.id && d.daysInactive === 90,
          );
          if (alreadyProcessed) {
            continue;
          }

          results.totalInactive++;

          try {
            const result = await triggerWinBack(shop.id, contact.id, 180);

            if (result.success) {
              results.totalTriggered++;
              results.details.push({
                shopId: shop.id,
                contactId: contact.id,
                daysInactive: 180,
                status: 'sent',
                messageId: result.messageId,
              });

              await prisma.automationSequence.create({
                data: {
                  shopId: shop.id,
                  contactId: contact.id,
                  sequenceType: 'win_back',
                  currentStep: 1,
                  totalSteps: 2,
                  status: 'active',
                  startedAt: new Date(),
                  metadata: {
                    daysInactive: 180,
                  },
                },
              });
            } else {
              results.totalFailed++;
              results.details.push({
                shopId: shop.id,
                contactId: contact.id,
                daysInactive: 180,
                status: 'failed',
                reason: result.reason,
              });
            }
          } catch (error) {
            results.totalFailed++;
            results.details.push({
              shopId: shop.id,
              contactId: contact.id,
              daysInactive: 180,
              status: 'error',
              error: error.message,
            });
          }
        }
      } catch (shopError) {
        logger.error('Failed to process win-back for shop', {
          shopId: shop.id,
          error: shopError.message,
        });
        results.details.push({
          shopId: shop.id,
          status: 'error',
          error: shopError.message,
        });
      }
    }

    logger.info('Win-back automation processing completed', results);

    return results;
  } catch (error) {
    logger.error('Failed to process win-back automations', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export default {
  findInactiveCustomers,
  triggerWinBack,
  processWinBackAutomations,
};
