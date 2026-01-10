import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { NotFoundError } from '../utils/errors.js';

/**
 * Templates Service
 * Handles template management and usage tracking
 */

/**
 * List templates with filtering (tenant-scoped and eShop type-scoped)
 * @param {string} shopId - Shop ID (required for tenant scoping)
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Templates list with pagination
 */
export async function listTemplates(shopId, filters = {}) {
  const { 
    eshopType, // Required: eShop type filter
    category, 
    search, 
    language = 'en', // Default to English
    page = 1, 
    pageSize = 50,
    offset, // Backward compatibility
    limit, // Backward compatibility
  } = filters;

  logger.info('Listing templates', { shopId, filters });

  // Build where clause (tenant-scoped and eShop type-scoped)
  const where = { 
    shopId, // Tenant scoping (aligned with Retail: ownerId concept)
  };

  // eShop type is required (aligned with Shopify-specific requirement)
  if (eshopType) {
    where.eshopType = eshopType;
  } else {
    // If eshopType not provided, try to get from shop settings
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { eshopType: true },
    });
    if (shop?.eshopType) {
      where.eshopType = shop.eshopType;
    } else {
      // Default to generic if shop has no eshopType set
      where.eshopType = 'generic';
    }
  }

  // Language filter (ENGLISH-ONLY for Shopify)
  // Shopify templates are English-only, so always filter by 'en' or ignore language field
  if (language) {
    // Only accept 'en' for Shopify (English-only requirement)
    if (language !== 'en') {
      logger.warn('Non-English language requested for Shopify templates, defaulting to English', {
        shopId,
        requestedLanguage: language,
      });
    }
    where.language = 'en'; // Force English-only
  } else {
    // Default to English if language not specified
    where.language = 'en';
  }

  // Category filter
  if (category) {
    where.category = category;
  }

  // Search filter (supports both name and text fields)
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } }, // Backward compatibility
      { text: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } }, // Backward compatibility
      { tags: { has: search } },
    ];
  }

  // Support both page/pageSize (Retail-aligned) and offset/limit (backward compatibility)
  const pageNum = page || (offset ? Math.floor(offset / (limit || 50)) + 1 : 1);
  const pageSizeNum = pageSize || limit || 50;
  const skip = (pageNum - 1) * pageSizeNum;

  // Execute query
  const [templates, total, categories] = await Promise.all([
    prisma.template.findMany({
      where,
      select: {
        id: true,
        name: true, // Retail-aligned field
        title: true, // Backward compatibility
        category: true,
        text: true, // Retail-aligned field
        content: true, // Backward compatibility
        language: true, // Retail-aligned field
        goal: true, // Retail-aligned field
        suggestedMetrics: true, // Retail-aligned field
        eshopType: true, // Shopify-specific field
        previewImage: true,
        tags: true,
        conversionRate: true,
        productViewsIncrease: true,
        clickThroughRate: true,
        averageOrderValue: true,
        customerRetention: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: pageSizeNum,
      skip: skip,
    }),
    prisma.template.count({ where }),
    prisma.template.findMany({
      where: { shopId, eshopType: where.eshopType },
      select: { category: true },
      distinct: ['category'],
    }),
  ]);

  const totalPages = Math.ceil(total / pageSizeNum);

  logger.info('Templates listed successfully', {
    shopId,
    eshopType: where.eshopType,
    total,
    returned: templates.length,
  });

  // Transform to Retail-aligned shape (items, total, page, pageSize)
  // Also include templates and pagination for backward compatibility
  return {
    items: templates, // Retail-aligned field name
    templates, // Backward compatibility
    total,
    page: pageNum,
    pageSize: pageSizeNum,
    pagination: {
      page: pageNum,
      pageSize: pageSizeNum,
      total,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
    categories: categories.map(c => c.category),
  };
}

/**
 * Get template by ID (tenant-scoped)
 * @param {string} shopId - Shop ID (required for tenant scoping)
 * @param {string} templateId - Template ID
 * @returns {Promise<Object>} Template data
 */
export async function getTemplateById(shopId, templateId) {
  logger.info('Getting template by ID', { shopId, templateId });

  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      shopId, // Tenant scoping (aligned with Retail: ownerId concept)
    },
    select: {
      id: true,
      name: true, // Retail-aligned field
      title: true, // Backward compatibility
      category: true,
      text: true, // Retail-aligned field
      content: true, // Backward compatibility
      language: true, // Retail-aligned field
      goal: true, // Retail-aligned field
      suggestedMetrics: true, // Retail-aligned field
      eshopType: true, // Shopify-specific field
      previewImage: true,
      tags: true,
      conversionRate: true,
      productViewsIncrease: true,
      clickThroughRate: true,
      averageOrderValue: true,
      customerRetention: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!template) {
    throw new NotFoundError('Template');
  }

  logger.info('Template retrieved successfully', { shopId, templateId });

  return template;
}

/**
 * Track template usage
 * @param {string} storeId - Store ID
 * @param {string} templateId - Template ID
 * @returns {Promise<Object>} Usage record
 */
export async function trackTemplateUsage(storeId, templateId) {
  logger.info('Tracking template usage', { storeId, templateId });

  // Verify template exists
  const template = await prisma.template.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new NotFoundError('Template');
  }

  // Create usage record
  const usage = await prisma.templateUsage.create({
    data: {
      shopId: storeId,
      templateId,
    },
  });

  logger.info('Template usage tracked', {
    storeId,
    templateId,
    usageId: usage.id,
  });

  return usage;
}

/**
 * Get template usage statistics for store
 * @param {string} storeId - Store ID
 * @returns {Promise<Object>} Usage statistics
 */
export async function getTemplateUsageStats(storeId) {
  logger.info('Getting template usage stats', { storeId });

  const [totalUsage, recentUsage, topTemplates] = await Promise.all([
    prisma.templateUsage.count({
      where: { shopId: storeId },
    }),
    prisma.templateUsage.findMany({
      where: { shopId: storeId },
      orderBy: { lastUsedAt: 'desc' },
      take: 10,
      include: {
        template: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
      },
    }),
    prisma.templateUsage.groupBy({
      by: ['templateId'],
      where: { shopId: storeId },
      _count: { templateId: true },
      orderBy: { _count: { templateId: 'desc' } },
      take: 5,
    }),
  ]);

  // Get template details for top templates
  const topTemplateIds = topTemplates.map(t => t.templateId);
  const templateDetails = await prisma.template.findMany({
    where: { id: { in: topTemplateIds } },
    select: { id: true, title: true, category: true },
  });

  const topTemplatesWithDetails = topTemplates.map(t => ({
    template: templateDetails.find(td => td.id === t.templateId),
    usageCount: t._count.templateId,
  }));

  logger.info('Template usage stats retrieved', { storeId, totalUsage });

  return {
    totalUsage,
    recentUsage,
    topTemplates: topTemplatesWithDetails,
  };
}

/**
 * Get popular templates (most used across all stores)
 * @param {number} limit - Number of templates to return
 * @returns {Promise<Array>} Popular templates
 */
export async function getPopularTemplates(limit = 10) {
  logger.info('Getting popular templates', { limit });

  const popularUsage = await prisma.templateUsage.groupBy({
    by: ['templateId'],
    _count: { templateId: true },
    orderBy: { _count: { templateId: 'desc' } },
    take: limit,
  });

  const templateIds = popularUsage.map(u => u.templateId);
  const templates = await prisma.template.findMany({
    where: { id: { in: templateIds }, isPublic: true },
    select: {
      id: true,
      title: true,
      category: true,
      content: true,
      previewImage: true,
      tags: true,
      conversionRate: true,
      productViewsIncrease: true,
      clickThroughRate: true,
      averageOrderValue: true,
      customerRetention: true,
    },
  });

  const popularTemplates = popularUsage.map(u => ({
    ...templates.find(t => t.id === u.templateId),
    usageCount: u._count.templateId,
  }));

  logger.info('Popular templates retrieved', {
    count: popularTemplates.length,
  });

  return popularTemplates;
}

/**
 * Default templates per eShop type
 * Aligned with Retail template structure but adapted for Shopify eShop types
 */
const DEFAULT_TEMPLATES = {
  fashion: [
    {
      templateKey: 'welcome_new_customer',
      name: 'Welcome New Customer',
      category: 'welcome',
      text: 'Hi {{first_name}}! Welcome to our store! Enjoy 10% off your first order. Use code WELCOME10 at checkout.',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
    },
    {
      templateKey: 'new_collection_launch',
      name: 'New Collection Launch',
      category: 'promotion',
      text: '{{first_name}}, our new collection is here! Be the first to shop. Limited stock available.',
      goal: 'Promote new products and drive sales',
      suggestedMetrics: 'Product views, conversion rate, average order value',
    },
    {
      templateKey: 'sale_announcement',
      name: 'Sale Announcement',
      category: 'promotion',
      text: 'Hey {{first_name}}! Our sale is on! Get up to 50% off selected items. Shop now before it\'s gone!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
    },
    {
      templateKey: 'abandoned_cart_reminder',
      name: 'Abandoned Cart Reminder',
      category: 'reminder',
      text: 'Hi {{first_name}}, you left items in your cart! Complete your purchase and get free shipping.',
      goal: 'Recover abandoned carts and increase conversions',
      suggestedMetrics: 'Cart recovery rate, conversion rate',
    },
    {
      templateKey: 'loyalty_reward',
      name: 'Loyalty Reward',
      category: 'loyalty',
      text: '{{first_name}}, you\'ve earned rewards! Redeem your points for discounts on your next purchase.',
      goal: 'Encourage repeat purchases and loyalty program engagement',
      suggestedMetrics: 'Repeat purchase rate, loyalty redemption rate',
    },
  ],
  beauty: [
    {
      templateKey: 'welcome_new_customer',
      name: 'Welcome New Customer',
      category: 'welcome',
      text: 'Hi {{first_name}}! Welcome to our beauty store! Get 15% off your first order. Use code BEAUTY15.',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
    },
    {
      templateKey: 'new_product_launch',
      name: 'New Product Launch',
      category: 'promotion',
      text: '{{first_name}}, discover our latest beauty products! Limited time offer - shop now.',
      goal: 'Promote new products and drive sales',
      suggestedMetrics: 'Product views, conversion rate, average order value',
    },
    {
      templateKey: 'skincare_tips',
      name: 'Skincare Tips',
      category: 'engagement',
      text: 'Hi {{first_name}}! Here\'s a skincare tip: Stay hydrated and use SPF daily. Check out our skincare collection!',
      goal: 'Engage customers with valuable content and drive sales',
      suggestedMetrics: 'Engagement rate, product views, conversion rate',
    },
    {
      templateKey: 'restock_notification',
      name: 'Restock Notification',
      category: 'notification',
      text: '{{first_name}}, your favorite product is back in stock! Order now before it sells out again.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
    },
    {
      templateKey: 'birthday_special',
      name: 'Birthday Special',
      category: 'special',
      text: 'Happy Birthday {{first_name}}! Celebrate with 20% off your entire order. Valid this month only!',
      goal: 'Increase customer lifetime value with birthday offers',
      suggestedMetrics: 'Birthday purchase rate, average order value',
    },
  ],
  electronics: [
    {
      templateKey: 'welcome_new_customer',
      name: 'Welcome New Customer',
      category: 'welcome',
      text: 'Hi {{first_name}}! Welcome! Get 10% off your first tech purchase. Use code TECH10.',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
    },
    {
      templateKey: 'new_tech_launch',
      name: 'New Tech Launch',
      category: 'promotion',
      text: '{{first_name}}, the latest tech is here! Pre-order now and get exclusive early access.',
      goal: 'Promote new products and drive pre-orders',
      suggestedMetrics: 'Pre-order rate, product views, conversion rate',
    },
    {
      templateKey: 'warranty_reminder',
      name: 'Warranty Reminder',
      category: 'reminder',
      text: 'Hi {{first_name}}, don\'t forget to register your product warranty! Protect your purchase today.',
      goal: 'Encourage warranty registration and customer retention',
      suggestedMetrics: 'Warranty registration rate, customer satisfaction',
    },
    {
      templateKey: 'accessory_recommendation',
      name: 'Accessory Recommendation',
      category: 'upsell',
      text: '{{first_name}}, complete your setup! Check out our recommended accessories for your device.',
      goal: 'Increase average order value with accessory sales',
      suggestedMetrics: 'Average order value, upsell rate',
    },
    {
      templateKey: 'trade_in_offer',
      name: 'Trade-In Offer',
      category: 'promotion',
      text: 'Hi {{first_name}}, trade in your old device and get credit toward your next purchase!',
      goal: 'Drive new purchases through trade-in program',
      suggestedMetrics: 'Trade-in rate, conversion rate, revenue',
    },
  ],
  food: [
    {
      templateKey: 'welcome_new_customer',
      name: 'Welcome New Customer',
      category: 'welcome',
      text: 'Hi {{first_name}}! Welcome! Enjoy 10% off your first order. Use code FOOD10 at checkout.',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
    },
    {
      templateKey: 'weekly_special',
      name: 'Weekly Special',
      category: 'promotion',
      text: '{{first_name}}, this week\'s special is here! Order now and get free delivery on orders over $50.',
      goal: 'Drive weekly sales and increase order value',
      suggestedMetrics: 'Conversion rate, average order value, revenue',
    },
    {
      templateKey: 'recipe_idea',
      name: 'Recipe Idea',
      category: 'engagement',
      text: 'Hi {{first_name}}! Try this recipe: [Recipe name]. Get all ingredients delivered to your door!',
      goal: 'Engage customers with recipes and drive sales',
      suggestedMetrics: 'Engagement rate, product views, conversion rate',
    },
    {
      templateKey: 'subscription_reminder',
      name: 'Subscription Reminder',
      category: 'reminder',
      text: '{{first_name}}, your subscription is ready! Your favorite items are waiting. Order now.',
      goal: 'Increase subscription retention and revenue',
      suggestedMetrics: 'Subscription retention rate, revenue',
    },
    {
      templateKey: 'fresh_arrival',
      name: 'Fresh Arrival',
      category: 'notification',
      text: 'Hi {{first_name}}, fresh produce just arrived! Order now for same-day delivery.',
      goal: 'Drive sales for fresh products',
      suggestedMetrics: 'Conversion rate, revenue per notification',
    },
  ],
  services: [
    {
      templateKey: 'welcome_new_customer',
      name: 'Welcome New Customer',
      category: 'welcome',
      text: 'Hi {{first_name}}! Welcome! We\'re excited to serve you. Book your first appointment and get 15% off.',
      goal: 'Welcome new customers and encourage first booking',
      suggestedMetrics: 'Conversion rate, first booking rate',
    },
    {
      templateKey: 'appointment_reminder',
      name: 'Appointment Reminder',
      category: 'reminder',
      text: 'Hi {{first_name}}, reminder: Your appointment is tomorrow at [time]. See you then!',
      goal: 'Reduce no-shows and improve service delivery',
      suggestedMetrics: 'Show-up rate, customer satisfaction',
    },
    {
      templateKey: 'service_promotion',
      name: 'Service Promotion',
      category: 'promotion',
      text: '{{first_name}}, special offer this month! Book any service and get 20% off. Limited time only.',
      goal: 'Drive bookings during promotional periods',
      suggestedMetrics: 'Booking rate, revenue, average booking value',
    },
    {
      templateKey: 'follow_up',
      name: 'Follow-Up',
      category: 'engagement',
      text: 'Hi {{first_name}}, how was your experience? We\'d love your feedback! Book again and save 10%.',
      goal: 'Collect feedback and encourage repeat bookings',
      suggestedMetrics: 'Feedback rate, repeat booking rate',
    },
    {
      templateKey: 'loyalty_reward',
      name: 'Loyalty Reward',
      category: 'loyalty',
      text: '{{first_name}}, you\'ve earned rewards! Redeem your points for discounts on your next service.',
      goal: 'Encourage repeat bookings and loyalty program engagement',
      suggestedMetrics: 'Repeat booking rate, loyalty redemption rate',
    },
  ],
  home: [
    {
      templateKey: 'welcome_new_customer',
      name: 'Welcome New Customer',
      category: 'welcome',
      text: 'Hi {{first_name}}! Welcome to our home store! Get 10% off your first order. Use code HOME10.',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
    },
    {
      templateKey: 'seasonal_collection',
      name: 'Seasonal Collection',
      category: 'promotion',
      text: '{{first_name}}, our new seasonal collection is here! Transform your space. Shop now.',
      goal: 'Promote seasonal products and drive sales',
      suggestedMetrics: 'Product views, conversion rate, average order value',
    },
    {
      templateKey: 'sale_announcement',
      name: 'Sale Announcement',
      category: 'promotion',
      text: 'Hey {{first_name}}! Big sale on home essentials! Get up to 40% off. Shop now!',
      goal: 'Drive sales during promotional periods',
      suggestedMetrics: 'Conversion rate, revenue, average order value',
    },
    {
      templateKey: 'restock_notification',
      name: 'Restock Notification',
      category: 'notification',
      text: 'Hi {{first_name}}, your favorite item is back in stock! Order now before it\'s gone.',
      goal: 'Drive sales for restocked items',
      suggestedMetrics: 'Conversion rate, revenue per notification',
    },
    {
      templateKey: 'decorating_tips',
      name: 'Decorating Tips',
      category: 'engagement',
      text: '{{first_name}}, here\'s a decorating tip: Mix textures and colors for a cozy feel. Shop our collection!',
      goal: 'Engage customers with tips and drive sales',
      suggestedMetrics: 'Engagement rate, product views, conversion rate',
    },
  ],
  sports: [
    {
      templateKey: 'welcome_new_customer',
      name: 'Welcome New Customer',
      category: 'welcome',
      text: 'Hi {{first_name}}! Welcome! Get 15% off your first sports gear purchase. Use code SPORTS15.',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
    },
    {
      templateKey: 'new_gear_launch',
      name: 'New Gear Launch',
      category: 'promotion',
      text: '{{first_name}}, the latest sports gear is here! Pre-order now and get exclusive early access.',
      goal: 'Promote new products and drive pre-orders',
      suggestedMetrics: 'Pre-order rate, product views, conversion rate',
    },
    {
      templateKey: 'training_tips',
      name: 'Training Tips',
      category: 'engagement',
      text: 'Hi {{first_name}}! Training tip: Stay consistent and track your progress. Check out our fitness gear!',
      goal: 'Engage customers with tips and drive sales',
      suggestedMetrics: 'Engagement rate, product views, conversion rate',
    },
    {
      templateKey: 'event_announcement',
      name: 'Event Announcement',
      category: 'notification',
      text: '{{first_name}}, join us for our sports event! Get special gear and discounts. Register now!',
      goal: 'Drive event participation and sales',
      suggestedMetrics: 'Event registration rate, conversion rate',
    },
    {
      templateKey: 'loyalty_reward',
      name: 'Loyalty Reward',
      category: 'loyalty',
      text: 'Hi {{first_name}}, you\'ve earned rewards! Redeem your points for discounts on your next purchase.',
      goal: 'Encourage repeat purchases and loyalty program engagement',
      suggestedMetrics: 'Repeat purchase rate, loyalty redemption rate',
    },
  ],
  books: [
    {
      templateKey: 'welcome_new_customer',
      name: 'Welcome New Customer',
      category: 'welcome',
      text: 'Hi {{first_name}}! Welcome to our bookstore! Get 10% off your first order. Use code BOOKS10.',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
    },
    {
      templateKey: 'new_release',
      name: 'New Release',
      category: 'promotion',
      text: '{{first_name}}, new books just arrived! Pre-order now and get free shipping.',
      goal: 'Promote new releases and drive pre-orders',
      suggestedMetrics: 'Pre-order rate, product views, conversion rate',
    },
    {
      templateKey: 'reading_recommendation',
      name: 'Reading Recommendation',
      category: 'engagement',
      text: 'Hi {{first_name}}! Based on your interests, we recommend: [Book title]. Order now!',
      goal: 'Engage customers with recommendations and drive sales',
      suggestedMetrics: 'Engagement rate, product views, conversion rate',
    },
    {
      templateKey: 'author_event',
      name: 'Author Event',
      category: 'notification',
      text: '{{first_name}}, meet the author! Join us for a special event. Get signed copies and discounts.',
      goal: 'Drive event participation and sales',
      suggestedMetrics: 'Event registration rate, conversion rate',
    },
    {
      templateKey: 'subscription_reminder',
      name: 'Subscription Reminder',
      category: 'reminder',
      text: 'Hi {{first_name}}, your book subscription is ready! Your monthly selection is waiting.',
      goal: 'Increase subscription retention and revenue',
      suggestedMetrics: 'Subscription retention rate, revenue',
    },
  ],
  toys: [
    {
      templateKey: 'welcome_new_customer',
      name: 'Welcome New Customer',
      category: 'welcome',
      text: 'Hi {{first_name}}! Welcome! Get 15% off your first toy purchase. Use code TOYS15.',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
    },
    {
      templateKey: 'new_toy_launch',
      name: 'New Toy Launch',
      category: 'promotion',
      text: '{{first_name}}, new toys just arrived! Pre-order now and get free shipping.',
      goal: 'Promote new products and drive pre-orders',
      suggestedMetrics: 'Pre-order rate, product views, conversion rate',
    },
    {
      templateKey: 'age_recommendation',
      name: 'Age Recommendation',
      category: 'engagement',
      text: 'Hi {{first_name}}! Perfect toys for [age]! Check out our age-appropriate selection.',
      goal: 'Engage customers with recommendations and drive sales',
      suggestedMetrics: 'Engagement rate, product views, conversion rate',
    },
    {
      templateKey: 'birthday_special',
      name: 'Birthday Special',
      category: 'special',
      text: 'Happy Birthday {{first_name}}! Celebrate with 20% off your entire order. Valid this month!',
      goal: 'Increase customer lifetime value with birthday offers',
      suggestedMetrics: 'Birthday purchase rate, average order value',
    },
    {
      templateKey: 'educational_toy',
      name: 'Educational Toy',
      category: 'promotion',
      text: '{{first_name}}, learning through play! Check out our educational toys. Shop now!',
      goal: 'Promote educational products and drive sales',
      suggestedMetrics: 'Product views, conversion rate, average order value',
    },
  ],
  generic: [
    {
      templateKey: 'welcome_new_customer',
      name: 'Welcome New Customer',
      category: 'welcome',
      text: 'Hi {{first_name}}! Welcome to our store! Enjoy 10% off your first order. Use code WELCOME10.',
      goal: 'Welcome new customers and encourage first purchase',
      suggestedMetrics: 'Conversion rate, first purchase rate',
    },
    {
      templateKey: 'special_offer',
      name: 'Special Offer',
      category: 'promotion',
      text: '{{first_name}}, enjoy 15% off your next purchase! Use code SAVE15. Valid until end of month.',
      goal: 'Drive sales and visits',
      suggestedMetrics: 'Redemption rate, conversion rate',
    },
    {
      templateKey: 'thank_you',
      name: 'Thank You Message',
      category: 'engagement',
      text: 'Thank you {{first_name}} for your support! We appreciate your business.',
      goal: 'Build customer relationships',
      suggestedMetrics: 'Customer satisfaction, retention rate',
    },
    {
      templateKey: 'newsletter_signup',
      name: 'Newsletter Signup',
      category: 'engagement',
      text: 'Hi {{first_name}}, stay updated with our latest news and offers! Subscribe to our newsletter.',
      goal: 'Increase newsletter subscriptions',
      suggestedMetrics: 'Newsletter subscription rate',
    },
    {
      templateKey: 'feedback_request',
      name: 'Feedback Request',
      category: 'engagement',
      text: '{{first_name}}, we\'d love your feedback! Share your experience with us.',
      goal: 'Collect customer feedback',
      suggestedMetrics: 'Feedback response rate, customer satisfaction',
    },
  ],
};

/**
 * Ensure default templates exist for a shop and eShop type
 * Idempotent function that creates missing templates and repairs existing ones
 * @param {string} shopId - Shop ID
 * @param {string} eshopType - eShop type (fashion, beauty, electronics, etc.)
 * @returns {Promise<{created: number, updated: number, skipped: number, total: number}>}
 */
export async function ensureDefaultTemplates(shopId, eshopType) {
  logger.info('Ensuring default templates', { shopId, eshopType });

  // Validate eshopType
  const validEshopTypes = Object.keys(DEFAULT_TEMPLATES);
  if (!validEshopTypes.includes(eshopType)) {
    throw new Error(`Invalid eshopType: ${eshopType}. Must be one of: ${validEshopTypes.join(', ')}`);
  }

  // Get templates for this eShop type
  const templates = DEFAULT_TEMPLATES[eshopType];
  if (!templates || templates.length === 0) {
    logger.warn('No default templates defined for eshopType', { shopId, eshopType });
    return { created: 0, updated: 0, skipped: 0, total: 0 };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let repaired = 0; // Count templates that were repaired (e.g., language fixed)

  // First, check existing templates for this shop and eShop type
  const existingTemplates = await prisma.template.findMany({
    where: { shopId, eshopType },
    select: {
      id: true,
      templateKey: true,
      name: true,
      text: true,
      language: true,
      eshopType: true,
      goal: true,
      suggestedMetrics: true,
    },
  });

  // Verify and repair existing templates
  for (const existing of existingTemplates) {
    let needsRepair = false;
    const repairData = {};

    // Repair: language must be 'en' (English-only enforcement)
    if (existing.language && existing.language !== 'en') {
      repairData.language = 'en';
      needsRepair = true;
      logger.info('Repairing template: fixing non-English language', {
        shopId,
        eshopType,
        templateKey: existing.templateKey,
        oldLanguage: existing.language,
      });
    }

    // Repair: missing required fields
    if (!existing.name || !existing.text) {
      // Try to find matching default template to repair from
      const defaultTemplate = templates.find(t => t.templateKey === existing.templateKey);
      if (defaultTemplate) {
        if (!existing.name) repairData.name = defaultTemplate.name;
        if (!existing.text) repairData.text = defaultTemplate.text;
        needsRepair = true;
      }
    }

    // Repair: wrong eshopType (should not happen, but check anyway)
    if (existing.eshopType !== eshopType) {
      repairData.eshopType = eshopType;
      needsRepair = true;
      logger.warn('Repairing template: fixing wrong eshopType', {
        shopId,
        templateKey: existing.templateKey,
        oldEshopType: existing.eshopType,
        newEshopType: eshopType,
      });
    }

    // Apply repairs if needed
    if (needsRepair) {
      try {
        await prisma.template.update({
          where: { id: existing.id },
          data: repairData,
        });
        repaired++;
        logger.info('Template repaired', {
          shopId,
          eshopType,
          templateKey: existing.templateKey,
          repairs: Object.keys(repairData),
        });
      } catch (error) {
        logger.error('Failed to repair template', {
          shopId,
          eshopType,
          templateKey: existing.templateKey,
          error: error.message,
        });
        skipped++;
      }
    }
  }

  // Now ensure all default templates exist (create missing ones)
  for (const template of templates) {
    try {
      // Use upsert to ensure template exists (idempotent)
      const result = await prisma.template.upsert({
        where: {
          shopId_eshopType_templateKey: {
            shopId,
            eshopType,
            templateKey: template.templateKey,
          },
        },
        update: {
          // Only update safe fields (text, goal, suggestedMetrics) if template exists
          // Don't overwrite user customizations to name/category
          text: template.text,
          goal: template.goal,
          suggestedMetrics: template.suggestedMetrics,
          language: 'en', // Default to English
          isSystemDefault: true, // Mark as system default
        },
        create: {
          shopId,
          eshopType,
          templateKey: template.templateKey,
          name: template.name,
          title: template.name, // Backward compatibility
          category: template.category,
          text: template.text,
          content: template.text, // Backward compatibility
          goal: template.goal,
          suggestedMetrics: template.suggestedMetrics,
          language: 'en', // English-only (Shopify requirement)
          isSystemDefault: true,
          isPublic: false, // Templates are tenant-scoped, not public
        },
      });

      // Determine if template was created or updated
      // If createdAt === updatedAt, it was just created
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        // Check if any fields were actually updated
        // For simplicity, we'll count as updated if upsert was called
        updated++;
      }
    } catch (error) {
      // Log error but continue with other templates
      logger.error('Error ensuring template', {
        shopId,
        eshopType,
        templateKey: template.templateKey,
        error: error.message,
        stack: error.stack,
      });
      skipped++;
    }
  }

  // Count total templates for this shop and eShop type
  const total = await prisma.template.count({
    where: { shopId, eshopType },
  });

  logger.info('Default templates ensured', {
    shopId,
    eshopType,
    created,
    updated,
    repaired,
    skipped,
    total,
  });

  return { created, updated, repaired, skipped, total };
}

export default {
  listTemplates,
  getTemplateById,
  trackTemplateUsage,
  getTemplateUsageStats,
  getPopularTemplates,
  ensureDefaultTemplates,
};
