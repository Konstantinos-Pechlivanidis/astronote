import prisma from '../services/prisma.js';
import { logger } from '../utils/logger.js';
import { getAllStoreTypeTemplates, getStoreTypeCategories } from '../services/store-type-templates.js';

/**
 * Seed Store-Type Global Templates
 *
 * Creates global templates (shopId = NULL, isPublic = true) organized by store-type categories.
 * These templates are visible to ALL shops immediately after signup.
 *
 * Usage:
 *   node apps/shopify-api/scripts/seed-store-type-templates.js
 *
 * Environment:
 *   DATABASE_URL - Database connection string (from apps/shopify-api/.env)
 */

async function seedStoreTypeTemplates() {
  try {
    logger.info('Starting store-type template seeding...');

    const allTemplates = getAllStoreTypeTemplates();
    const categories = getStoreTypeCategories();

    logger.info('Template library loaded', {
      totalCategories: categories.length,
      totalTemplates: allTemplates.length,
    });

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const resultsByCategory = {};

    // Process each category
    for (const categoryName of categories) {
      const categoryTemplates = allTemplates.filter(t => t.category === categoryName);

      if (categoryTemplates.length === 0) {
        logger.warn(`No templates found for category: ${categoryName}`);
        continue;
      }

      logger.info(`Seeding templates for category: ${categoryName}`, {
        templateCount: categoryTemplates.length,
      });

      let created = 0;
      let updated = 0;
      let skipped = 0;

      // Determine eshopType for this category (use first mapping or 'generic')
      let eshopType = 'generic';
      if (categoryName === 'Fashion & Apparel' || categoryName === 'Jewelry & Accessories') {
        eshopType = 'fashion';
      } else if (categoryName === 'Beauty & Cosmetics') {
        eshopType = 'beauty';
      } else if (categoryName === 'Electronics & Gadgets') {
        eshopType = 'electronics';
      } else if (categoryName === 'Home & Living') {
        eshopType = 'home';
      } else if (categoryName === 'Health & Wellness') {
        eshopType = 'services';
      } else if (categoryName === 'Food & Beverage') {
        eshopType = 'food';
      } else if (categoryName === 'Sports & Fitness') {
        eshopType = 'sports';
      } else if (categoryName === 'Baby & Kids') {
        eshopType = 'toys';
      }

      for (const template of categoryTemplates) {
        try {
          // Check if template already exists (global template with same templateKey)
          const existing = await prisma.template.findFirst({
            where: {
              shopId: null,
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
                category: template.category, // Store-type category name
                name: template.name,
                title: template.name, // Backward compatibility
                text: template.text,
                content: template.text, // Backward compatibility
                goal: template.goal,
                suggestedMetrics: template.suggestedMetrics,
                tags: template.tags || [],
                language: 'en',
                eshopType,
                isPublic: true,
                isSystemDefault: true,
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
                category: template.category, // Store-type category name
                name: template.name,
                title: template.name, // Backward compatibility
                text: template.text,
                content: template.text, // Backward compatibility
                goal: template.goal,
                suggestedMetrics: template.suggestedMetrics,
                tags: template.tags || [],
                language: 'en',
                isPublic: true, // Global templates are public
                isSystemDefault: true,
              },
            });
            created++;
            totalCreated++;
          }
        } catch (error) {
          logger.error('Error ensuring store-type template', {
            category: categoryName,
            templateKey: template.templateKey,
            error: error.message,
            stack: error.stack,
          });
          skipped++;
          totalSkipped++;
        }
      }

      resultsByCategory[categoryName] = {
        created,
        updated,
        skipped,
        total: categoryTemplates.length,
      };

      console.log(`✅ ${categoryName}: ${created} created, ${updated} updated, ${skipped} skipped`);
    }

    // Count total global templates
    const totalGlobalTemplates = await prisma.template.count({
      where: {
        shopId: null,
        isPublic: true,
      },
    });

    // Count templates per category
    const categoryCounts = {};
    for (const categoryName of categories) {
      const count = await prisma.template.count({
        where: {
          shopId: null,
          isPublic: true,
          category: categoryName,
        },
      });
      categoryCounts[categoryName] = count;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('STORE-TYPE TEMPLATES SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total categories: ${categories.length}`);
    console.log(`Templates created: ${totalCreated}`);
    console.log(`Templates updated: ${totalUpdated}`);
    console.log(`Templates skipped (errors): ${totalSkipped}`);
    console.log(`Total global templates in database: ${totalGlobalTemplates}`);
    console.log('\nTemplates per category:');
    for (const [category, count] of Object.entries(categoryCounts)) {
      console.log(`  ${category}: ${count} templates`);
    }
    console.log('='.repeat(60));

    logger.info('Store-type template seeding completed', {
      totalCreated,
      totalUpdated,
      totalSkipped,
      totalGlobalTemplates,
      categoryCounts,
      resultsByCategory,
    });

    return {
      totalCreated,
      totalUpdated,
      totalSkipped,
      totalGlobalTemplates,
      categoryCounts,
      resultsByCategory,
    };
  } catch (error) {
    logger.error('Error seeding store-type templates', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
// Simple check: if this file is being executed (not imported)
const isMainModule = process.argv[1] && process.argv[1].includes('seed-store-type-templates.js');
if (isMainModule) {
  seedStoreTypeTemplates()
    .then((result) => {
      if (result.totalSkipped > 0) {
        console.error(`\n⚠️  Completed with ${result.totalSkipped} error(s)`);
        process.exit(1);
      } else {
        console.log('\n✅ Store-type template seeding completed successfully!');
        console.log(`   All ${result.totalGlobalTemplates} global templates are now visible to all shops.`);
        console.log(`   Categories: ${Object.keys(result.categoryCounts).length}`);
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('❌ Error seeding store-type templates:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    });
}

export default seedStoreTypeTemplates;

