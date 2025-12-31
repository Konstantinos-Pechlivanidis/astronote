// apps/api/src/lib/ensureTemplatesSeeded.js
// Idempotent function to ensure system templates are seeded
// Can be called on server startup or first login

const prisma = require('./prisma');

const SYSTEM_USER_ID = Number(process.env.SYSTEM_USER_ID || 1);

const templates = [
  // CAFÉ / COFFEE SHOP (5 templates)
  {
    name: 'Welcome New Customer',
    category: 'cafe',
    goal: 'Welcome new customers and encourage first visit',
    text: 'Hi {{first_name}}! Welcome to our café! Enjoy 10% off your first order. Show this message at checkout. Valid until end of month.',
    suggestedMetrics: 'Conversion rate, first visit rate',
    language: 'en'
  },
  {
    name: 'Happy Hour Promotion',
    category: 'cafe',
    goal: 'Drive foot traffic during off-peak hours',
    text: 'Hey {{first_name}}! Happy Hour is on! 2-for-1 on all drinks from 2-4 PM today. See you soon!',
    suggestedMetrics: 'Visit frequency, redemption rate, off-peak traffic',
    language: 'en'
  },
  {
    name: 'Loyalty Reward Reminder',
    category: 'cafe',
    goal: 'Encourage repeat visits and loyalty program engagement',
    text: 'Hi {{first_name}}, you\'re just 2 visits away from a free coffee! Come in this week to claim your reward.',
    suggestedMetrics: 'Repeat visit rate, loyalty program engagement',
    language: 'en'
  },
  {
    name: 'New Menu Item Launch',
    category: 'cafe',
    goal: 'Promote new products and increase average order value',
    text: '{{first_name}}, we\'ve got something new! Try our seasonal special - ask about it on your next visit. Limited time only!',
    suggestedMetrics: 'Average order value, new product adoption rate',
    language: 'en'
  },
  {
    name: 'Win-back Inactive Customers',
    category: 'cafe',
    goal: 'Re-engage customers who haven\'t visited recently',
    text: 'We miss you, {{first_name}}! Come back and enjoy 15% off your next order. Valid this week only.',
    suggestedMetrics: 'Win-back rate, reactivation rate',
    language: 'en'
  },

  // RESTAURANT / BAR (5 templates)
  {
    name: 'Weekend Special Offer',
    category: 'restaurant',
    goal: 'Increase weekend bookings and revenue',
    text: 'Hi {{first_name}}! This weekend, enjoy 20% off your meal. Book your table now - limited availability!',
    suggestedMetrics: 'Weekend booking rate, revenue per booking',
    language: 'en'
  },
  {
    name: 'Birthday Celebration',
    category: 'restaurant',
    goal: 'Encourage birthday visits and increase customer lifetime value',
    text: 'Happy Birthday {{first_name}}! Celebrate with us and receive a complimentary dessert on your special day. Show this message when you visit!',
    suggestedMetrics: 'Birthday visit rate, average order value',
    language: 'en'
  },
  {
    name: 'New Menu Launch',
    category: 'restaurant',
    goal: 'Promote new menu items and drive visits',
    text: '{{first_name}}, our new menu is here! Try our chef\'s specials this week. Book your table today.',
    suggestedMetrics: 'New menu item adoption, visit frequency',
    language: 'en'
  },
  {
    name: 'Loyalty Program Update',
    category: 'restaurant',
    goal: 'Increase loyalty program engagement',
    text: 'Hi {{first_name}}, you\'ve earned points! Redeem them on your next visit for discounts or free items.',
    suggestedMetrics: 'Loyalty redemption rate, repeat visits',
    language: 'en'
  },
  {
    name: 'Holiday Special',
    category: 'restaurant',
    goal: 'Drive holiday season bookings',
    text: '{{first_name}}, celebrate the holidays with us! Special holiday menu available. Reserve your table now.',
    suggestedMetrics: 'Holiday booking rate, seasonal revenue',
    language: 'en'
  },

  // GYM / FITNESS (5 templates)
  {
    name: 'Welcome New Member',
    category: 'gym',
    goal: 'Welcome new gym members and encourage first visit',
    text: 'Welcome {{first_name}}! Your membership is active. Visit us this week for a free personal training session.',
    suggestedMetrics: 'New member activation rate, first visit rate',
    language: 'en'
  },
  {
    name: 'Class Reminder',
    category: 'gym',
    goal: 'Increase class attendance',
    text: 'Hi {{first_name}}, don\'t forget your class tomorrow at 6 PM! See you there.',
    suggestedMetrics: 'Class attendance rate, member engagement',
    language: 'en'
  },
  {
    name: 'Membership Renewal',
    category: 'gym',
    goal: 'Encourage membership renewals',
    text: '{{first_name}}, your membership expires soon. Renew now and get 1 month free!',
    suggestedMetrics: 'Renewal rate, retention rate',
    language: 'en'
  },
  {
    name: 'New Equipment Announcement',
    category: 'gym',
    goal: 'Drive visits and member engagement',
    text: '{{first_name}}, we\'ve upgraded our facilities! Check out our new equipment. Visit us this week.',
    suggestedMetrics: 'Visit frequency, member satisfaction',
    language: 'en'
  },
  {
    name: 'Personal Training Offer',
    category: 'gym',
    goal: 'Promote personal training services',
    text: 'Hi {{first_name}}, achieve your fitness goals faster! Book a personal training session this month and get 20% off.',
    suggestedMetrics: 'Personal training bookings, revenue per member',
    language: 'en'
  },

  // SPORTS CLUB (5 templates)
  {
    name: 'Match Day Reminder',
    category: 'sports_club',
    goal: 'Increase match attendance',
    text: '{{first_name}}, don\'t miss our match this Saturday! Gates open at 2 PM. See you there!',
    suggestedMetrics: 'Match attendance rate, fan engagement',
    language: 'en'
  },
  {
    name: 'Season Ticket Renewal',
    category: 'sports_club',
    goal: 'Encourage season ticket renewals',
    text: 'Hi {{first_name}}, renew your season ticket now and get exclusive benefits plus priority seating!',
    suggestedMetrics: 'Season ticket renewal rate, revenue',
    language: 'en'
  },
  {
    name: 'Merchandise Promotion',
    category: 'sports_club',
    goal: 'Drive merchandise sales',
    text: '{{first_name}}, new team merchandise is available! Visit our shop or order online. Limited stock!',
    suggestedMetrics: 'Merchandise sales, average order value',
    language: 'en'
  },
  {
    name: 'Youth Program Enrollment',
    category: 'sports_club',
    goal: 'Promote youth programs',
    text: 'Hi {{first_name}}, enroll your child in our youth program! Early registration discount available this month.',
    suggestedMetrics: 'Youth program enrollment, program revenue',
    language: 'en'
  },
  {
    name: 'Event Announcement',
    category: 'sports_club',
    goal: 'Promote special events',
    text: '{{first_name}}, join us for our special event next month! Early bird tickets available now.',
    suggestedMetrics: 'Event attendance, ticket sales',
    language: 'en'
  },

  // GENERIC (5 templates)
  {
    name: 'Welcome Message',
    category: 'generic',
    goal: 'Welcome new customers',
    text: 'Hi {{first_name}}! Welcome to our community. We\'re excited to have you!',
    suggestedMetrics: 'Customer engagement, welcome message open rate',
    language: 'en'
  },
  {
    name: 'Special Offer',
    category: 'generic',
    goal: 'Drive sales and visits',
    text: '{{first_name}}, enjoy 15% off your next purchase! Use code SAVE15. Valid until end of month.',
    suggestedMetrics: 'Redemption rate, conversion rate',
    language: 'en'
  },
  {
    name: 'Thank You Message',
    category: 'generic',
    goal: 'Build customer relationships',
    text: 'Thank you {{first_name}} for your support! We appreciate your business.',
    suggestedMetrics: 'Customer satisfaction, retention rate',
    language: 'en'
  },
  {
    name: 'Newsletter Signup',
    category: 'generic',
    goal: 'Increase newsletter subscriptions',
    text: 'Hi {{first_name}}, stay updated with our latest news and offers! Subscribe to our newsletter.',
    suggestedMetrics: 'Newsletter subscription rate',
    language: 'en'
  },
  {
    name: 'Feedback Request',
    category: 'generic',
    goal: 'Collect customer feedback',
    text: '{{first_name}}, we\'d love your feedback! Share your experience with us.',
    suggestedMetrics: 'Feedback response rate, customer satisfaction',
    language: 'en'
  },

  // HOTELS (5 templates)
  {
    name: 'Booking Confirmation',
    category: 'hotels',
    goal: 'Confirm bookings and reduce no-shows',
    text: 'Hi {{first_name}}, your booking is confirmed! Check-in: {{check_in_date}}. We look forward to hosting you.',
    suggestedMetrics: 'Booking confirmation rate, no-show rate',
    language: 'en'
  },
  {
    name: 'Check-in Reminder',
    category: 'hotels',
    goal: 'Reduce no-shows and improve guest experience',
    text: '{{first_name}}, reminder: Your check-in is tomorrow. We\'re preparing everything for your stay!',
    suggestedMetrics: 'Check-in rate, guest satisfaction',
    language: 'en'
  },
  {
    name: 'Special Package Offer',
    category: 'hotels',
    goal: 'Increase bookings and revenue',
    text: 'Hi {{first_name}}, book our special package this month and get a free upgrade! Limited availability.',
    suggestedMetrics: 'Package booking rate, revenue per booking',
    language: 'en'
  },
  {
    name: 'Loyalty Program Benefits',
    category: 'hotels',
    goal: 'Encourage loyalty program enrollment',
    text: '{{first_name}}, join our loyalty program and earn points on every stay! Exclusive benefits await.',
    suggestedMetrics: 'Loyalty enrollment rate, repeat bookings',
    language: 'en'
  },
  {
    name: 'Post-Stay Follow-up',
    category: 'hotels',
    goal: 'Collect feedback and encourage return visits',
    text: 'Thank you {{first_name}} for staying with us! We\'d love your feedback. Book again and get 10% off!',
    suggestedMetrics: 'Feedback rate, return booking rate',
    language: 'en'
  }
];

/**
 * Idempotent function to ensure system templates are seeded
 * Checks if templates exist, inserts only missing ones
 * @returns {Promise<{created: number, updated: number, total: number}>}
 */
async function ensureTemplatesSeeded() {
  try {
    // Verify system user exists
    const systemUser = await prisma.user.findUnique({
      where: { id: SYSTEM_USER_ID }
    });

    if (!systemUser) {
      const logger = require('pino')({ name: 'ensureTemplatesSeeded' });
      logger.warn({ systemUserId: SYSTEM_USER_ID }, 'System user not found, skipping template seed');
      return { created: 0, updated: 0, total: 0, skipped: true };
    }

    let created = 0;
    let updated = 0;

    for (const template of templates) {
      const result = await prisma.messageTemplate.upsert({
        where: {
          ownerId_name: {
            ownerId: SYSTEM_USER_ID,
            name: template.name
          }
        },
        update: {
          text: template.text,
          category: template.category,
          goal: template.goal,
          suggestedMetrics: template.suggestedMetrics,
          language: template.language || 'en'
        },
        create: {
          ownerId: SYSTEM_USER_ID,
          name: template.name,
          text: template.text,
          category: template.category,
          goal: template.goal,
          suggestedMetrics: template.suggestedMetrics,
          language: template.language || 'en'
        }
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    }

    // Count total templates for logging
    const total = await prisma.messageTemplate.count({
      where: { ownerId: SYSTEM_USER_ID, language: 'en' }
    });

    const logger = require('pino')({ name: 'ensureTemplatesSeeded' });
    if (process.env.NODE_ENV !== 'production') {
      logger.info({ 
        created, 
        updated, 
        total,
        systemUserId: SYSTEM_USER_ID 
      }, 'Templates seeding completed');
    }

    return { created, updated, total };
  } catch (error) {
    const logger = require('pino')({ name: 'ensureTemplatesSeeded' });
    logger.error({ err: error }, 'Error ensuring templates are seeded');
    // Don't throw - allow server to start even if seeding fails
    return { created: 0, updated: 0, total: 0, error: error.message };
  }
}

/**
 * Check template count (dev-only logging)
 * @returns {Promise<number>}
 */
async function checkTemplateCount() {
  try {
    const count = await prisma.messageTemplate.count({
      where: { ownerId: SYSTEM_USER_ID, language: 'en' }
    });
    
    if (process.env.NODE_ENV !== 'production') {
      const logger = require('pino')({ name: 'ensureTemplatesSeeded' });
      logger.info({ count, systemUserId: SYSTEM_USER_ID }, 'Template count check');
    }
    
    return count;
  } catch (error) {
    const logger = require('pino')({ name: 'ensureTemplatesSeeded' });
    logger.error({ err: error }, 'Error checking template count');
    return 0;
  }
}

module.exports = {
  ensureTemplatesSeeded,
  checkTemplateCount
};

