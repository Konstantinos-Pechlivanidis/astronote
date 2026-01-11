import prisma from '../services/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Fix Template Unique Constraint
 * 
 * This script applies the unique constraint required for template seeding.
 * It's safe to run multiple times (idempotent).
 * 
 * Usage:
 *   node apps/shopify-api/scripts/fix-template-unique-constraint.js
 */

async function fixTemplateUniqueConstraint() {
  try {
    logger.info('Fixing Template unique constraint...');

    // Step 1: Check for duplicates
    const duplicates = await prisma.$queryRaw`
      SELECT "shopId", "eshopType", "templateKey", COUNT(*) as cnt
      FROM "Template"
      WHERE "shopId" IS NOT NULL 
        AND "eshopType" IS NOT NULL 
        AND "templateKey" IS NOT NULL
      GROUP BY "shopId", "eshopType", "templateKey"
      HAVING COUNT(*) > 1
    `;

    if (duplicates && duplicates.length > 0) {
      logger.warn('Found duplicate templates', { count: duplicates.length });
      console.log('⚠️  Found duplicate templates. Please resolve them first:');
      console.log(JSON.stringify(duplicates, null, 2));
      throw new Error(`Found ${duplicates.length} duplicate template combinations. Please resolve duplicates before applying constraint.`);
    }

    // Step 2: Drop the partial unique index if it exists
    await prisma.$executeRaw`
      DROP INDEX IF EXISTS "Template_shopId_eshopType_templateKey_key"
    `;
    logger.info('Dropped partial unique index (if it existed)');

    // Step 3: Ensure NULL values are handled
    await prisma.$executeRaw`
      UPDATE "Template" 
      SET "eshopType" = 'generic' 
      WHERE "eshopType" IS NULL AND "shopId" IS NOT NULL
    `;

    await prisma.$executeRaw`
      UPDATE "Template" 
      SET "templateKey" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE("name", "title", 'template_' || "id"), '[^a-zA-Z0-9]+', '_', 'g'), '^_|_$', '', 'g'))
      WHERE "templateKey" IS NULL AND "shopId" IS NOT NULL
    `;

    // Step 4: Create the unique constraint
    // Check if constraint already exists
    const constraintExists = await prisma.$queryRaw`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'Template_shopId_eshopType_templateKey_key'
    `;

    if (!constraintExists || constraintExists.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE "Template" 
        ADD CONSTRAINT "Template_shopId_eshopType_templateKey_key" 
        UNIQUE ("shopId", "eshopType", "templateKey")
      `;
      logger.info('Created unique constraint Template_shopId_eshopType_templateKey_key');
      console.log('✅ Unique constraint created successfully');
    } else {
      logger.info('Unique constraint already exists');
      console.log('✅ Unique constraint already exists');
    }

    // Step 5: Verify the constraint
    const verify = await prisma.$queryRaw`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conname = 'Template_shopId_eshopType_templateKey_key'
    `;

    if (!verify || verify.length === 0) {
      throw new Error('Failed to verify unique constraint was created');
    }

    logger.info('Template unique constraint fixed successfully');
    console.log('✅ Template unique constraint is ready');
    console.log('   You can now run the seed script:');
    console.log('   node apps/shopify-api/scripts/seed-templates-for-all-shops.js');

  } catch (error) {
    logger.error('Error fixing template unique constraint', {
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
  fixTemplateUniqueConstraint()
    .then(() => {
      console.log('✅ Fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error fixing constraint:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    });
}

export default fixTemplateUniqueConstraint;

