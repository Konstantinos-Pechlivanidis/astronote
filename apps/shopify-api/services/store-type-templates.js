/**
 * Store-Type Template Library
 *
 * Global templates organized by store-type categories (e-commerce verticals).
 * Each category has exactly 5 templates covering essential SMS use cases.
 *
 * All templates are global (shopId = NULL, isPublic = true) and visible to all shops.
 */

// Store-type category names (display names)
export const STORE_TYPE_CATEGORIES = {
  'Fashion & Apparel': {
    slug: 'fashion-apparel',
    displayOrder: 1,
    eshopTypeMapping: ['fashion'],
  },
  'Beauty & Cosmetics': {
    slug: 'beauty-cosmetics',
    displayOrder: 2,
    eshopTypeMapping: ['beauty'],
  },
  'Electronics & Gadgets': {
    slug: 'electronics-gadgets',
    displayOrder: 3,
    eshopTypeMapping: ['electronics'],
  },
  'Home & Living': {
    slug: 'home-living',
    displayOrder: 4,
    eshopTypeMapping: ['home'],
  },
  'Health & Wellness': {
    slug: 'health-wellness',
    displayOrder: 5,
    eshopTypeMapping: ['services'],
  },
  'Food & Beverage': {
    slug: 'food-beverage',
    displayOrder: 6,
    eshopTypeMapping: ['food'],
  },
  'Jewelry & Accessories': {
    slug: 'jewelry-accessories',
    displayOrder: 7,
    eshopTypeMapping: ['fashion'], // Share with fashion
  },
  'Baby & Kids': {
    slug: 'baby-kids',
    displayOrder: 8,
    eshopTypeMapping: ['toys'],
  },
  'Sports & Fitness': {
    slug: 'sports-fitness',
    displayOrder: 9,
    eshopTypeMapping: ['sports'],
  },
  'Pet Supplies': {
    slug: 'pet-supplies',
    displayOrder: 10,
    eshopTypeMapping: ['generic'], // Use generic as fallback
  },
};

/**
 * Store-Type Templates
 *
 * Structure: Each store-type category has exactly 5 templates:
 * 1. Welcome / Opt-in Confirmation
 * 2. Abandoned Cart Reminder
 * 3. Promo / Discount
 * 4. Back in Stock
 * 5. Order Update (Shipped / Delivered / Tracking)
 */
export const STORE_TYPE_TEMPLATES = {
  'Fashion & Apparel': [
    {
      templateKey: 'fashion_apparel_welcome_01',
      name: 'Welcome to Fashion Store',
      category: 'Fashion & Apparel',
      text: 'Hi {{firstName}}! Welcome to {{shopName}}! Get 10% off your first order with code {{discountCode}}. Shop now!',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
      tags: ['welcome', 'opt-in', 'first-purchase'],
    },
    {
      templateKey: 'fashion_apparel_abandoned_cart_01',
      name: 'Complete Your Fashion Purchase',
      category: 'Fashion & Apparel',
      text: 'Hi {{firstName}}, you left items in your cart! Complete your purchase at {{cartUrl}} and get free shipping. Use code {{discountCode}} for 10% off!',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
      tags: ['abandoned-cart', 'recovery'],
    },
    {
      templateKey: 'fashion_apparel_promo_01',
      name: 'Fashion Sale Alert',
      category: 'Fashion & Apparel',
      text: '{{firstName}}, exclusive sale at {{shopName}}! Get {{discountValue}} off with code {{discountCode}}. Limited time only - shop now!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
      tags: ['promo', 'discount', 'sale'],
    },
    {
      templateKey: 'fashion_apparel_back_in_stock_01',
      name: 'Fashion Item Back in Stock',
      category: 'Fashion & Apparel',
      text: 'Great news {{firstName}}! {{productName}} is back in stock at {{shopName}}. Order now before it sells out: {{cartUrl}}',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
      tags: ['back-in-stock', 'notification'],
    },
    {
      templateKey: 'fashion_apparel_order_update_01',
      name: 'Fashion Order Shipped',
      category: 'Fashion & Apparel',
      text: 'Hi {{firstName}}, your order #{{orderNumber}} has shipped! Track it here: {{trackingUrl}}. Questions? Call {{supportPhone}}.',
      goal: 'Provide order updates and improve customer experience',
      suggestedMetrics: 'Customer satisfaction, support ticket reduction',
      tags: ['order-update', 'shipped', 'tracking'],
    },
  ],
  'Beauty & Cosmetics': [
    {
      templateKey: 'beauty_cosmetics_welcome_01',
      name: 'Welcome to Beauty Store',
      category: 'Beauty & Cosmetics',
      text: 'Hi {{firstName}}! Welcome to {{shopName}}! Get 15% off your first beauty purchase with code {{discountCode}}. Shop now!',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
      tags: ['welcome', 'opt-in', 'first-purchase'],
    },
    {
      templateKey: 'beauty_cosmetics_abandoned_cart_01',
      name: 'Complete Your Beauty Purchase',
      category: 'Beauty & Cosmetics',
      text: 'Hi {{firstName}}, your beauty favorites are waiting! Complete your purchase at {{cartUrl}} and save {{discountValue}} with code {{discountCode}}.',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
      tags: ['abandoned-cart', 'recovery'],
    },
    {
      templateKey: 'beauty_cosmetics_promo_01',
      name: 'Beauty Sale Alert',
      category: 'Beauty & Cosmetics',
      text: '{{firstName}}, beauty sale at {{shopName}}! Get {{discountValue}} off with code {{discountCode}}. Stock up on your favorites!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
      tags: ['promo', 'discount', 'sale'],
    },
    {
      templateKey: 'beauty_cosmetics_back_in_stock_01',
      name: 'Beauty Product Back in Stock',
      category: 'Beauty & Cosmetics',
      text: '{{firstName}}, {{productName}} is back in stock! Order now at {{cartUrl}} before it sells out again.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
      tags: ['back-in-stock', 'notification'],
    },
    {
      templateKey: 'beauty_cosmetics_order_update_01',
      name: 'Beauty Order Shipped',
      category: 'Beauty & Cosmetics',
      text: 'Hi {{firstName}}, your beauty order #{{orderNumber}} is on its way! Track: {{trackingUrl}}. Need help? {{supportPhone}}.',
      goal: 'Provide order updates and improve customer experience',
      suggestedMetrics: 'Customer satisfaction, support ticket reduction',
      tags: ['order-update', 'shipped', 'tracking'],
    },
  ],
  'Electronics & Gadgets': [
    {
      templateKey: 'electronics_gadgets_welcome_01',
      name: 'Welcome to Electronics Store',
      category: 'Electronics & Gadgets',
      text: 'Hi {{firstName}}! Welcome to {{shopName}}! Get 10% off your first tech purchase with code {{discountCode}}. Shop now!',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
      tags: ['welcome', 'opt-in', 'first-purchase'],
    },
    {
      templateKey: 'electronics_gadgets_abandoned_cart_01',
      name: 'Complete Your Tech Purchase',
      category: 'Electronics & Gadgets',
      text: 'Hi {{firstName}}, don\'t miss out on your tech picks! Complete your purchase at {{cartUrl}} and save with code {{discountCode}}.',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
      tags: ['abandoned-cart', 'recovery'],
    },
    {
      templateKey: 'electronics_gadgets_promo_01',
      name: 'Electronics Sale Alert',
      category: 'Electronics & Gadgets',
      text: '{{firstName}}, tech sale at {{shopName}}! Get {{discountValue}} off with code {{discountCode}}. Upgrade your tech today!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
      tags: ['promo', 'discount', 'sale'],
    },
    {
      templateKey: 'electronics_gadgets_back_in_stock_01',
      name: 'Electronics Item Back in Stock',
      category: 'Electronics & Gadgets',
      text: '{{firstName}}, {{productName}} is back in stock! Order now at {{cartUrl}} before it sells out.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
      tags: ['back-in-stock', 'notification'],
    },
    {
      templateKey: 'electronics_gadgets_order_update_01',
      name: 'Electronics Order Shipped',
      category: 'Electronics & Gadgets',
      text: 'Hi {{firstName}}, your order #{{orderNumber}} has shipped! Track: {{trackingUrl}}. Support: {{supportPhone}}.',
      goal: 'Provide order updates and improve customer experience',
      suggestedMetrics: 'Customer satisfaction, support ticket reduction',
      tags: ['order-update', 'shipped', 'tracking'],
    },
  ],
  'Home & Living': [
    {
      templateKey: 'home_living_welcome_01',
      name: 'Welcome to Home Store',
      category: 'Home & Living',
      text: 'Hi {{firstName}}! Welcome to {{shopName}}! Get 10% off your first home purchase with code {{discountCode}}. Transform your space!',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
      tags: ['welcome', 'opt-in', 'first-purchase'],
    },
    {
      templateKey: 'home_living_abandoned_cart_01',
      name: 'Complete Your Home Purchase',
      category: 'Home & Living',
      text: 'Hi {{firstName}}, your home essentials are waiting! Complete your purchase at {{cartUrl}} and save with code {{discountCode}}.',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
      tags: ['abandoned-cart', 'recovery'],
    },
    {
      templateKey: 'home_living_promo_01',
      name: 'Home Sale Alert',
      category: 'Home & Living',
      text: '{{firstName}}, home sale at {{shopName}}! Get {{discountValue}} off with code {{discountCode}}. Refresh your space!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
      tags: ['promo', 'discount', 'sale'],
    },
    {
      templateKey: 'home_living_back_in_stock_01',
      name: 'Home Item Back in Stock',
      category: 'Home & Living',
      text: '{{firstName}}, {{productName}} is back in stock! Order now at {{cartUrl}} before it\'s gone.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
      tags: ['back-in-stock', 'notification'],
    },
    {
      templateKey: 'home_living_order_update_01',
      name: 'Home Order Shipped',
      category: 'Home & Living',
      text: 'Hi {{firstName}}, your order #{{orderNumber}} is on its way! Track: {{trackingUrl}}. Questions? {{supportPhone}}.',
      goal: 'Provide order updates and improve customer experience',
      suggestedMetrics: 'Customer satisfaction, support ticket reduction',
      tags: ['order-update', 'shipped', 'tracking'],
    },
  ],
  'Health & Wellness': [
    {
      templateKey: 'health_wellness_welcome_01',
      name: 'Welcome to Health Store',
      category: 'Health & Wellness',
      text: 'Hi {{firstName}}! Welcome to {{shopName}}! Get 15% off your first wellness purchase with code {{discountCode}}. Start your journey!',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
      tags: ['welcome', 'opt-in', 'first-purchase'],
    },
    {
      templateKey: 'health_wellness_abandoned_cart_01',
      name: 'Complete Your Wellness Purchase',
      category: 'Health & Wellness',
      text: 'Hi {{firstName}}, your wellness items are waiting! Complete your purchase at {{cartUrl}} and save with code {{discountCode}}.',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
      tags: ['abandoned-cart', 'recovery'],
    },
    {
      templateKey: 'health_wellness_promo_01',
      name: 'Health Sale Alert',
      category: 'Health & Wellness',
      text: '{{firstName}}, wellness sale at {{shopName}}! Get {{discountValue}} off with code {{discountCode}}. Invest in your health!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
      tags: ['promo', 'discount', 'sale'],
    },
    {
      templateKey: 'health_wellness_back_in_stock_01',
      name: 'Health Product Back in Stock',
      category: 'Health & Wellness',
      text: '{{firstName}}, {{productName}} is back in stock! Order now at {{cartUrl}} before it sells out.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
      tags: ['back-in-stock', 'notification'],
    },
    {
      templateKey: 'health_wellness_order_update_01',
      name: 'Health Order Shipped',
      category: 'Health & Wellness',
      text: 'Hi {{firstName}}, your order #{{orderNumber}} has shipped! Track: {{trackingUrl}}. Support: {{supportPhone}}.',
      goal: 'Provide order updates and improve customer experience',
      suggestedMetrics: 'Customer satisfaction, support ticket reduction',
      tags: ['order-update', 'shipped', 'tracking'],
    },
  ],
  'Food & Beverage': [
    {
      templateKey: 'food_beverage_welcome_01',
      name: 'Welcome to Food Store',
      category: 'Food & Beverage',
      text: 'Hi {{firstName}}! Welcome to {{shopName}}! Get 10% off your first order with code {{discountCode}}. Enjoy fresh delivery!',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
      tags: ['welcome', 'opt-in', 'first-purchase'],
    },
    {
      templateKey: 'food_beverage_abandoned_cart_01',
      name: 'Complete Your Food Order',
      category: 'Food & Beverage',
      text: 'Hi {{firstName}}, your cart is waiting! Complete your order at {{cartUrl}} and get free delivery with code {{discountCode}}.',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
      tags: ['abandoned-cart', 'recovery'],
    },
    {
      templateKey: 'food_beverage_promo_01',
      name: 'Food Sale Alert',
      category: 'Food & Beverage',
      text: '{{firstName}}, special offer at {{shopName}}! Get {{discountValue}} off with code {{discountCode}}. Order now!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
      tags: ['promo', 'discount', 'sale'],
    },
    {
      templateKey: 'food_beverage_back_in_stock_01',
      name: 'Food Item Back in Stock',
      category: 'Food & Beverage',
      text: '{{firstName}}, {{productName}} is back in stock! Order now at {{cartUrl}} for fresh delivery.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
      tags: ['back-in-stock', 'notification'],
    },
    {
      templateKey: 'food_beverage_order_update_01',
      name: 'Food Order Shipped',
      category: 'Food & Beverage',
      text: 'Hi {{firstName}}, your order #{{orderNumber}} is on its way! Track: {{trackingUrl}}. Questions? {{supportPhone}}.',
      goal: 'Provide order updates and improve customer experience',
      suggestedMetrics: 'Customer satisfaction, support ticket reduction',
      tags: ['order-update', 'shipped', 'tracking'],
    },
  ],
  'Jewelry & Accessories': [
    {
      templateKey: 'jewelry_accessories_welcome_01',
      name: 'Welcome to Jewelry Store',
      category: 'Jewelry & Accessories',
      text: 'Hi {{firstName}}! Welcome to {{shopName}}! Get 15% off your first jewelry purchase with code {{discountCode}}. Shop now!',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
      tags: ['welcome', 'opt-in', 'first-purchase'],
    },
    {
      templateKey: 'jewelry_accessories_abandoned_cart_01',
      name: 'Complete Your Jewelry Purchase',
      category: 'Jewelry & Accessories',
      text: 'Hi {{firstName}}, your jewelry favorites are waiting! Complete your purchase at {{cartUrl}} and save with code {{discountCode}}.',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
      tags: ['abandoned-cart', 'recovery'],
    },
    {
      templateKey: 'jewelry_accessories_promo_01',
      name: 'Jewelry Sale Alert',
      category: 'Jewelry & Accessories',
      text: '{{firstName}}, jewelry sale at {{shopName}}! Get {{discountValue}} off with code {{discountCode}}. Find your perfect piece!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
      tags: ['promo', 'discount', 'sale'],
    },
    {
      templateKey: 'jewelry_accessories_back_in_stock_01',
      name: 'Jewelry Item Back in Stock',
      category: 'Jewelry & Accessories',
      text: '{{firstName}}, {{productName}} is back in stock! Order now at {{cartUrl}} before it sells out.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
      tags: ['back-in-stock', 'notification'],
    },
    {
      templateKey: 'jewelry_accessories_order_update_01',
      name: 'Jewelry Order Shipped',
      category: 'Jewelry & Accessories',
      text: 'Hi {{firstName}}, your order #{{orderNumber}} has shipped! Track: {{trackingUrl}}. Support: {{supportPhone}}.',
      goal: 'Provide order updates and improve customer experience',
      suggestedMetrics: 'Customer satisfaction, support ticket reduction',
      tags: ['order-update', 'shipped', 'tracking'],
    },
  ],
  'Baby & Kids': [
    {
      templateKey: 'baby_kids_welcome_01',
      name: 'Welcome to Baby Store',
      category: 'Baby & Kids',
      text: 'Hi {{firstName}}! Welcome to {{shopName}}! Get 15% off your first baby purchase with code {{discountCode}}. Shop now!',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
      tags: ['welcome', 'opt-in', 'first-purchase'],
    },
    {
      templateKey: 'baby_kids_abandoned_cart_01',
      name: 'Complete Your Baby Purchase',
      category: 'Baby & Kids',
      text: 'Hi {{firstName}}, your baby essentials are waiting! Complete your purchase at {{cartUrl}} and save with code {{discountCode}}.',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
      tags: ['abandoned-cart', 'recovery'],
    },
    {
      templateKey: 'baby_kids_promo_01',
      name: 'Baby Sale Alert',
      category: 'Baby & Kids',
      text: '{{firstName}}, baby sale at {{shopName}}! Get {{discountValue}} off with code {{discountCode}}. Stock up on essentials!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
      tags: ['promo', 'discount', 'sale'],
    },
    {
      templateKey: 'baby_kids_back_in_stock_01',
      name: 'Baby Item Back in Stock',
      category: 'Baby & Kids',
      text: '{{firstName}}, {{productName}} is back in stock! Order now at {{cartUrl}} before it sells out.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
      tags: ['back-in-stock', 'notification'],
    },
    {
      templateKey: 'baby_kids_order_update_01',
      name: 'Baby Order Shipped',
      category: 'Baby & Kids',
      text: 'Hi {{firstName}}, your order #{{orderNumber}} is on its way! Track: {{trackingUrl}}. Questions? {{supportPhone}}.',
      goal: 'Provide order updates and improve customer experience',
      suggestedMetrics: 'Customer satisfaction, support ticket reduction',
      tags: ['order-update', 'shipped', 'tracking'],
    },
  ],
  'Sports & Fitness': [
    {
      templateKey: 'sports_fitness_welcome_01',
      name: 'Welcome to Sports Store',
      category: 'Sports & Fitness',
      text: 'Hi {{firstName}}! Welcome to {{shopName}}! Get 15% off your first sports purchase with code {{discountCode}}. Get active!',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
      tags: ['welcome', 'opt-in', 'first-purchase'],
    },
    {
      templateKey: 'sports_fitness_abandoned_cart_01',
      name: 'Complete Your Sports Purchase',
      category: 'Sports & Fitness',
      text: 'Hi {{firstName}}, your sports gear is waiting! Complete your purchase at {{cartUrl}} and save with code {{discountCode}}.',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
      tags: ['abandoned-cart', 'recovery'],
    },
    {
      templateKey: 'sports_fitness_promo_01',
      name: 'Sports Sale Alert',
      category: 'Sports & Fitness',
      text: '{{firstName}}, sports sale at {{shopName}}! Get {{discountValue}} off with code {{discountCode}}. Gear up today!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
      tags: ['promo', 'discount', 'sale'],
    },
    {
      templateKey: 'sports_fitness_back_in_stock_01',
      name: 'Sports Item Back in Stock',
      category: 'Sports & Fitness',
      text: '{{firstName}}, {{productName}} is back in stock! Order now at {{cartUrl}} before it\'s gone.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
      tags: ['back-in-stock', 'notification'],
    },
    {
      templateKey: 'sports_fitness_order_update_01',
      name: 'Sports Order Shipped',
      category: 'Sports & Fitness',
      text: 'Hi {{firstName}}, your order #{{orderNumber}} has shipped! Track: {{trackingUrl}}. Support: {{supportPhone}}.',
      goal: 'Provide order updates and improve customer experience',
      suggestedMetrics: 'Customer satisfaction, support ticket reduction',
      tags: ['order-update', 'shipped', 'tracking'],
    },
  ],
  'Pet Supplies': [
    {
      templateKey: 'pet_supplies_welcome_01',
      name: 'Welcome to Pet Store',
      category: 'Pet Supplies',
      text: 'Hi {{firstName}}! Welcome to {{shopName}}! Get 10% off your first pet purchase with code {{discountCode}}. Shop now!',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
      tags: ['welcome', 'opt-in', 'first-purchase'],
    },
    {
      templateKey: 'pet_supplies_abandoned_cart_01',
      name: 'Complete Your Pet Purchase',
      category: 'Pet Supplies',
      text: 'Hi {{firstName}}, your pet essentials are waiting! Complete your purchase at {{cartUrl}} and save with code {{discountCode}}.',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
      tags: ['abandoned-cart', 'recovery'],
    },
    {
      templateKey: 'pet_supplies_promo_01',
      name: 'Pet Sale Alert',
      category: 'Pet Supplies',
      text: '{{firstName}}, pet sale at {{shopName}}! Get {{discountValue}} off with code {{discountCode}}. Treat your pet!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
      tags: ['promo', 'discount', 'sale'],
    },
    {
      templateKey: 'pet_supplies_back_in_stock_01',
      name: 'Pet Item Back in Stock',
      category: 'Pet Supplies',
      text: '{{firstName}}, {{productName}} is back in stock! Order now at {{cartUrl}} before it sells out.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
      tags: ['back-in-stock', 'notification'],
    },
    {
      templateKey: 'pet_supplies_order_update_01',
      name: 'Pet Order Shipped',
      category: 'Pet Supplies',
      text: 'Hi {{firstName}}, your order #{{orderNumber}} has shipped! Track: {{trackingUrl}}. Questions? {{supportPhone}}.',
      goal: 'Provide order updates and improve customer experience',
      suggestedMetrics: 'Customer satisfaction, support ticket reduction',
      tags: ['order-update', 'shipped', 'tracking'],
    },
  ],
};

/**
 * Get all store-type categories in display order
 */
export function getStoreTypeCategories() {
  return Object.keys(STORE_TYPE_CATEGORIES).sort((a, b) => {
    return STORE_TYPE_CATEGORIES[a].displayOrder - STORE_TYPE_CATEGORIES[b].displayOrder;
  });
}

/**
 * Get templates for a specific store-type category
 */
export function getTemplatesByCategory(categoryName) {
  return STORE_TYPE_TEMPLATES[categoryName] || [];
}

/**
 * Get all templates (flattened)
 */
export function getAllStoreTypeTemplates() {
  return Object.values(STORE_TYPE_TEMPLATES).flat();
}

/**
 * Map eshopType to store-type category
 */
export function mapEshopTypeToCategory(eshopType) {
  const mapping = {
    fashion: 'Fashion & Apparel',
    beauty: 'Beauty & Cosmetics',
    electronics: 'Electronics & Gadgets',
    home: 'Home & Living',
    services: 'Health & Wellness',
    food: 'Food & Beverage',
    sports: 'Sports & Fitness',
    toys: 'Baby & Kids',
    books: 'Fashion & Apparel', // Fallback
    generic: 'Fashion & Apparel', // Default fallback
  };
  return mapping[eshopType] || 'Fashion & Apparel';
}

