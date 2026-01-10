import { z } from 'zod';

/**
 * Zod schemas for Shopify GraphQL responses
 * Used for runtime validation to catch schema changes early
 */

/**
 * Money amount schema (Shopify MoneyV2)
 */
const MoneySchema = z.object({
  amount: z.string(),
  currencyCode: z.string(),
});

/**
 * Money set schema (Shopify MoneyBag)
 */
const MoneySetSchema = z.object({
  shopMoney: MoneySchema,
});

/**
 * Customer schema (Shopify Customer)
 */
const CustomerSchema = z.object({
  id: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  defaultPhoneNumber: z
    .object({
      phoneNumber: z.string().nullable(),
    })
    .nullable(),
  locale: z.string().nullable(),
});

/**
 * Line item schema (Shopify OrderLineItem)
 */
const LineItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  quantity: z.number(),
  variant: z
    .object({
      id: z.string(),
      title: z.string().nullable(),
      price: z.string().nullable(),
    })
    .nullable(),
});

/**
 * Shipping address schema (Shopify MailingAddress)
 */
const ShippingAddressSchema = z.object({
  address1: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  country: z.string().nullable(),
  zip: z.string().nullable(),
});

/**
 * Tracking info schema (Shopify FulfillmentTrackingInfo)
 */
const TrackingInfoSchema = z.object({
  number: z.string().nullable(),
  url: z.string().nullable(),
  company: z.string().nullable(),
});

/**
 * Fulfillment schema (Shopify Fulfillment)
 */
const FulfillmentSchema = z.object({
  id: z.string(),
  status: z.string(),
  trackingInfo: z.array(TrackingInfoSchema).nullable(),
});

/**
 * Order response schema (Shopify Order)
 */
export const OrderResponseSchema = z.object({
  order: z
    .object({
      id: z.string(),
      name: z.string(),
      processedAt: z.string().nullable(),
      phone: z.string().nullable(),
      totalPriceSet: MoneySetSchema.nullable(),
      customer: CustomerSchema.nullable(),
      lineItems: z.object({
        edges: z.array(
          z.object({
            node: LineItemSchema,
          }),
        ),
      }),
      discountCodes: z.array(z.string()).nullable(),
      shippingAddress: ShippingAddressSchema.nullable(),
      fulfillments: z.array(FulfillmentSchema).nullable(),
    })
    .nullable(),
});

/**
 * Fulfillment response schema (Shopify Fulfillment)
 */
export const FulfillmentResponseSchema = z.object({
  fulfillment: z
    .object({
      id: z.string(),
      createdAt: z.string(),
      estimatedDeliveryAt: z.string().nullable(),
      status: z.string(),
      trackingInfo: z.array(TrackingInfoSchema).nullable(),
      order: z
        .object({
          id: z.string(),
          name: z.string(),
          customer: CustomerSchema.nullable(),
        })
        .nullable(),
    })
    .nullable(),
});

/**
 * Abandoned checkout payload schema
 */
const AbandonedCheckoutPayloadSchema = z.object({
  abandonedCheckoutUrl: z.string().nullable(),
  lineItems: z
    .object({
      edges: z.array(
        z.object({
          node: z.object({
            id: z.string(),
            title: z.string(),
            quantity: z.number(),
            image: z
              .object({
                url: z.string().nullable(),
              })
              .nullable(),
          }),
        }),
      ),
    })
    .nullable(),
  subtotalPriceSet: MoneySetSchema.nullable(),
  discountCodes: z.array(z.string()).nullable(),
});

/**
 * Abandonment response schema (Shopify Abandonment)
 */
export const AbandonmentResponseSchema = z.object({
  abandonment: z
    .object({
      id: z.string(),
      abandonedCheckoutPayload: AbandonedCheckoutPayloadSchema.nullable(),
      customer: CustomerSchema.nullable(),
      emailState: z.string().nullable(),
      daysSinceLastAbandonmentEmail: z.number().nullable(),
      hoursSinceLastAbandonedCheckout: z.number().nullable(),
    })
    .nullable(),
});

/**
 * Abandoned checkouts list response schema
 */
export const AbandonedCheckoutsListResponseSchema = z.object({
  abandonedCheckouts: z
    .object({
      pageInfo: z
        .object({
          hasNextPage: z.boolean(),
          endCursor: z.string().nullable(),
        })
        .nullable(),
      nodes: z.array(
        z.object({
          id: z.string(),
          abandonedCheckoutUrl: z.string().nullable(),
          lineItems: z
            .object({
              edges: z.array(
                z.object({
                  node: z.object({
                    id: z.string(),
                    title: z.string(),
                    quantity: z.number(),
                    image: z
                      .object({
                        url: z.string().nullable(),
                      })
                      .nullable(),
                  }),
                }),
              ),
            })
            .nullable(),
          subtotalPriceSet: MoneySetSchema.nullable(),
          discountCodes: z.array(z.string()).nullable(),
          customer: CustomerSchema.nullable(),
          email: z.string().nullable(),
          phone: z.string().nullable(),
        }),
      ),
    })
    .nullable(),
});

/**
 * Customer response schema (Shopify Customer)
 */
export const CustomerResponseSchema = z.object({
  customer: z
    .object({
      id: z.string(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      displayName: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      defaultAddress: z
        .object({
          address1: z.string().nullable(),
          city: z.string().nullable(),
          province: z.string().nullable(),
          country: z.string().nullable(),
          zip: z.string().nullable(),
          phone: z.string().nullable(),
        })
        .nullable(),
      defaultPhoneNumber: z
        .object({
          phoneNumber: z.string().nullable(),
        })
        .nullable(),
      locale: z.string().nullable(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable(),
      ordersCount: z.number().nullable(),
      totalSpent: MoneySchema.nullable(),
    })
    .nullable(),
});

/**
 * Product recommendations response schema
 */
export const ProductRecommendationsResponseSchema = z.object({
  productRecommendations: z.array(
    z.object({
      id: z.string(),
      title: z.string().nullable(),
      handle: z.string().nullable(),
      images: z
        .object({
          edges: z.array(
            z.object({
              node: z.object({
                url: z.string().nullable(),
              }),
            }),
          ),
        })
        .nullable(),
      priceRange: z
        .object({
          minVariantPrice: MoneySchema.nullable(),
        })
        .nullable(),
    }),
  ),
});

/**
 * Validate GraphQL response with zod schema
 * @param {Object} data - Response data to validate
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} queryName - Query name for error messages
 * @param {string} requestId - Request ID for logging
 * @returns {Object} Validated data
 * @throws {Error} If validation fails
 */
export function validateGraphQLResponse(data, schema, queryName, requestId) {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const { logger } = require('../utils/logger.js');
      logger.error('GraphQL response validation failed', {
        queryName,
        requestId,
        errors: error.errors,
        dataPreview: JSON.stringify(data).substring(0, 500),
      });
      throw new Error(
        `Invalid GraphQL response for ${queryName}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
      );
    }
    throw error;
  }
}

export default {
  OrderResponseSchema,
  FulfillmentResponseSchema,
  AbandonmentResponseSchema,
  AbandonedCheckoutsListResponseSchema,
  CustomerResponseSchema,
  ProductRecommendationsResponseSchema,
  validateGraphQLResponse,
};

