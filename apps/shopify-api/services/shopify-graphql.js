import { logger } from '../utils/logger.js';
import { getShopifySession, initShopifyContext } from './shopify.js';
import {
  OrderResponseSchema,
  FulfillmentResponseSchema,
  AbandonmentResponseSchema,
  AbandonedCheckoutsListResponseSchema,
  CustomerResponseSchema,
  ProductRecommendationsResponseSchema,
  validateGraphQLResponse,
} from '../schemas/graphql-responses.schema.js';

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
 * @param {Object} options - Options (maxRetries, baseDelay, queryName, requestId)
 * @returns {Promise<Object>} GraphQL response data
 */
async function executeGraphQLQuery(shopDomain, query, variables = {}, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 2000;
  const queryName = options.queryName || 'unknown';
  const requestId = options.requestId || 'unknown';
  const startTime = Date.now();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const session = await getShopifySession(shopDomain);
      const api = initShopifyContext();
      const GraphqlClient = getGraphQLClient(api);
      const client = new GraphqlClient({ session });

      logger.debug('Executing GraphQL query', {
        shopDomain,
        queryName,
        requestId,
        attempt: attempt + 1,
        maxRetries,
      });

      const response = await client.query({
        data: {
          query,
          variables,
        },
      });

      const duration = Date.now() - startTime;

      // Check for throttle status in extensions
      const throttleStatus = response.body.extensions?.throttleStatus;
      const cost = response.body.extensions?.cost;

      // Log cost if available
      if (cost) {
        logger.info('GraphQL query cost', {
          shopDomain,
          queryName,
          requestId,
          requestedQueryCost: cost.requestedQueryCost,
          actualQueryCost: cost.actualQueryCost,
          throttleStatus: throttleStatus?.currentlyAvailable,
          throttleMaximum: throttleStatus?.maximumAvailable,
        });

        // Warn on high-cost queries
        if (cost.actualQueryCost > 50) {
          logger.warn('High-cost GraphQL query', {
            shopDomain,
            queryName,
            requestId,
            cost: cost.actualQueryCost,
          });
        }
      }

      // Check if throttle budget is low (less than 10% remaining)
      if (throttleStatus && throttleStatus.maximumAvailable) {
        const throttlePercentage =
          (throttleStatus.currentlyAvailable / throttleStatus.maximumAvailable) * 100;
        if (throttlePercentage < 10 && attempt < maxRetries - 1) {
          // Low throttle budget, wait before retrying
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // Jitter
          logger.warn('Low throttle budget, waiting before retry', {
            shopDomain,
            queryName,
            requestId,
            throttlePercentage: throttlePercentage.toFixed(2),
            delay,
            attempt: attempt + 1,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      // Check for 429 status code
      if (response.statusCode === 429) {
        const retryAfter =
          (response.headers && response.headers['retry-after']) ||
          baseDelay * Math.pow(2, attempt);
        logger.warn('GraphQL query rate limited (429), retrying', {
          shopDomain,
          queryName,
          requestId,
          retryAfter,
          attempt: attempt + 1,
        });
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
      }

      // Check for GraphQL errors
      if (response.body.errors && response.body.errors.length > 0) {
        const graphqlErrors = response.body.errors.map(err => err.message).join('; ');
        logger.error('Shopify GraphQL errors', {
          shopDomain,
          queryName,
          requestId,
          duration,
          errors: response.body.errors,
          errorMessages: graphqlErrors,
        });
        throw new Error(`Shopify GraphQL error: ${graphqlErrors}`);
      }

      if (!response.body.data) {
        logger.error('Invalid response structure from Shopify GraphQL', {
          shopDomain,
          queryName,
          requestId,
          duration,
          responseStructure: Object.keys(response.body),
        });
        throw new Error('Invalid response structure from Shopify API');
      }

      logger.info('GraphQL query executed successfully', {
        shopDomain,
        queryName,
        requestId,
        duration,
        cost: cost?.actualQueryCost,
      });

      // Return validated data (validation is optional per query)
      return response.body.data;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Check if error is a 429 (rate limit) and we can retry
      if (
        (error.statusCode === 429 || error.message?.includes('429') || error.message?.includes('rate limit')) &&
        attempt < maxRetries - 1
      ) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // Jitter
        logger.warn('GraphQL query rate limited, retrying with backoff', {
          shopDomain,
          queryName,
          requestId,
          attempt: attempt + 1,
          delay,
          error: error.message,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      logger.error('GraphQL query execution failed', {
        shopDomain,
        queryName,
        requestId,
        duration,
        attempt: attempt + 1,
        maxRetries,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  // Should not reach here, but handle edge case
  throw new Error(`GraphQL query failed after ${maxRetries} attempts`);
}

/**
 * Get complete order details including customer, line items, shipping, and discounts
 * Based on cursor_instructions.txt lines 39-70
 * @param {string} shopDomain - Shop domain
 * @param {string} orderId - Shopify order ID (gid://shopify/Order/...)
 * @returns {Promise<Object>} Order details
 */
export async function getOrderDetails(shopDomain, orderId, options = {}) {
  const queryName = 'GetOrderDetails';
  const requestId = options.requestId || 'unknown';

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

  const data = await executeGraphQLQuery(
    shopDomain,
    query,
    { id: orderId },
    {
      queryName,
      requestId,
    },
  );

  // Validate response with zod schema
  const validated = validateGraphQLResponse(
    data,
    OrderResponseSchema,
    queryName,
    requestId,
  );

  if (!validated.order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  return validated.order;
}

/**
 * Get fulfillment details with tracking information
 * Based on cursor_instructions.txt lines 103-120
 * @param {string} shopDomain - Shop domain
 * @param {string} fulfillmentId - Shopify fulfillment ID (gid://shopify/Fulfillment/...)
 * @returns {Promise<Object>} Fulfillment details
 */
export async function getFulfillmentDetails(shopDomain, fulfillmentId, options = {}) {
  const queryName = 'GetFulfillmentDetails';
  const requestId = options.requestId || 'unknown';

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

  const data = await executeGraphQLQuery(
    shopDomain,
    query,
    { fulfillmentId },
    {
      queryName,
      requestId,
    },
  );

  // Validate response with zod schema
  const validated = validateGraphQLResponse(
    data,
    FulfillmentResponseSchema,
    queryName,
    requestId,
  );

  if (!validated.fulfillment) {
    throw new Error(`Fulfillment not found: ${fulfillmentId}`);
  }

  return validated.fulfillment;
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
  options = {},
) {
  const queryName = 'GetAbandonment';
  const requestId = options.requestId || 'unknown';

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

  const data = await executeGraphQLQuery(
    shopDomain,
    query,
    { id: abandonedCheckoutId },
    {
      queryName,
      requestId,
    },
  );

  // Validate response with zod schema
  const validated = validateGraphQLResponse(
    data,
    AbandonmentResponseSchema,
    queryName,
    requestId,
  );

  if (!validated.abandonment) {
    throw new Error(`Abandoned checkout not found: ${abandonedCheckoutId}`);
  }

  return validated.abandonment;
}

/**
 * Get abandoned checkouts by query (for polling approach)
 * Implements cursor-based pagination to fetch all results
 * @param {string} shopDomain - Shop domain
 * @param {string} queryString - Query string (e.g., "id:gid://shopify/Checkout/...")
 * @param {number} first - Number of results per page (default: 10, max: 250)
 * @param {Object} options - Options (requestId, maxPages)
 * @returns {Promise<Array>} Array of abandoned checkouts
 */
export async function getAbandonedCheckouts(
  shopDomain,
  queryString = '',
  first = 10,
  options = {},
) {
  const maxPages = options.maxPages || 100; // Prevent infinite loops
  const requestId = options.requestId || 'unknown';
  const queryName = 'GetAbandonedCheckouts';

  const query = `
    query GetAbandonedCheckouts($first: Int!, $query: String, $after: String) {
      abandonedCheckouts(first: $first, query: $query, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
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

  const allCheckouts = [];
  let cursor = null;
  let hasNextPage = true;
  let pageCount = 0;

  while (hasNextPage && pageCount < maxPages) {
    const data = await executeGraphQLQuery(
      shopDomain,
      query,
      {
        first: Math.min(first, 250), // Shopify max is 250
        query: queryString || undefined,
        after: cursor || undefined,
      },
      {
        queryName,
        requestId,
      },
    );

    // Validate response with zod schema
    const validated = validateGraphQLResponse(
      data,
      AbandonedCheckoutsListResponseSchema,
      queryName,
      requestId,
    );

    const checkouts = validated.abandonedCheckouts?.nodes || [];
    allCheckouts.push(...checkouts);

    const pageInfo = validated.abandonedCheckouts?.pageInfo;
    hasNextPage = pageInfo?.hasNextPage || false;
    cursor = pageInfo?.endCursor || null;
    pageCount++;

    logger.debug('Fetched abandoned checkouts page', {
      shopDomain,
      requestId,
      pageCount,
      checkoutsInPage: checkouts.length,
      totalCheckouts: allCheckouts.length,
      hasNextPage,
    });
  }

  if (pageCount >= maxPages) {
    logger.warn('Reached max pages limit for abandoned checkouts', {
      shopDomain,
      requestId,
      maxPages,
      totalCheckouts: allCheckouts.length,
    });
  }

  logger.info('Fetched all abandoned checkouts', {
    shopDomain,
    requestId,
    totalCheckouts: allCheckouts.length,
    pages: pageCount,
  });

  return allCheckouts;
}

/**
 * Get customer details
 * @param {string} shopDomain - Shop domain
 * @param {string} customerId - Shopify customer ID (gid://shopify/Customer/...)
 * @returns {Promise<Object>} Customer details
 */
export async function getCustomerDetails(shopDomain, customerId, options = {}) {
  const queryName = 'GetCustomerDetails';
  const requestId = options.requestId || 'unknown';

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

  const data = await executeGraphQLQuery(
    shopDomain,
    query,
    { id: customerId },
    {
      queryName,
      requestId,
    },
  );

  // Validate response with zod schema
  const validated = validateGraphQLResponse(
    data,
    CustomerResponseSchema,
    queryName,
    requestId,
  );

  if (!validated.customer) {
    throw new Error(`Customer not found: ${customerId}`);
  }

  return validated.customer;
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
  options = {},
) {
  const queryName = 'GetProductRecommendations';
  const requestId = options.requestId || 'unknown';

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
    const data = await executeGraphQLQuery(
      shopDomain,
      query,
      { productId, first },
      {
        queryName,
        requestId,
      },
    );

    // Validate response with zod schema (best-effort, may fail for some stores)
    try {
      const validated = validateGraphQLResponse(
        data,
        ProductRecommendationsResponseSchema,
        queryName,
        requestId,
      );
      return validated.productRecommendations || [];
    } catch (validationError) {
      // Product recommendations may not be available for all stores
      // Return empty array if validation fails (graceful degradation)
      logger.warn('Product recommendations validation failed, returning empty array', {
        shopDomain,
        productId,
        requestId,
        error: validationError.message,
      });
      return [];
    }
  } catch (error) {
    // Product recommendations API might not be available for all stores
    logger.warn('Product recommendations not available', {
      shopDomain,
      productId,
      requestId,
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
