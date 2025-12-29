import { logger } from '../utils/logger.js';
import { getShopifySession, initShopifyContext } from './shopify.js';

/**
 * Get GraphQL client from Shopify API instance
 * @param {Object} api - Shopify API instance
 * @returns {Class} GraphQL Client class
 */
function getGraphQLClient(api) {
  if (!api) {
    logger.error('Shopify API not initialized');
    throw new Error(
      'Shopify API not initialized. Please check API configuration.',
    );
  }

  let GraphqlClient = null;
  if (api.clients && api.clients.Graphql) {
    GraphqlClient = api.clients.Graphql;
  } else if (api.clients && api.clients.graphql) {
    GraphqlClient = api.clients.graphql;
  } else if (api.Graphql) {
    GraphqlClient = api.Graphql;
  } else if (api.graphql) {
    GraphqlClient = api.graphql;
  }

  if (!GraphqlClient) {
    logger.error('Shopify API GraphQL client not available', {
      hasApi: !!api,
      hasClients: !!(api && api.clients),
    });
    throw new Error(
      'Shopify API GraphQL client not available. Please check API initialization.',
    );
  }

  return GraphqlClient;
}

/**
 * Execute a GraphQL query against Shopify Admin API
 * @param {string} shopDomain - Shop domain
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} GraphQL response data
 */
async function executeGraphQLQuery(shopDomain, query, variables = {}) {
  try {
    const session = await getShopifySession(shopDomain);
    const api = initShopifyContext();
    const GraphqlClient = getGraphQLClient(api);
    const client = new GraphqlClient({ session });

    const response = await client.query({
      data: {
        query,
        variables,
      },
    });

    // Check for GraphQL errors
    if (response.body.errors && response.body.errors.length > 0) {
      const graphqlErrors = response.body.errors
        .map(err => err.message)
        .join('; ');
      logger.error('Shopify GraphQL errors', {
        shopDomain,
        errors: response.body.errors,
        errorMessages: graphqlErrors,
      });
      throw new Error(`Shopify GraphQL error: ${graphqlErrors}`);
    }

    if (!response.body.data) {
      logger.error('Invalid response structure from Shopify GraphQL', {
        shopDomain,
        responseStructure: Object.keys(response.body),
      });
      throw new Error('Invalid response structure from Shopify API');
    }

    return response.body.data;
  } catch (error) {
    logger.error('GraphQL query execution failed', {
      shopDomain,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get complete order details including customer, line items, shipping, and discounts
 * Based on cursor_instructions.txt lines 39-70
 * @param {string} shopDomain - Shop domain
 * @param {string} orderId - Shopify order ID (gid://shopify/Order/...)
 * @returns {Promise<Object>} Order details
 */
export async function getOrderDetails(shopDomain, orderId) {
  const query = `
    query GetOrderDetails($id: ID!) {
      order(id: $id) {
        id
        name
        processedAt
        phone
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customer {
          id
          firstName
          lastName
          displayName
          email
          defaultPhoneNumber {
            phoneNumber
          }
          locale
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              quantity
              variant {
                id
                title
                price
              }
            }
          }
        }
        discountCodes
        shippingAddress {
          address1
          city
          province
          country
          zip
        }
        fulfillments {
          id
          status
          trackingInfo {
            number
            url
            company
          }
        }
      }
    }
  `;

  const data = await executeGraphQLQuery(shopDomain, query, { id: orderId });

  if (!data.order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  return data.order;
}

/**
 * Get fulfillment details with tracking information
 * Based on cursor_instructions.txt lines 103-120
 * @param {string} shopDomain - Shop domain
 * @param {string} fulfillmentId - Shopify fulfillment ID (gid://shopify/Fulfillment/...)
 * @returns {Promise<Object>} Fulfillment details
 */
export async function getFulfillmentDetails(shopDomain, fulfillmentId) {
  const query = `
    query GetFulfillmentDetails($fulfillmentId: ID!) {
      fulfillment(id: $fulfillmentId) {
        id
        createdAt
        estimatedDeliveryAt
        status
        trackingInfo {
          number
          url
          company
        }
        order {
          id
          name
          customer {
            id
            firstName
            lastName
            displayName
            defaultPhoneNumber {
              phoneNumber
            }
          }
        }
      }
    }
  `;

  const data = await executeGraphQLQuery(shopDomain, query, {
    fulfillmentId,
  });

  if (!data.fulfillment) {
    throw new Error(`Fulfillment not found: ${fulfillmentId}`);
  }

  return data.fulfillment;
}

/**
 * Get abandoned checkout details with recovery URL
 * Based on cursor_instructions.txt lines 139-165
 * @param {string} shopDomain - Shop domain
 * @param {string} abandonedCheckoutId - Shopify abandoned checkout ID
 * @returns {Promise<Object>} Abandoned checkout details
 */
export async function getAbandonedCheckout(
  shopDomain,
  abandonedCheckoutId,
) {
  const query = `
    query GetAbandonment($id: ID!) {
      abandonment(id: $id) {
        id
        abandonedCheckoutPayload {
          abandonedCheckoutUrl
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                image {
                  url
                }
              }
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          discountCodes
        }
        customer {
          id
          firstName
          lastName
          defaultPhoneNumber {
            phoneNumber
          }
          email
        }
        emailState
        daysSinceLastAbandonmentEmail
        hoursSinceLastAbandonedCheckout
      }
    }
  `;

  const data = await executeGraphQLQuery(shopDomain, query, {
    id: abandonedCheckoutId,
  });

  if (!data.abandonment) {
    throw new Error(`Abandoned checkout not found: ${abandonedCheckoutId}`);
  }

  return data.abandonment;
}

/**
 * Get abandoned checkouts by query (for polling approach)
 * @param {string} shopDomain - Shop domain
 * @param {string} queryString - Query string (e.g., "id:gid://shopify/Checkout/...")
 * @param {number} first - Number of results to return
 * @returns {Promise<Array>} Array of abandoned checkouts
 */
export async function getAbandonedCheckouts(
  shopDomain,
  queryString = '',
  first = 10,
) {
  const query = `
    query GetAbandonedCheckouts($first: Int!, $query: String) {
      abandonedCheckouts(first: $first, query: $query) {
        nodes {
          id
          abandonedCheckoutUrl
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                image {
                  url
                }
              }
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          discountCodes
          customer {
            id
            firstName
            lastName
            defaultPhoneNumber {
              phoneNumber
            }
            email
          }
          email
          phone
        }
      }
    }
  `;

  const data = await executeGraphQLQuery(shopDomain, query, {
    first,
    query: queryString || undefined,
  });

  return data.abandonedCheckouts?.nodes || [];
}

/**
 * Get customer details
 * @param {string} shopDomain - Shop domain
 * @param {string} customerId - Shopify customer ID (gid://shopify/Customer/...)
 * @returns {Promise<Object>} Customer details
 */
export async function getCustomerDetails(shopDomain, customerId) {
  const query = `
    query GetCustomerDetails($id: ID!) {
      customer(id: $id) {
        id
        firstName
        lastName
        displayName
        email
        phone
        defaultAddress {
          address1
          city
          province
          country
          zip
          phone
        }
        defaultPhoneNumber {
          phoneNumber
        }
        locale
        createdAt
        updatedAt
        ordersCount
        totalSpent {
          amount
          currencyCode
        }
      }
    }
  `;

  const data = await executeGraphQLQuery(shopDomain, query, { id: customerId });

  if (!data.customer) {
    throw new Error(`Customer not found: ${customerId}`);
  }

  return data.customer;
}

/**
 * Get product recommendations for cross-sell/upsell
 * @param {string} shopDomain - Shop domain
 * @param {string} productId - Shopify product ID
 * @param {number} first - Number of recommendations
 * @returns {Promise<Array>} Array of recommended products
 */
export async function getProductRecommendations(
  shopDomain,
  productId,
  first = 5,
) {
  const query = `
    query GetProductRecommendations($productId: ID!, $first: Int!) {
      productRecommendations(productId: $productId) {
        id
        title
        handle
        images(first: 1) {
          edges {
            node {
              url
            }
          }
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  `;

  try {
    const data = await executeGraphQLQuery(shopDomain, query, {
      productId,
      first,
    });

    return data.productRecommendations || [];
  } catch (error) {
    // Product recommendations API might not be available for all stores
    logger.warn('Product recommendations not available', {
      shopDomain,
      productId,
      error: error.message,
    });
    return [];
  }
}

/**
 * Format line items as readable string
 * @param {Array} lineItemsEdges - Line items edges from GraphQL response
 * @returns {string} Formatted line items string
 */
export function formatLineItems(lineItemsEdges) {
  if (!lineItemsEdges || !Array.isArray(lineItemsEdges)) {
    return '';
  }

  return lineItemsEdges
    .map(edge => {
      const node = edge.node;
      const quantity = node.quantity || 1;
      const title = node.title || 'Unknown Product';
      return `${title} x${quantity}`;
    })
    .join(', ');
}

export default {
  getOrderDetails,
  getFulfillmentDetails,
  getAbandonedCheckout,
  getAbandonedCheckouts,
  getCustomerDetails,
  getProductRecommendations,
  formatLineItems,
};
