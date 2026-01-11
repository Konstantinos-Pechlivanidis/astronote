import prisma from '../services/prisma.js';
import { logger } from '../utils/logger.js';
import { ensureDefaultTemplates } from '../services/templates.js';

/**
 * Seed templates for all shops in the database
 * 
 * This script seeds default templates for all shops that don't have templates yet.
 * It's idempotent and safe to run multiple times.
 * 
 * Usage:
 *   node apps/shopify-api/scripts/seed-templates-for-all-shops.js
 * 
 * Environment:
 *   DATABASE_URL - Database connection string (from .env)
 */

async function seedTemplatesForAllShops() {
  try {
    logger.info('Starting template seeding for all shops...');

    // Get all shops
    const shops = await prisma.shop.findMany({
      select: {
        id: true,
        shopDomain: true,
        eshopType: true,
      },
    });

    if (shops.length === 0) {
      logger.warn('No shops found in database');
      console.log('⚠️  No shops found in database. Please create a shop first.');
      return { total: 0, seeded: 0, skipped: 0, errors: 0 };
    }

    logger.info(`Found ${shops.length} shop(s) to process`);

    let seeded = 0;
    let skipped = 0;
    let errors = 0;
    const results = [];

    // Process each shop
    for (const shop of shops) {
      try {
        // Use shop's eshopType or default to 'generic'
        const eshopType = shop.eshopType || 'generic';

        logger.info(`Seeding templates for shop`, {
          shopId: shop.id,
          shopDomain: shop.shopDomain,
          eshopType,
        });

        const result = await ensureDefaultTemplates(shop.id, eshopType);

        results.push({
          shopId: shop.id,
          shopDomain: shop.shopDomain,
          eshopType,
          ...result,
        });

        if (result.created > 0 || result.updated > 0) {
          seeded++;
          console.log(`✅ Shop ${shop.shopDomain || shop.id}: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
        } else {
          skipped++;
          console.log(`⏭️  Shop ${shop.shopDomain || shop.id}: Already seeded (${result.total} templates)`);
        }
      } catch (error) {
        errors++;
        logger.error('Error seeding templates for shop', {
          shopId: shop.id,
          shopDomain: shop.shopDomain,
          error: error.message,
          stack: error.stack,
        });
        console.error(`❌ Shop ${shop.shopDomain || shop.id}: ${error.message}`);
      }
    }

    // Summary
    const totalTemplates = results.reduce((sum, r) => sum + r.total, 0);
    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);

    console.log('\n' + '='.repeat(60));
    console.log('SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total shops processed: ${shops.length}`);
    console.log(`Shops seeded: ${seeded}`);
    console.log(`Shops skipped (already seeded): ${skipped}`);
    console.log(`Shops with errors: ${errors}`);
    console.log(`Total templates across all shops: ${totalTemplates}`);
    console.log(`Templates created: ${totalCreated}`);
    console.log(`Templates updated: ${totalUpdated}`);
    console.log('='.repeat(60));

    logger.info('Template seeding completed', {
      totalShops: shops.length,
      seeded,
      skipped,
      errors,
      totalTemplates,
    });

    return {
      total: shops.length,
      seeded,
      skipped,
      errors,
      totalTemplates,
      results,
    };
  } catch (error) {
    logger.error('Error seeding templates for all shops', {
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
  seedTemplatesForAllShops()
    .then((result) => {
      if (result.errors > 0) {
        console.error(`\n⚠️  Completed with ${result.errors} error(s)`);
        process.exit(1);
      } else {
        console.log('\n✅ Template seeding completed successfully!');
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('❌ Error seeding templates:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    });
}

export default seedTemplatesForAllShops;

