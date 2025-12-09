import prisma from '../services/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Seed professional SMS templates with statistics
 * Templates support: {{first_name}}, {{last_name}}, {{discount_code}}
 */

const templates = [
  // Welcome & Onboarding Templates
  {
    title: 'Welcome New Customer',
    category: 'Welcome',
    content: 'Hi {{first_name}}! Welcome to our store. Use code {{discount_code}} for 10% off your first order. Shop now!',
    tags: ['welcome', 'new-customer', 'discount'],
    conversionRate: 28.5,
    productViewsIncrease: 42.0,
    clickThroughRate: 18.3,
    averageOrderValue: 15.2,
    customerRetention: 35.0,
  },
  {
    title: 'First Purchase Thank You',
    category: 'Welcome',
    content: 'Thank you {{first_name}} {{last_name}} for your first purchase! Here\'s {{discount_code}} for 15% off your next order. Valid for 30 days.',
    tags: ['thank-you', 'loyalty', 'discount'],
    conversionRate: 32.0,
    productViewsIncrease: 38.5,
    clickThroughRate: 22.1,
    averageOrderValue: 18.7,
    customerRetention: 28.5,
  },

  // Abandoned Cart Templates
  {
    title: 'Abandoned Cart Reminder',
    category: 'Abandoned Cart',
    content: 'Hi {{first_name}}, you left items in your cart! Complete your purchase with code {{discount_code}} for 10% off. Offer expires in 24h.',
    tags: ['abandoned-cart', 'recovery', 'discount'],
    conversionRate: 33.0,
    productViewsIncrease: 55.0,
    clickThroughRate: 25.4,
    averageOrderValue: 22.3,
    customerRetention: 20.0,
  },
  {
    title: 'Urgent Cart Reminder',
    category: 'Abandoned Cart',
    content: '{{first_name}}, your cart is waiting! Use {{discount_code}} for 15% off. Limited time offer - shop now!',
    tags: ['abandoned-cart', 'urgent', 'discount'],
    conversionRate: 35.5,
    productViewsIncrease: 48.2,
    clickThroughRate: 28.7,
    averageOrderValue: 19.5,
    customerRetention: 22.0,
  },

  // Promotional Templates
  {
    title: 'Flash Sale Alert',
    category: 'Promotional',
    content: 'Flash Sale! {{first_name}}, get 20% off with code {{discount_code}}. Limited stock - ends today!',
    tags: ['sale', 'flash', 'discount'],
    conversionRate: 40.2,
    productViewsIncrease: 62.5,
    clickThroughRate: 32.8,
    averageOrderValue: 28.4,
    customerRetention: 15.0,
  },
  {
    title: 'New Arrivals Notification',
    category: 'Promotional',
    content: '{{first_name}} {{last_name}}, check out our new arrivals! Use {{discount_code}} for 10% off new items.',
    tags: ['new-arrivals', 'product-launch', 'discount'],
    conversionRate: 26.8,
    productViewsIncrease: 45.3,
    clickThroughRate: 19.6,
    averageOrderValue: 16.9,
    customerRetention: 30.0,
  },
  {
    title: 'Weekend Special Offer',
    category: 'Promotional',
    content: 'Weekend special for {{first_name}}! Use {{discount_code}} for 15% off all weekend. Shop now!',
    tags: ['weekend', 'special', 'discount'],
    conversionRate: 29.3,
    productViewsIncrease: 40.1,
    clickThroughRate: 21.2,
    averageOrderValue: 17.8,
    customerRetention: 25.0,
  },

  // Loyalty & Retention Templates
  {
    title: 'Loyalty Reward',
    category: 'Loyalty',
    content: 'Hi {{first_name}}, you\'ve earned a reward! Use code {{discount_code}} for 20% off as a thank you for being a valued customer.',
    tags: ['loyalty', 'reward', 'discount'],
    conversionRate: 38.7,
    productViewsIncrease: 35.2,
    clickThroughRate: 24.5,
    averageOrderValue: 31.6,
    customerRetention: 45.0,
  },
  {
    title: 'Win-Back Inactive Customer',
    category: 'Retention',
    content: 'We miss you {{first_name}}! Come back with {{discount_code}} for 25% off your next order. Valid for 7 days.',
    tags: ['win-back', 'retention', 'discount'],
    conversionRate: 22.4,
    productViewsIncrease: 30.8,
    clickThroughRate: 15.3,
    averageOrderValue: 14.2,
    customerRetention: 18.0,
  },
  {
    title: 'Birthday Special',
    category: 'Loyalty',
    content: 'Happy Birthday {{first_name}}! Enjoy {{discount_code}} for 20% off as our gift to you. Valid this month!',
    tags: ['birthday', 'special', 'discount'],
    conversionRate: 36.9,
    productViewsIncrease: 33.5,
    clickThroughRate: 27.1,
    averageOrderValue: 26.3,
    customerRetention: 40.0,
  },

  // Seasonal Templates
  {
    title: 'Holiday Sale',
    category: 'Seasonal',
    content: '{{first_name}}, holiday sale is here! Use {{discount_code}} for 30% off. Shop now before it\'s too late!',
    tags: ['holiday', 'sale', 'discount'],
    conversionRate: 42.5,
    productViewsIncrease: 68.0,
    clickThroughRate: 35.2,
    averageOrderValue: 34.7,
    customerRetention: 20.0,
  },
  {
    title: 'End of Season Clearance',
    category: 'Seasonal',
    content: 'Hi {{first_name}} {{last_name}}, end of season sale! Get {{discount_code}} for 25% off clearance items. Limited time!',
    tags: ['clearance', 'sale', 'discount'],
    conversionRate: 31.2,
    productViewsIncrease: 52.4,
    clickThroughRate: 23.8,
    averageOrderValue: 20.1,
    customerRetention: 22.0,
  },

  // Product-Specific Templates
  {
    title: 'Back in Stock Alert',
    category: 'Product',
    content: '{{first_name}}, it\'s back! Your favorite item is back in stock. Use {{discount_code}} for 10% off.',
    tags: ['back-in-stock', 'product', 'discount'],
    conversionRate: 27.6,
    productViewsIncrease: 41.3,
    clickThroughRate: 20.4,
    averageOrderValue: 19.8,
    customerRetention: 32.0,
  },
  {
    title: 'Price Drop Alert',
    category: 'Product',
    content: '{{first_name}}, prices dropped! Plus use {{discount_code}} for an extra 15% off. Shop the deals now!',
    tags: ['price-drop', 'sale', 'discount'],
    conversionRate: 34.1,
    productViewsIncrease: 58.7,
    clickThroughRate: 26.3,
    averageOrderValue: 24.5,
    customerRetention: 26.0,
  },

  // Event & Announcement Templates
  {
    title: 'Event Invitation',
    category: 'Events',
    content: '{{first_name}}, you\'re invited! Join our exclusive event. Use {{discount_code}} for special event pricing.',
    tags: ['event', 'invitation', 'discount'],
    conversionRate: 24.8,
    productViewsIncrease: 36.2,
    clickThroughRate: 17.9,
    averageOrderValue: 15.4,
    customerRetention: 28.0,
  },
  {
    title: 'Limited Edition Launch',
    category: 'Product',
    content: '{{first_name}} {{last_name}}, limited edition just launched! Get {{discount_code}} for 10% off. Only 100 available!',
    tags: ['limited-edition', 'launch', 'discount'],
    conversionRate: 39.4,
    productViewsIncrease: 64.8,
    clickThroughRate: 30.6,
    averageOrderValue: 29.2,
    customerRetention: 35.0,
  },

  // Re-engagement Templates
  {
    title: 'We Haven\'t Seen You',
    category: 'Retention',
    content: 'Hi {{first_name}}, we haven\'t seen you in a while! Use {{discount_code}} for 20% off to come back.',
    tags: ['re-engagement', 'retention', 'discount'],
    conversionRate: 21.7,
    productViewsIncrease: 28.5,
    clickThroughRate: 14.2,
    averageOrderValue: 13.6,
    customerRetention: 16.0,
  },
  {
    title: 'Special Offer for You',
    category: 'Retention',
    content: '{{first_name}}, we have a special offer just for you! Use {{discount_code}} for 15% off. Don\'t miss out!',
    tags: ['personalized', 'special', 'discount'],
    conversionRate: 30.5,
    productViewsIncrease: 43.7,
    clickThroughRate: 22.8,
    averageOrderValue: 18.3,
    customerRetention: 24.0,
  },
];

async function seedTemplates() {
  try {
    logger.info('Starting template seeding...');

    // Delete all existing templates
    const deleteCount = await prisma.template.deleteMany({});
    logger.info(`Deleted ${deleteCount.count} existing templates`);

    // Create new templates
    const createdTemplates = await prisma.template.createMany({
      data: templates.map(t => ({
        ...t,
        isPublic: true,
        isSystemDefault: true,
      })),
    });

    logger.info(`Created ${createdTemplates.count} new templates`);

    // Verify templates were created
    const count = await prisma.template.count();
    logger.info(`Total templates in database: ${count}`);

    logger.info('Template seeding completed successfully!');
  } catch (error) {
    logger.error('Error seeding templates:', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTemplates()
    .then(() => {
      console.log('✅ Templates seeded successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error seeding templates:', error);
      process.exit(1);
    });
}

export default seedTemplates;

