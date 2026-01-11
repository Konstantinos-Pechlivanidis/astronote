import prisma from '../services/prisma.js';
import { logger } from '../utils/logger.js';
// Import DEFAULT_TEMPLATES - it's exported from services/templates.js
import { DEFAULT_TEMPLATES } from '../services/templates.js';

/**
 * Seed Global/Public Templates
 * 
 * Creates global templates (shopId = NULL, isPublic = true) that are visible to ALL shops.
 * These templates are seeded once and shared across all shops.
 * 
 * Usage:
 *   node apps/shopify-api/scripts/seed-global-templates.js
 * 
 * Environment:
 *   DATABASE_URL - Database connection string (from apps/shopify-api/.env)
 */

async function seedGlobalTemplates() {
  try {
    logger.info('Starting global template seeding...');

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const results = [];

    // Process each eShop type
    for (const [eshopType, templates] of Object.entries(DEFAULT_TEMPLATES)) {
      logger.info(`Seeding global templates for eShop type: ${eshopType}`, {
        templateCount: templates.length,
      });

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const template of templates) {
        try {
          // For global templates, we can't use upsert with NULL shopId in the unique constraint
          // Instead, use findFirst + create/update pattern
          const existing = await prisma.template.findFirst({
            where: {
              shopId: null,
              eshopType,
              templateKey: template.templateKey,
              isPublic: true,
            },
          });

          let result;
          if (existing) {
            // Update existing global template
            result = await prisma.template.update({
              where: { id: existing.id },
              data: {
                text: template.text,
                goal: template.goal,
                suggestedMetrics: template.suggestedMetrics,
                language: 'en',
                isPublic: true,
                isSystemDefault: true,
                name: template.name,
                category: template.category,
              },
            });
            updated++;
            totalUpdated++;
          } else {
            // Create new global template
            result = await prisma.template.create({
              data: {
                shopId: null, // NULL for global templates
                eshopType,
                templateKey: template.templateKey,
                name: template.name,
                title: template.name,
                category: template.category,
                text: template.text,
                content: template.text,
                goal: template.goal,
                suggestedMetrics: template.suggestedMetrics,
                language: 'en',
                isPublic: true,
                isSystemDefault: true,
              },
            });
            created++;
            totalCreated++;
          }
        } catch (error) {
          // Log error but continue with other templates
          logger.error('Error ensuring global template', {
            eshopType,
            templateKey: template.templateKey,
            error: error.message,
            stack: error.stack,
          });
          skipped++;
          totalSkipped++;
        }
      }

      results.push({
        eshopType,
        created,
        updated,
        skipped,
        total: templates.length,
      });

      console.log(`✅ ${eshopType}: ${created} created, ${updated} updated, ${skipped} skipped`);
    }

    // Count total global templates
    const totalGlobalTemplates = await prisma.template.count({
      where: {
        shopId: null,
        isPublic: true,
      },
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('GLOBAL TEMPLATES SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total eShop types processed: ${Object.keys(DEFAULT_TEMPLATES).length}`);
    console.log(`Templates created: ${totalCreated}`);
    console.log(`Templates updated: ${totalUpdated}`);
    console.log(`Templates skipped (errors): ${totalSkipped}`);
    console.log(`Total global templates in database: ${totalGlobalTemplates}`);
    console.log('='.repeat(60));

    logger.info('Global template seeding completed', {
      totalCreated,
      totalUpdated,
      totalSkipped,
      totalGlobalTemplates,
      results,
    });

    return {
      totalCreated,
      totalUpdated,
      totalSkipped,
      totalGlobalTemplates,
      results,
    };
  } catch (error) {
    logger.error('Error seeding global templates', {
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
  seedGlobalTemplates()
    .then((result) => {
      if (result.totalSkipped > 0) {
        console.error(`\n⚠️  Completed with ${result.totalSkipped} error(s)`);
        process.exit(1);
      } else {
        console.log('\n✅ Global template seeding completed successfully!');
        console.log(`   All ${result.totalGlobalTemplates} global templates are now visible to all shops.`);
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('❌ Error seeding global templates:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    });
}

export default seedGlobalTemplates;

