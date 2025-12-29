/**
 * Automation Variables Documentation
 * Maps automation trigger types to available template variables
 * Based on cursor_instructions.txt lines 225-234
 */

/**
 * Available variables for each automation type
 */
export const AUTOMATION_VARIABLES = {
  order_placed: [
    'order.name',
    'customer.firstName',
    'customer.lastName',
    'customer.displayName',
    'totalPrice',
    'currency',
    'lineItems',
    'discountCodes',
    'shippingAddress.city',
    'shippingAddress.country',
  ],
  order_fulfilled: [
    'order.name',
    'customer.firstName',
    'customer.lastName',
    'customer.displayName',
    'tracking.number',
    'tracking.url',
    'tracking.company',
    'estimatedDeliveryAt',
  ],
  cart_abandoned: [
    'customer.firstName',
    'customer.lastName',
    'customer.displayName',
    'lineItems',
    'abandonedCheckoutUrl',
    'subtotalPrice',
    'discountCodes',
  ],
  welcome: ['subscriber.firstName', 'subscriber.lastName'],
  review_request: [
    'customer.firstName',
    'customer.lastName',
    'customer.displayName',
    'order.name',
    'lineItems',
    'reviewLink',
  ],
  win_back: ['customer.firstName', 'customer.lastName', 'customer.displayName'],
  cross_sell: ['productTitle', 'recommendedProducts'],
  birthday: ['customer.firstName', 'customer.lastName', 'customer.displayName'],
  customer_inactive: [
    'customer.firstName',
    'customer.lastName',
    'customer.displayName',
    'daysSinceLastOrder',
  ],
};

/**
 * Get available variables for an automation trigger type
 * @param {string} triggerType - Automation trigger type
 * @returns {Array<string>} Array of available variable names
 */
export function getAvailableVariables(triggerType) {
  return AUTOMATION_VARIABLES[triggerType] || [];
}

/**
 * Get variable description
 * @param {string} variableName - Variable name (e.g., "order.name")
 * @returns {Object} Variable description with example
 */
export function getVariableDescription(variableName) {
  const descriptions = {
    'order.name': {
      name: 'order.name',
      description: 'Order number/name (e.g., "#1001")',
      example: '#1001',
    },
    'customer.firstName': {
      name: 'customer.firstName',
      description: "Customer's first name",
      example: 'John',
    },
    'customer.lastName': {
      name: 'customer.lastName',
      description: "Customer's last name",
      example: 'Doe',
    },
    'customer.displayName': {
      name: 'customer.displayName',
      description: "Customer's full display name",
      example: 'John Doe',
    },
    totalPrice: {
      name: 'totalPrice',
      description: 'Total order price amount',
      example: '99.99',
    },
    currency: {
      name: 'currency',
      description: 'Currency code',
      example: 'EUR',
    },
    lineItems: {
      name: 'lineItems',
      description: 'Formatted list of products in order/cart',
      example: 'Product A x2, Product B x1',
    },
    discountCodes: {
      name: 'discountCodes',
      description: 'Discount codes used',
      example: 'SAVE10',
    },
    'shippingAddress.city': {
      name: 'shippingAddress.city',
      description: 'Shipping city',
      example: 'Athens',
    },
    'shippingAddress.country': {
      name: 'shippingAddress.country',
      description: 'Shipping country',
      example: 'Greece',
    },
    'tracking.number': {
      name: 'tracking.number',
      description: 'Tracking number',
      example: '1Z999AA10123456784',
    },
    'tracking.url': {
      name: 'tracking.url',
      description: 'Tracking URL',
      example: 'https://tracking.example.com/1Z999AA10123456784',
    },
    'tracking.company': {
      name: 'tracking.company',
      description: 'Shipping company name',
      example: 'UPS',
    },
    estimatedDeliveryAt: {
      name: 'estimatedDeliveryAt',
      description: 'Estimated delivery date',
      example: '2024-01-15',
    },
    abandonedCheckoutUrl: {
      name: 'abandonedCheckoutUrl',
      description: 'Recovery URL for abandoned checkout',
      example: 'https://shop.example.com/checkouts/...',
    },
    subtotalPrice: {
      name: 'subtotalPrice',
      description: 'Subtotal price of abandoned cart',
      example: '49.99',
    },
    'subscriber.firstName': {
      name: 'subscriber.firstName',
      description: "Subscriber's first name",
      example: 'Jane',
    },
    'subscriber.lastName': {
      name: 'subscriber.lastName',
      description: "Subscriber's last name",
      example: 'Smith',
    },
    reviewLink: {
      name: 'reviewLink',
      description: 'Link to review page',
      example: 'https://shop.example.com/reviews/...',
    },
    productTitle: {
      name: 'productTitle',
      description: 'Product title',
      example: 'Premium Widget',
    },
    recommendedProducts: {
      name: 'recommendedProducts',
      description: 'List of recommended products',
      example: 'Product X, Product Y',
    },
    daysSinceLastOrder: {
      name: 'daysSinceLastOrder',
      description: 'Days since last order',
      example: '90',
    },
  };

  return (
    descriptions[variableName] || {
      name: variableName,
      description: 'Variable description not available',
      example: 'N/A',
    }
  );
}

/**
 * Get all variable descriptions for a trigger type
 * @param {string} triggerType - Automation trigger type
 * @returns {Array<Object>} Array of variable descriptions
 */
export function getVariableDescriptions(triggerType) {
  const variables = getAvailableVariables(triggerType);
  return variables.map(varName => getVariableDescription(varName));
}

/**
 * Validate if a variable is available for a trigger type
 * @param {string} triggerType - Automation trigger type
 * @param {string} variableName - Variable name to check
 * @returns {boolean} True if variable is available
 */
export function isVariableAvailable(triggerType, variableName) {
  const available = getAvailableVariables(triggerType);
  return available.includes(variableName);
}

export default {
  AUTOMATION_VARIABLES,
  getAvailableVariables,
  getVariableDescription,
  getVariableDescriptions,
  isVariableAvailable,
};
