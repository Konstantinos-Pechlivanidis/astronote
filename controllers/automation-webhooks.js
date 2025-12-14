import { logger } from '../utils/logger.js';
import prisma from '../services/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { automationQueue } from '../queue/index.js';
import {
  getOrderDetails,
  getFulfillmentDetails,
  getAbandonedCheckout,
} from '../services/shopify-graphql.js';
import { cancelAutomationsForOrder } from '../services/automation-scheduler.js';

/**
 * Convert numeric order ID to Shopify GID format
 * @param {string|number} orderId - Order ID (numeric or GID)
 * @returns {string} GID format order ID
 */
function convertToOrderGid(orderId) {
  if (typeof orderId === 'string' && orderId.startsWith('gid://')) {
    return orderId;
  }
  // Convert numeric ID to GID format
  const numericId = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
  return `gid://shopify/Order/${numericId}`;
}

/**
 * Handle Shopify order creation webhook
 * Enhanced with GraphQL to fetch complete order details
 */
export async function handleOrderCreated(req, res, _next) {
  try {
    const { shop_domain, id, customer, line_items } = req.body;

    if (!shop_domain || !id || !customer) {
      throw new ValidationError('shop_domain, id, and customer are required');
    }

    // Find the shop
    const shop = await prisma.shop.findUnique({
      where: { shopDomain: shop_domain },
    });

    if (!shop) {
      logger.warn('Shop not found for order webhook', { shop_domain });
      throw new NotFoundError('Shop');
    }

    // Find or create the customer contact
    let contact = await prisma.contact.findFirst({
      where: {
        shopId: shop.id,
        email: customer.email,
      },
    });

    // If contact doesn't exist, create it from Shopify customer data
    if (!contact) {
      logger.info('Contact not found, creating from Shopify customer data', {
        shopId: shop.id,
        customerEmail: customer.email,
      });

      // Extract phone number from customer data
      const phoneE164 =
        customer.phone || customer.default_address?.phone || null;

      contact = await prisma.contact.create({
        data: {
          shopId: shop.id,
          email: customer.email,
          firstName: customer.first_name || null,
          lastName: customer.last_name || null,
          phoneE164,
          smsConsent: 'unknown', // Default to unknown, user must opt-in
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info('Contact created from Shopify webhook', {
        contactId: contact.id,
        shopId: shop.id,
        email: customer.email,
      });
    }

    // Fetch complete order details using GraphQL
    let orderDetails = null;
    try {
      const orderGid = convertToOrderGid(id);
      orderDetails = await getOrderDetails(shop_domain, orderGid);
      logger.info('Order details fetched via GraphQL', {
        shopId: shop.id,
        orderId: id,
        orderName: orderDetails.name,
      });
    } catch (graphqlError) {
      logger.warn('Failed to fetch order details via GraphQL, using webhook data', {
        shopId: shop.id,
        orderId: id,
        error: graphqlError.message,
      });
      // Fallback to webhook data if GraphQL fails
    }

    // Prepare order data - use GraphQL data if available, otherwise webhook data
    const orderData = orderDetails
      ? {
        // GraphQL format
        name: orderDetails.name,
        customer: orderDetails.customer,
        lineItems: orderDetails.lineItems,
        totalPriceSet: orderDetails.totalPriceSet,
        discountCodes: orderDetails.discountCodes || [],
        shippingAddress: orderDetails.shippingAddress,
        processedAt: orderDetails.processedAt,
        // Legacy format support
        orderNumber: orderDetails.name,
        customerEmail: orderDetails.customer?.email || customer.email,
        customerName:
            orderDetails.customer?.displayName ||
            `${orderDetails.customer?.firstName || ''} ${orderDetails.customer?.lastName || ''}`.trim() ||
            `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        totalPrice: orderDetails.totalPriceSet?.shopMoney?.amount,
        currency: orderDetails.totalPriceSet?.shopMoney?.currencyCode || req.body.currency,
      }
      : {
        // Webhook format (fallback)
        orderNumber: id.toString(),
        customerEmail: customer.email,
        customerName:
            `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        lineItems: line_items,
        totalPrice: req.body.total_price,
        currency: req.body.currency,
      };

    // Update contact's hasPurchased flag and lastOrderAt
    if (contact) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          hasPurchased: true,
          lastOrderAt: new Date(),
          firstPurchaseAt: contact.firstPurchaseAt || new Date(),
        },
      });
    }

    // Cancel any scheduled abandoned checkout automations for this order
    // (customer completed the purchase, so no need for abandoned cart reminders)
    try {
      const cancelledCount = await cancelAutomationsForOrder(
        shop.id,
        id.toString(),
      );
      if (cancelledCount > 0) {
        logger.info('Cancelled abandoned checkout automations', {
          shopId: shop.id,
          orderId: id,
          cancelledCount,
        });
      }
    } catch (cancelError) {
      // Don't fail the webhook if cancellation fails
      logger.warn('Failed to cancel abandoned checkout automations', {
        shopId: shop.id,
        orderId: id,
        error: cancelError.message,
      });
    }

    // Cancel welcome series if contact just made first purchase
    if (contact && !contact.hasPurchased) {
      try {
        const { cancelWelcomeSeriesOnPurchase } = await import(
          '../services/welcome-series.js'
        );
        await cancelWelcomeSeriesOnPurchase(contact.id, shop.id);
      } catch (welcomeCancelError) {
        logger.warn('Failed to cancel welcome series', {
          contactId: contact.id,
          shopId: shop.id,
          error: welcomeCancelError.message,
        });
      }
    }

    // Queue automation job instead of processing synchronously
    // This allows for retry on failure and doesn't block webhook response
    try {
      await automationQueue.add(
        'order-confirmation',
        {
          shopId: shop.id,
          contactId: contact.id,
          orderData,
        },
        {
          jobId: `order-confirmation-${shop.id}-${id}-${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      logger.info('Order confirmation automation queued', {
        shopId: shop.id,
        contactId: contact.id,
        orderId: id,
        orderName: orderData.name || orderData.orderNumber,
      });

      // Return success immediately - job will be processed asynchronously
      return sendSuccess(
        res,
        { automationQueued: true },
        'Order webhook processed',
      );
    } catch (queueError) {
      logger.error('Failed to queue order confirmation automation', {
        shopId: shop.id,
        contactId: contact.id,
        orderId: id,
        error: queueError.message,
      });
      // Still return success to Shopify to prevent retries
      // The error is logged and can be handled separately
      return sendSuccess(
        res,
        { automationQueued: false, error: 'Queue failed' },
        'Order webhook processed',
      );
    }
  } catch (error) {
    logger.error('Order webhook processing failed', {
      error: error.message,
      body: req.body,
    });
    throw error;
  }
}

/**
 * Convert abandoned checkout ID to Shopify GID format
 * @param {string|number} checkoutId - Checkout ID
 * @returns {string} GID format checkout ID
 */
function convertToAbandonmentGid(checkoutId) {
  if (typeof checkoutId === 'string' && checkoutId.startsWith('gid://')) {
    return checkoutId;
  }
  // For abandonment, the ID format might be different
  // Try both Checkout and Abandonment GID formats
  if (typeof checkoutId === 'string' && checkoutId.includes('checkout')) {
    return checkoutId;
  }
  return `gid://shopify/Abandonment/${checkoutId}`;
}

/**
 * Handle abandoned checkout webhook (from Shopify Flow or polling)
 * Based on cursor_instructions.txt lines 128-179
 */
export async function handleAbandonedCheckout(req, res, _next) {
  try {
    const { shop_domain, abandonedCheckoutId, checkout_id } = req.body;

    const checkoutId = abandonedCheckoutId || checkout_id;

    if (!shop_domain || !checkoutId) {
      throw new ValidationError(
        'shop_domain and abandonedCheckoutId/checkout_id are required',
      );
    }

    // Find the shop
    const shop = await prisma.shop.findUnique({
      where: { shopDomain: shop_domain },
    });

    if (!shop) {
      logger.warn('Shop not found for abandoned checkout webhook', {
        shop_domain,
      });
      throw new NotFoundError('Shop');
    }

    // Fetch abandoned checkout details using GraphQL
    let abandonmentData = null;
    try {
      const abandonmentGid = convertToAbandonmentGid(checkoutId);
      abandonmentData = await getAbandonedCheckout(shop_domain, abandonmentGid);
      logger.info('Abandoned checkout details fetched via GraphQL', {
        shopId: shop.id,
        checkoutId,
        hasRecoveryUrl: !!abandonmentData.abandonedCheckoutPayload
          ?.abandonedCheckoutUrl,
      });
    } catch (graphqlError) {
      logger.error('Failed to fetch abandoned checkout via GraphQL', {
        shopId: shop.id,
        checkoutId,
        error: graphqlError.message,
      });
      throw new ValidationError(
        `Failed to fetch abandoned checkout: ${graphqlError.message}`,
      );
    }

    if (!abandonmentData || !abandonmentData.abandonedCheckoutPayload) {
      throw new ValidationError('Invalid abandoned checkout data');
    }

    const payload = abandonmentData.abandonedCheckoutPayload;
    const customer = abandonmentData.customer;

    if (!customer || !customer.email) {
      logger.warn('Abandoned checkout missing customer email', {
        shopId: shop.id,
        checkoutId,
      });
      throw new ValidationError('Customer email is required');
    }

    // Find or create the customer contact
    let contact = await prisma.contact.findFirst({
      where: {
        shopId: shop.id,
        email: customer.email,
      },
    });

    if (!contact) {
      const phoneE164 =
        customer.defaultPhoneNumber?.phoneNumber ||
        customer.phone ||
        null;

      contact = await prisma.contact.create({
        data: {
          shopId: shop.id,
          email: customer.email,
          firstName: customer.firstName || null,
          lastName: customer.lastName || null,
          phoneE164,
          smsConsent: 'unknown',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info('Contact created from abandoned checkout', {
        contactId: contact.id,
        shopId: shop.id,
        email: customer.email,
      });
    }

    // Determine delay based on line item count (30 min for 1 item, 60 min for 2+ items)
    const lineItemCount =
      payload.lineItems?.edges?.length || payload.lineItems?.length || 0;
    const delayMinutes = lineItemCount === 1 ? 30 : 60;
    const delayMs = delayMinutes * 60 * 1000;

    // Store abandoned checkout in database
    const abandonedCheckout = await prisma.abandonedCheckout.upsert({
      where: {
        shopId_checkoutId: {
          shopId: shop.id,
          checkoutId: checkoutId.toString(),
        },
      },
      create: {
        shopId: shop.id,
        contactId: contact.id,
        checkoutId: checkoutId.toString(),
        lineItems: payload.lineItems || {},
        subtotalPrice:
          payload.subtotalPriceSet?.shopMoney?.amount?.toString() || null,
        currency: payload.subtotalPriceSet?.shopMoney?.currencyCode || null,
        abandonedCheckoutUrl: payload.abandonedCheckoutUrl || null,
        abandonedAt: new Date(),
      },
      update: {
        lineItems: payload.lineItems || {},
        subtotalPrice:
          payload.subtotalPriceSet?.shopMoney?.amount?.toString() || null,
        currency: payload.subtotalPriceSet?.shopMoney?.currencyCode || null,
        abandonedCheckoutUrl: payload.abandonedCheckoutUrl || null,
        updatedAt: new Date(),
      },
    });

    // Queue automation job with delay
    try {
      const job = await automationQueue.add(
        'abandoned-cart',
        {
          shopId: shop.id,
          contactId: contact.id,
          checkoutId: checkoutId.toString(),
          cartData: {
            abandonedCheckoutUrl: payload.abandonedCheckoutUrl,
            lineItems: payload.lineItems,
            subtotalPrice: payload.subtotalPriceSet?.shopMoney?.amount,
            currency: payload.subtotalPriceSet?.shopMoney?.currencyCode,
            discountCodes: payload.discountCodes || [],
            customer: {
              firstName: customer.firstName,
              lastName: customer.lastName,
              displayName: customer.firstName || customer.email,
            },
          },
        },
        {
          jobId: `abandoned-cart-${shop.id}-${checkoutId}-${Date.now()}`,
          delay: delayMs,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      // Update abandoned checkout with job ID
      await prisma.abandonedCheckout.update({
        where: { id: abandonedCheckout.id },
        data: {
          scheduledJobIds: {
            push: job.id,
          },
        },
      });

      logger.info('Abandoned cart automation queued', {
        shopId: shop.id,
        contactId: contact.id,
        checkoutId,
        delayMinutes,
        jobId: job.id,
      });

      return sendSuccess(
        res,
        {
          automationQueued: true,
          delayMinutes,
          jobId: job.id,
        },
        'Abandoned checkout webhook processed',
      );
    } catch (queueError) {
      logger.error('Failed to queue abandoned cart automation', {
        shopId: shop.id,
        contactId: contact.id,
        checkoutId,
        error: queueError.message,
      });
      return sendSuccess(
        res,
        { automationQueued: false, error: 'Queue failed' },
        'Abandoned checkout webhook processed',
      );
    }
  } catch (error) {
    logger.error('Abandoned checkout webhook processing failed', {
      error: error.message,
      body: req.body,
    });
    throw error;
  }
}

/**
 * Handle abandoned cart webhook (legacy - for backward compatibility)
 */
export async function handleCartAbandoned(req, res, _next) {
  // Redirect to new handler
  return handleAbandonedCheckout(req, res, _next);
}

/**
 * Manual trigger for testing automations
 */
export async function triggerAutomationManually(req, res, _next) {
  try {
    const { shopId, contactId, triggerEvent, additionalData = {} } = req.body;

    if (!shopId || !contactId || !triggerEvent) {
      throw new ValidationError(
        'shopId, contactId, and triggerEvent are required',
      );
    }

    // Import the automation service
    const { triggerAutomation } = await import('../services/automations.js');

    const result = await triggerAutomation({
      shopId,
      contactId,
      triggerEvent,
      additionalData,
    });

    if (result.success) {
      logger.info('Manual automation trigger successful', {
        shopId,
        contactId,
        triggerEvent,
        messageId: result.messageId,
      });

      return sendSuccess(res, result, 'Automation triggered successfully');
    } else {
      logger.warn('Manual automation trigger failed', {
        shopId,
        contactId,
        triggerEvent,
        reason: result.reason,
      });

      throw new ValidationError(result.reason || 'Automation trigger failed');
    }
  } catch (error) {
    logger.error('Manual automation trigger failed', {
      error: error.message,
      body: req.body,
    });
    throw error;
  }
}

/**
 * Convert fulfillment ID to Shopify GID format
 * @param {string|number} fulfillmentId - Fulfillment ID
 * @returns {string} GID format fulfillment ID
 */
function convertToFulfillmentGid(fulfillmentId) {
  if (typeof fulfillmentId === 'string' && fulfillmentId.startsWith('gid://')) {
    return fulfillmentId;
  }
  const numericId =
    typeof fulfillmentId === 'string'
      ? parseInt(fulfillmentId, 10)
      : fulfillmentId;
  return `gid://shopify/Fulfillment/${numericId}`;
}

/**
 * Handle Shopify order fulfillment webhook
 * Enhanced with GraphQL to fetch complete fulfillment details
 */
export async function handleOrderFulfilled(req, res, _next) {
  try {
    const {
      shop_domain,
      id,
      customer,
      fulfillment_status,
      tracking_number,
      tracking_urls,
      fulfillment_id,
    } = req.body;

    if (!shop_domain || !id || !customer) {
      throw new ValidationError('shop_domain, id, and customer are required');
    }

    // Find the shop
    const shop = await prisma.shop.findUnique({
      where: { shopDomain: shop_domain },
    });

    if (!shop) {
      logger.warn('Shop not found for order fulfillment webhook', {
        shop_domain,
      });
      throw new NotFoundError('Shop');
    }

    // Find or create the customer contact
    let contact = await prisma.contact.findFirst({
      where: {
        shopId: shop.id,
        email: customer.email,
      },
    });

    // If contact doesn't exist, create it from Shopify customer data
    if (!contact) {
      logger.info('Contact not found, creating from Shopify customer data', {
        shopId: shop.id,
        customerEmail: customer.email,
      });

      const phoneE164 =
        customer.phone || customer.default_address?.phone || null;

      contact = await prisma.contact.create({
        data: {
          shopId: shop.id,
          email: customer.email,
          firstName: customer.first_name || null,
          lastName: customer.last_name || null,
          phoneE164,
          smsConsent: 'unknown',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info('Contact created from Shopify webhook', {
        contactId: contact.id,
        shopId: shop.id,
        email: customer.email,
      });
    }

    // Fetch complete fulfillment details using GraphQL if fulfillment_id is available
    let fulfillmentDetails = null;
    if (fulfillment_id) {
      try {
        const fulfillmentGid = convertToFulfillmentGid(fulfillment_id);
        fulfillmentDetails = await getFulfillmentDetails(
          shop_domain,
          fulfillmentGid,
        );
        logger.info('Fulfillment details fetched via GraphQL', {
          shopId: shop.id,
          fulfillmentId: fulfillment_id,
          trackingNumber: fulfillmentDetails.trackingInfo?.number,
        });
      } catch (graphqlError) {
        logger.warn(
          'Failed to fetch fulfillment details via GraphQL, using webhook data',
          {
            shopId: shop.id,
            fulfillmentId: fulfillment_id,
            error: graphqlError.message,
          },
        );
      }
    }

    // Prepare fulfillment data - use GraphQL data if available, otherwise webhook data
    const fulfillmentData = fulfillmentDetails
      ? {
        // GraphQL format
        trackingInfo: fulfillmentDetails.trackingInfo,
        estimatedDeliveryAt: fulfillmentDetails.estimatedDeliveryAt,
        status: fulfillmentDetails.status,
        order: fulfillmentDetails.order,
        // Legacy format support
        trackingNumber:
            fulfillmentDetails.trackingInfo?.number || tracking_number,
        trackingUrl:
            fulfillmentDetails.trackingInfo?.url || tracking_urls?.[0],
        trackingCompany: fulfillmentDetails.trackingInfo?.company,
        fulfillmentStatus:
            fulfillmentDetails.status || fulfillment_status,
        trackingUrls: fulfillmentDetails.trackingInfo?.url
          ? [fulfillmentDetails.trackingInfo.url]
          : tracking_urls || [],
      }
      : {
        // Webhook format (fallback)
        trackingNumber: tracking_number,
        trackingUrls: tracking_urls || [],
        fulfillmentStatus: fulfillment_status,
      };

    // Prepare order data for automation
    const orderData = {
      orderNumber: id.toString(),
      customerEmail: customer.email,
      customerName:
        `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      ...fulfillmentData,
    };

    // Queue immediate fulfillment notification automation
    try {
      await automationQueue.add(
        'order-fulfilled',
        {
          shopId: shop.id,
          contactId: contact.id,
          orderData,
        },
        {
          jobId: `order-fulfilled-${shop.id}-${id}-${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      logger.info('Order fulfillment automation queued', {
        shopId: shop.id,
        contactId: contact.id,
        orderId: id,
      });

      // Schedule post-purchase series (review request, loyalty, restock)
      try {
        const { schedulePostPurchaseSeries } = await import(
          '../services/post-purchase-series.js'
        );
        await schedulePostPurchaseSeries(
          shop.id,
          contact.id,
          id.toString(),
          fulfillmentDetails || {
            createdAt: new Date(),
            estimatedDeliveryAt: null,
          },
        );
        logger.info('Post-purchase series scheduled', {
          shopId: shop.id,
          contactId: contact.id,
          orderId: id,
        });
      } catch (postPurchaseError) {
        // Don't fail webhook if post-purchase scheduling fails
        logger.warn('Failed to schedule post-purchase series', {
          shopId: shop.id,
          contactId: contact.id,
          orderId: id,
          error: postPurchaseError.message,
        });
      }

      // Schedule cross-sell/upsell automation (3-5 days after fulfillment)
      try {
        const { getRecommendedProductsForOrder } = await import(
          '../services/product-recommendations.js'
        );

        // Get order GID for recommendations
        const orderGid = convertToOrderGid(id);
        const recommendedProducts = await getRecommendedProductsForOrder(
          shop_domain,
          orderGid,
          3,
        );

        if (recommendedProducts.length > 0) {
          // Schedule cross-sell 3-5 days after fulfillment
          const crossSellDelayDays = 3 + Math.floor(Math.random() * 3); // 3-5 days
          const crossSellDate = new Date();
          crossSellDate.setDate(crossSellDate.getDate() + crossSellDelayDays);
          const crossSellDelayMs = crossSellDate.getTime() - Date.now();

          if (crossSellDelayMs > 0) {
            await automationQueue.add(
              'cross-sell',
              {
                shopId: shop.id,
                contactId: contact.id,
                orderData: {
                  ...orderData,
                  recommendedProducts,
                },
              },
              {
                jobId: `cross-sell-${shop.id}-${id}-${Date.now()}`,
                delay: crossSellDelayMs,
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 2000,
                },
              },
            );

            logger.info('Cross-sell automation scheduled', {
              shopId: shop.id,
              contactId: contact.id,
              orderId: id,
              recommendedCount: recommendedProducts.length,
              scheduledFor: crossSellDate.toISOString(),
            });
          }
        }
      } catch (crossSellError) {
        logger.warn('Failed to schedule cross-sell automation', {
          shopId: shop.id,
          contactId: contact.id,
          orderId: id,
          error: crossSellError.message,
        });
      }

      return sendSuccess(
        res,
        { automationQueued: true },
        'Order fulfillment webhook processed',
      );
    } catch (queueError) {
      logger.error('Failed to queue order fulfillment automation', {
        shopId: shop.id,
        contactId: contact.id,
        orderId: id,
        error: queueError.message,
      });
      return sendSuccess(
        res,
        { automationQueued: false, error: 'Queue failed' },
        'Order fulfillment webhook processed',
      );
    }
  } catch (error) {
    logger.error('Order fulfillment webhook processing failed', {
      error: error.message,
      body: req.body,
    });
    throw error;
  }
}

export default {
  handleOrderCreated,
  handleOrderFulfilled,
  handleCartAbandoned,
  handleAbandonedCheckout,
  triggerAutomationManually,
};
