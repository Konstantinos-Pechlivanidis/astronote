import prisma from './prisma.js';
import { sendSms } from './mitto.js';
import { logger } from '../utils/logger.js';
import { generateUnsubscribeUrl } from '../utils/unsubscribe.js';
import { shortenUrlsInText } from '../utils/urlShortener.js';
import { formatLineItems } from './shopify-graphql.js';

/**
 * Trigger an automation for a specific contact
 */
export async function triggerAutomation({
  shopId,
  contactId,
  triggerEvent,
  additionalData = {},
}) {
  try {
    // Find the user automation for this trigger (system default or custom)
    const userAutomation = await prisma.userAutomation.findFirst({
      where: {
        shopId,
        automation: {
          triggerEvent,
        },
        isActive: true,
      },
      include: {
        automation: true,
        shop: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!userAutomation) {
      logger.warn('No active automation found for trigger', {
        shopId,
        triggerEvent,
      });
      return { success: false, reason: 'No active automation found' };
    }

    // Get contact information (filter by shopId for multi-tenant security)
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        shopId,
      },
    });

    if (!contact) {
      logger.warn('Contact not found for automation trigger', {
        contactId,
        shopId,
        triggerEvent,
      });
      return { success: false, reason: 'Contact not found' };
    }

    // Check if contact has SMS consent
    if (contact.smsConsent !== 'opted_in') {
      logger.warn('Contact does not have SMS consent', {
        contactId,
        shopId,
        triggerEvent,
        smsConsent: contact.smsConsent,
      });
      return { success: false, reason: 'No SMS consent' };
    }

    // Prepare message content
    const messageContent =
      userAutomation.userMessage || userAutomation.automation.defaultMessage;

    // Replace template variables
    let processedMessage = processMessageTemplate(messageContent, {
      contact,
      shop: userAutomation.shop,
      ...additionalData,
    });

    // Shorten any URLs in the message text
    processedMessage = await shortenUrlsInText(processedMessage);

    // Get frontend base URL for unsubscribe links
    const frontendBaseUrl =
      process.env.FRONTEND_URL ||
      process.env.FRONTEND_BASE_URL ||
      'https://astronote-shopify-frontend.onrender.com';

    // Append unsubscribe link (use full URL, not shortened)
    // IMPORTANT: Do NOT shorten the unsubscribe URL - it would cause 404 errors
    const unsubscribeUrl = generateUnsubscribeUrl(
      contact.id,
      shopId,
      contact.phoneE164,
      frontendBaseUrl,
    );
    processedMessage += `\n\nUnsubscribe: ${unsubscribeUrl}`;

    // Get sender information
    const senderNumber =
      userAutomation.shop.settings?.senderNumber ||
      userAutomation.shop.settings?.senderName ||
      process.env.MITTO_SENDER_NAME ||
      'Astronote';

    // Send SMS
    const smsResult = await sendSms({
      to: contact.phoneE164,
      text: processedMessage,
      senderOverride: senderNumber,
      shopId,
    });

    // sendSms returns {messageId, status} on success, throws error on failure
    if (smsResult && smsResult.messageId) {
      // Log the automation trigger
      await prisma.messageLog.create({
        data: {
          shopId,
          phoneE164: contact.phoneE164,
          direction: 'outbound',
          provider: 'mitto',
          providerMsgId: smsResult.messageId,
          status: 'sent',
          campaignId: null, // Automation, not campaign
        },
      });

      logger.info('Automation triggered successfully', {
        shopId,
        contactId,
        triggerEvent,
        messageId: smsResult.messageId,
        automationId: userAutomation.automationId,
      });

      return {
        success: true,
        messageId: smsResult.messageId,
        automationId: userAutomation.automationId,
      };
    } else {
      logger.error('Failed to send automation SMS - unexpected result', {
        shopId,
        contactId,
        triggerEvent,
        result: smsResult,
      });

      return {
        success: false,
        reason: 'SMS sending failed - unexpected result',
      };
    }
  } catch (error) {
    logger.error('Automation trigger failed', {
      error: error.message,
      shopId,
      contactId,
      triggerEvent,
    });

    return {
      success: false,
      reason: 'Internal error',
      error: error.message,
    };
  }
}

/**
 * Sanitize string for SMS (remove control characters, limit length)
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeForSms(str) {
  if (typeof str !== 'string') {
    return String(str || '');
  }
  // Remove control characters except newlines and tabs
  return str
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .substring(0, 1600); // SMS limit
}

/**
 * Process message template with variables
 * Supports all variables from cursor_instructions.txt
 * All variables are sanitized to prevent injection
 */
function processMessageTemplate(template, data) {
  let processedMessage = template;

  // Replace contact/customer variables (support both naming conventions)
  // All values are sanitized to prevent injection
  if (data.contact) {
    processedMessage = processedMessage.replace(
      /\{\{firstName\}\}/g,
      sanitizeForSms(data.contact.firstName || ''),
    );
    processedMessage = processedMessage.replace(
      /\{\{lastName\}\}/g,
      sanitizeForSms(data.contact.lastName || ''),
    );
    processedMessage = processedMessage.replace(
      /\{\{phone\}\}/g,
      sanitizeForSms(data.contact.phoneE164 || ''),
    );
    // New customer variables
    processedMessage = processedMessage.replace(
      /\{\{customer\.firstName\}\}/g,
      sanitizeForSms(data.contact.firstName || ''),
    );
    processedMessage = processedMessage.replace(
      /\{\{customer\.lastName\}\}/g,
      sanitizeForSms(data.contact.lastName || ''),
    );
    processedMessage = processedMessage.replace(
      /\{\{customer\.displayName\}\}/g,
      sanitizeForSms(
        data.contact.displayName ||
          `${data.contact.firstName || ''} ${data.contact.lastName || ''}`.trim() ||
          data.contact.email ||
          '',
      ),
    );
  }

  // Replace subscriber variables (for welcome series)
  if (data.subscriber) {
    processedMessage = processedMessage.replace(
      /\{\{subscriber\.firstName\}\}/g,
      sanitizeForSms(data.subscriber.firstName || ''),
    );
    processedMessage = processedMessage.replace(
      /\{\{subscriber\.lastName\}\}/g,
      sanitizeForSms(data.subscriber.lastName || ''),
    );
  }

  // Replace shop variables
  if (data.shop) {
    processedMessage = processedMessage.replace(
      /\{\{shopName\}\}/g,
      sanitizeForSms(data.shop.shopDomain || data.shop.shopName || ''),
    );
    processedMessage = processedMessage.replace(
      /\{\{shopDomain\}\}/g,
      sanitizeForSms(data.shop.shopDomain || ''),
    );
  }

  // Replace order variables
  if (data.order) {
    processedMessage = processedMessage.replace(
      /\{\{order\.name\}\}/g,
      sanitizeForSms(data.order.name || data.order.orderNumber || ''),
    );
    processedMessage = processedMessage.replace(
      /\{\{orderNumber\}\}/g,
      sanitizeForSms(data.order.name || data.order.orderNumber || ''),
    );
  }

  // Legacy orderNumber support
  if (data.orderNumber) {
    processedMessage = processedMessage.replace(
      /\{\{orderNumber\}\}/g,
      sanitizeForSms(data.orderNumber),
    );
    processedMessage = processedMessage.replace(
      /\{\{order\.name\}\}/g,
      sanitizeForSms(data.orderNumber),
    );
  }

  // Replace price variables
  if (data.order?.totalPriceSet?.shopMoney) {
    processedMessage = processedMessage.replace(
      /\{\{totalPrice\}\}/g,
      data.order.totalPriceSet.shopMoney.amount || '',
    );
    processedMessage = processedMessage.replace(
      /\{\{currency\}\}/g,
      data.order.totalPriceSet.shopMoney.currencyCode || '',
    );
  } else if (data.totalPrice) {
    processedMessage = processedMessage.replace(
      /\{\{totalPrice\}\}/g,
      data.totalPrice,
    );
  }
  if (data.currency) {
    processedMessage = processedMessage.replace(
      /\{\{currency\}\}/g,
      data.currency,
    );
  }

  // Replace line items
  if (data.order?.lineItems?.edges) {
    const lineItemsStr = formatLineItems(data.order.lineItems.edges);
    processedMessage = processedMessage.replace(
      /\{\{lineItems\}\}/g,
      sanitizeForSms(lineItemsStr),
    );
  } else if (data.lineItems) {
    // Support both GraphQL format and simple array format
    if (Array.isArray(data.lineItems)) {
      if (data.lineItems[0]?.node) {
        // GraphQL format
        const lineItemsStr = formatLineItems(data.lineItems);
        processedMessage = processedMessage.replace(
          /\{\{lineItems\}\}/g,
          sanitizeForSms(lineItemsStr),
        );
      } else {
        // Simple format: [{title, quantity}, ...]
        const lineItemsStr = data.lineItems
          .map(item => `${item.title || 'Product'} x${item.quantity || 1}`)
          .join(', ');
        processedMessage = processedMessage.replace(
          /\{\{lineItems\}\}/g,
          sanitizeForSms(lineItemsStr),
        );
      }
    }
  }

  // Replace discount codes
  if (data.order?.discountCodes && Array.isArray(data.order.discountCodes)) {
    const discountCodesStr = data.order.discountCodes.join(', ');
    processedMessage = processedMessage.replace(
      /\{\{discountCodes\}\}/g,
      discountCodesStr,
    );
  } else if (data.discountCode) {
    processedMessage = processedMessage.replace(
      /\{\{discountCode\}\}/g,
      data.discountCode,
    );
    processedMessage = processedMessage.replace(
      /\{\{discountCodes\}\}/g,
      data.discountCode,
    );
  }

  // Replace shipping address variables
  if (data.order?.shippingAddress) {
    processedMessage = processedMessage.replace(
      /\{\{shippingAddress\.city\}\}/g,
      sanitizeForSms(data.order.shippingAddress.city || ''),
    );
    processedMessage = processedMessage.replace(
      /\{\{shippingAddress\.country\}\}/g,
      sanitizeForSms(data.order.shippingAddress.country || ''),
    );
  }

  // Replace tracking variables
  if (data.fulfillment?.trackingInfo) {
    processedMessage = processedMessage.replace(
      /\{\{tracking\.number\}\}/g,
      data.fulfillment.trackingInfo.number || '',
    );
    processedMessage = processedMessage.replace(
      /\{\{tracking\.url\}\}/g,
      data.fulfillment.trackingInfo.url || '',
    );
    processedMessage = processedMessage.replace(
      /\{\{tracking\.company\}\}/g,
      data.fulfillment.trackingInfo.company || '',
    );
    // Legacy support
    processedMessage = processedMessage.replace(
      /\{\{trackingNumber\}\}/g,
      data.fulfillment.trackingInfo.number || '',
    );
    processedMessage = processedMessage.replace(
      /\{\{trackingLink\}\}/g,
      data.fulfillment.trackingInfo.url || '',
    );
  } else {
    // Legacy tracking support
    if (data.trackingNumber) {
      processedMessage = processedMessage.replace(
        /\{\{trackingNumber\}\}/g,
        data.trackingNumber,
      );
      processedMessage = processedMessage.replace(
        /\{\{tracking\.number\}\}/g,
        data.trackingNumber,
      );
    }
    if (data.trackingLink) {
      processedMessage = processedMessage.replace(
        /\{\{trackingLink\}\}/g,
        data.trackingLink,
      );
      processedMessage = processedMessage.replace(
        /\{\{tracking\.url\}\}/g,
        data.trackingLink,
      );
    }
    if (
      data.trackingUrls &&
      Array.isArray(data.trackingUrls) &&
      data.trackingUrls.length > 0
    ) {
      processedMessage = processedMessage.replace(
        /\{\{trackingLink\}\}/g,
        data.trackingUrls[0],
      );
      processedMessage = processedMessage.replace(
        /\{\{tracking\.url\}\}/g,
        data.trackingUrls[0],
      );
    }
  }

  // Replace estimated delivery date
  if (data.fulfillment?.estimatedDeliveryAt) {
    const deliveryDate = new Date(data.fulfillment.estimatedDeliveryAt);
    const formattedDate = deliveryDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    processedMessage = processedMessage.replace(
      /\{\{estimatedDeliveryAt\}\}/g,
      sanitizeForSms(formattedDate),
    );
  }

  // Replace abandoned checkout variables
  if (data.checkout) {
    // URLs are not sanitized as they need to remain valid
    processedMessage = processedMessage.replace(
      /\{\{abandonedCheckoutUrl\}\}/g,
      data.checkout.abandonedCheckoutUrl || '',
    );
    if (data.checkout.subtotalPriceSet?.shopMoney) {
      processedMessage = processedMessage.replace(
        /\{\{subtotalPrice\}\}/g,
        sanitizeForSms(data.checkout.subtotalPriceSet.shopMoney.amount || ''),
      );
    }
    if (data.checkout.lineItems?.edges) {
      const lineItemsStr = formatLineItems(data.checkout.lineItems.edges);
      processedMessage = processedMessage.replace(
        /\{\{lineItems\}\}/g,
        sanitizeForSms(lineItemsStr),
      );
    }
  }

  // Replace product variables
  if (data.productName) {
    processedMessage = processedMessage.replace(
      /\{\{productName\}\}/g,
      sanitizeForSms(data.productName),
    );
  }
  if (data.productTitle) {
    processedMessage = processedMessage.replace(
      /\{\{productTitle\}\}/g,
      sanitizeForSms(data.productTitle),
    );
  }

  // Replace recommended products
  if (data.recommendedProducts) {
    let recommendedStr = '';
    if (Array.isArray(data.recommendedProducts)) {
      recommendedStr = data.recommendedProducts
        .map(p => sanitizeForSms(p.title || p.name || 'Product'))
        .join(', ');
    } else if (typeof data.recommendedProducts === 'string') {
      recommendedStr = sanitizeForSms(data.recommendedProducts);
    }
    processedMessage = processedMessage.replace(
      /\{\{recommendedProducts\}\}/g,
      recommendedStr,
    );
  }

  // Replace review link (URLs are not sanitized as they need to remain valid)
  if (data.reviewLink) {
    processedMessage = processedMessage.replace(
      /\{\{reviewLink\}\}/g,
      data.reviewLink,
    );
  }

  // Replace days since last order
  if (data.daysSinceLastOrder !== undefined) {
    processedMessage = processedMessage.replace(
      /\{\{daysSinceLastOrder\}\}/g,
      sanitizeForSms(String(data.daysSinceLastOrder)),
    );
  }

  return processedMessage;
}

/**
 * Trigger abandoned cart automation
 */
export async function triggerAbandonedCart({
  shopId,
  contactId,
  cartData = {},
  checkoutData = {},
}) {
  // Merge cartData and checkoutData
  const mergedData = {
    ...cartData,
    ...checkoutData,
    checkout: checkoutData, // Support {{checkout.*}} variables
  };

  return await triggerAutomation({
    shopId,
    contactId,
    triggerEvent: 'cart_abandoned',
    additionalData: mergedData,
  });
}

/**
 * Trigger order confirmation automation
 */
export async function triggerOrderConfirmation({
  shopId,
  contactId,
  orderData = {},
}) {
  return await triggerAutomation({
    shopId,
    contactId,
    triggerEvent: 'order_placed',
    additionalData: orderData,
  });
}

/**
 * Trigger order fulfillment automation
 */
export async function triggerOrderFulfilled({
  shopId,
  contactId,
  orderData = {},
}) {
  return await triggerAutomation({
    shopId,
    contactId,
    triggerEvent: 'order_fulfilled',
    additionalData: orderData,
  });
}

/**
 * Trigger customer re-engagement automation
 */
export async function triggerCustomerReengagement({
  shopId,
  contactId,
  reengagementData = {},
}) {
  return await triggerAutomation({
    shopId,
    contactId,
    triggerEvent: 'customer_inactive',
    additionalData: reengagementData,
  });
}

/**
 * Trigger birthday automation
 */
export async function triggerBirthdayOffer({
  shopId,
  contactId,
  birthdayData = {},
}) {
  return await triggerAutomation({
    shopId,
    contactId,
    triggerEvent: 'birthday',
    additionalData: birthdayData,
  });
}

/**
 * Trigger welcome automation
 */
export async function triggerWelcome({ shopId, contactId, welcomeData = {} }) {
  return await triggerAutomation({
    shopId,
    contactId,
    triggerEvent: 'welcome',
    additionalData: welcomeData,
  });
}

/**
 * Trigger review request automation
 */
export async function triggerReviewRequest({
  shopId,
  contactId,
  orderData = {},
}) {
  return await triggerAutomation({
    shopId,
    contactId,
    triggerEvent: 'review_request',
    additionalData: orderData,
  });
}

/**
 * Trigger cross-sell/upsell automation
 */
export async function triggerCrossSell({
  shopId,
  contactId,
  orderData = {},
  recommendedProducts = [],
}) {
  return await triggerAutomation({
    shopId,
    contactId,
    triggerEvent: 'cross_sell',
    additionalData: {
      ...orderData,
      recommendedProducts,
    },
  });
}

/**
 * Get all active automations for a shop
 */
export async function getActiveAutomations(shopId) {
  return await prisma.userAutomation.findMany({
    where: {
      shopId,
      isActive: true,
    },
    include: {
      automation: true,
    },
  });
}

/**
 * Check if a shop has a specific automation active
 */
export async function hasActiveAutomation(shopId, triggerEvent) {
  const automation = await prisma.userAutomation.findFirst({
    where: {
      shopId,
      isActive: true,
      automation: {
        triggerEvent,
      },
    },
  });

  return !!automation;
}

/**
 * Daily Cron Job: Check for birthdays and trigger automation
 * Should be called once per day (e.g., at midnight)
 */
export async function processDailyBirthdayAutomations() {
  try {
    logger.info('Starting daily birthday automation check...');

    // Find all contacts with birthdays
    const contactsWithBirthdays = await prisma.contact.findMany({
      where: {
        birthDate: {
          not: null,
        },
        smsConsent: 'opted_in',
      },
      include: {
        shop: {
          include: {
            settings: true,
            userAutomations: {
              where: {
                isActive: true,
                automation: {
                  triggerEvent: 'birthday',
                },
              },
              include: {
                automation: true,
              },
            },
          },
        },
      },
    });

    // Filter contacts whose birthday is today in their shop's timezone
    const birthdayContacts = contactsWithBirthdays.filter(contact => {
      if (!contact.birthDate) return false;

      // Get shop timezone (default to UTC if not set)
      const shopTimezone = contact.shop.settings?.timezone || 'UTC';

      // Get today's date in shop timezone
      const todayInShopTimezone = new Date(
        new Date().toLocaleString('en-US', { timeZone: shopTimezone }),
      );
      const todayMonth = String(todayInShopTimezone.getMonth() + 1).padStart(
        2,
        '0',
      );
      const todayDay = String(todayInShopTimezone.getDate()).padStart(2, '0');

      // Get birthday date (stored as Date, extract month and day)
      const birthDate = new Date(contact.birthDate);
      const birthMonth = String(birthDate.getMonth() + 1).padStart(2, '0');
      const birthDay = String(birthDate.getDate()).padStart(2, '0');

      const isBirthdayToday =
        birthMonth === todayMonth && birthDay === todayDay;

      if (isBirthdayToday) {
        logger.debug('Contact has birthday today', {
          contactId: contact.id,
          shopId: contact.shopId,
          shopTimezone,
          birthDate: contact.birthDate,
          todayInShopTimezone: todayInShopTimezone.toISOString(),
        });
      }

      return isBirthdayToday;
    });

    logger.info(
      `Found ${birthdayContacts.length} contacts with birthday today`,
    );

    const results = {
      total: birthdayContacts.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    // Process each contact
    for (const contact of birthdayContacts) {
      try {
        // Check if shop has active birthday automation
        if (
          !contact.shop.userAutomations ||
          contact.shop.userAutomations.length === 0
        ) {
          logger.info('No active birthday automation for shop', {
            shopId: contact.shopId,
            contactId: contact.id,
          });
          results.skipped++;
          results.details.push({
            contactId: contact.id,
            shopId: contact.shopId,
            status: 'skipped',
            reason: 'No active birthday automation',
          });
          continue;
        }

        // Trigger birthday automation
        const result = await triggerBirthdayOffer({
          shopId: contact.shopId,
          contactId: contact.id,
          birthdayData: {
            firstName: contact.firstName,
            lastName: contact.lastName,
          },
        });

        if (result.success) {
          results.sent++;
          results.details.push({
            contactId: contact.id,
            shopId: contact.shopId,
            status: 'sent',
            messageId: result.messageId,
          });
          logger.info('Birthday SMS sent successfully', {
            contactId: contact.id,
            shopId: contact.shopId,
            messageId: result.messageId,
          });
        } else {
          results.failed++;
          results.details.push({
            contactId: contact.id,
            shopId: contact.shopId,
            status: 'failed',
            reason: result.reason,
          });
          logger.warn('Birthday SMS failed', {
            contactId: contact.id,
            shopId: contact.shopId,
            reason: result.reason,
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          contactId: contact.id,
          shopId: contact.shopId,
          status: 'failed',
          error: error.message,
        });
        logger.error('Error processing birthday automation', {
          contactId: contact.id,
          shopId: contact.shopId,
          error: error.message,
        });
      }
    }

    logger.info('Daily birthday automation check completed', results);
    return results;
  } catch (error) {
    logger.error('Failed to process daily birthday automations', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export default {
  triggerAutomation,
  triggerAbandonedCart,
  triggerOrderConfirmation,
  triggerOrderFulfilled,
  triggerCustomerReengagement,
  triggerBirthdayOffer,
  triggerWelcome,
  triggerReviewRequest,
  triggerCrossSell,
  getActiveAutomations,
  hasActiveAutomation,
  processDailyBirthdayAutomations,
  processMessageTemplate,
};
