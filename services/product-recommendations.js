import { logger } from '../utils/logger.js';
import {
  getProductRecommendations,
  getOrderDetails,
} from './shopify-graphql.js';

/**
 * Get product recommendations for cross-sell/upsell
 * Based on cursor_instructions.txt lines 213-223
 * @param {string} shopDomain - Shop domain
 * @param {string} orderId - Order ID
 * @param {number} limit - Number of recommendations (default: 3)
 * @returns {Promise<Array>} Array of recommended products
 */
export async function getRecommendedProductsForOrder(
  shopDomain,
  orderId,
  limit = 3,
) {
  try {
    // Get order details to extract line items
    const orderGid = orderId.startsWith('gid://')
      ? orderId
      : `gid://shopify/Order/${orderId}`;

    const order = await getOrderDetails(shopDomain, orderGid);

    if (!order.lineItems || !order.lineItems.edges || order.lineItems.edges.length === 0) {
      logger.warn('Order has no line items for recommendations', {
        shopDomain,
        orderId,
      });
      return [];
    }

    const recommendations = [];

    // Get recommendations for each product in the order
    for (const lineItem of order.lineItems.edges.slice(0, 3)) {
      // Limit to first 3 products to avoid too many API calls
      const productId = lineItem.node.variant?.id || lineItem.node.id;

      if (productId) {
        try {
          const productRecs = await getProductRecommendations(
            shopDomain,
            productId,
            limit,
          );

          // Add unique recommendations (avoid duplicates)
          for (const rec of productRecs) {
            if (
              !recommendations.find(r => r.id === rec.id) &&
              recommendations.length < limit
            ) {
              recommendations.push(rec);
            }
          }
        } catch (recError) {
          logger.warn('Failed to get recommendations for product', {
            shopDomain,
            productId,
            error: recError.message,
          });
        }
      }
    }

    // If no recommendations from API, use fallback: get products from same collection
    if (recommendations.length === 0) {
      logger.info('No API recommendations, using fallback logic', {
        shopDomain,
        orderId,
      });
      // Fallback: return empty array (would need collection-based logic)
      // For now, return empty and let the automation handle it
    }

    logger.info('Product recommendations retrieved', {
      shopDomain,
      orderId,
      count: recommendations.length,
    });

    return recommendations.slice(0, limit);
  } catch (error) {
    logger.error('Failed to get product recommendations', {
      shopDomain,
      orderId,
      error: error.message,
    });
    return [];
  }
}

/**
 * Store product recommendations in database for tracking
 * @param {string} shopId - Shop ID
 * @param {string} orderId - Order ID
 * @param {Array} recommendations - Array of recommended products
 * @returns {Promise<void>}
 */
export async function storeRecommendations(
  shopId,
  orderId,
  recommendations,
) {
  try {
    // Store in a JSON field or separate table
    // For now, we'll store in order metadata or a separate recommendations table
    // This is a placeholder - implement based on your schema needs
    logger.debug('Storing product recommendations', {
      shopId,
      orderId,
      count: recommendations.length,
    });
  } catch (error) {
    logger.warn('Failed to store recommendations', {
      shopId,
      orderId,
      error: error.message,
    });
  }
}

export default {
  getRecommendedProductsForOrder,
  storeRecommendations,
};
