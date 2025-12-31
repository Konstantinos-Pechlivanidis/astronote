// apps/api/scripts/seed-templates-final-idempotent.js
// Idempotent seed script for system templates from seed-templates-final
// Uses upsert to avoid duplicates - safe to run multiple times
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const SYSTEM_USER_ID = Number(process.env.SYSTEM_USER_ID || 1);

// Import template definitions from extracted data file
const { templateDefinitions } = require('./seed-templates-final-data');

/**
 * Idempotent seeding function
 * Uses upsert to create or update templates based on unique key: ownerId + name
 * Safe to run multiple times - will not create duplicates
 */
async function seedTemplatesIdempotent() {
  console.log('Seeding system templates (idempotent - safe to run multiple times)...');

  try {
    // Verify system user exists, or create it if it doesn't
    let systemUser = await prisma.user.findUnique({
      where: { id: SYSTEM_USER_ID }
    });

    if (!systemUser) {
      console.log(`⚠️  System user with ID ${SYSTEM_USER_ID} not found.`);
      console.log(`   Attempting to find any existing user to use as system user...`);
      
      // Try to find any existing user
      const anyUser = await prisma.user.findFirst({
        orderBy: { id: 'asc' }
      });
      
      if (anyUser) {
        console.log(`   Found user ID ${anyUser.id} (${anyUser.email}). Using this as system user.`);
        console.log(`   Note: Templates will be owned by user ID ${anyUser.id}, not ${SYSTEM_USER_ID}.`);
        console.log(`   To use a specific system user, create one with ID ${SYSTEM_USER_ID} or set SYSTEM_USER_ID env var.`);
        systemUser = anyUser;
        // Update SYSTEM_USER_ID to use the found user
        const actualSystemUserId = anyUser.id;
        // We'll use actualSystemUserId below instead of SYSTEM_USER_ID
        Object.defineProperty(module.exports, 'SYSTEM_USER_ID', { value: actualSystemUserId, writable: false });
      } else {
        console.log(`   No users found in database. Creating system user...`);
        try {
          const passwordHash = await bcrypt.hash('system_user_no_login_' + Date.now(), 10);
          systemUser = await prisma.user.create({
            data: {
              id: SYSTEM_USER_ID,
              email: `system@astronote.local`,
              passwordHash: passwordHash,
            }
          });
          console.log(`✅ Created system user with ID ${SYSTEM_USER_ID}`);
        } catch (createError) {
          console.error(`❌ Failed to create system user: ${createError.message}`);
          console.error(`   Please create a user in the database first, or ensure a user with ID ${SYSTEM_USER_ID} exists.`);
          process.exit(1);
        }
      }
    } else {
      console.log(`✅ System user found: ${systemUser.email || `ID ${SYSTEM_USER_ID}`}`);
    }
    
    // Use the actual system user ID (might be different if we found an existing user)
    const actualSystemUserId = systemUser.id;

    let createdEn = 0;
    let updatedEn = 0;
    let createdGr = 0;
    let updatedGr = 0;

    // Count existing templates before seeding
    const countBefore = await prisma.messageTemplate.count({
      where: { ownerId: actualSystemUserId }
    });

    for (const templateDef of templateDefinitions) {
      const { name, category, conversionRate, productViewsIncrease, clickThroughRate, averageOrderValue, customerRetention, en, gr } = templateDef;

      // Upsert English version
      const resultEn = await prisma.messageTemplate.upsert({
        where: {
          ownerId_name: {
            ownerId: actualSystemUserId,
            name: `${name} (EN)`
          }
        },
        update: {
          text: en.text,
          category: category,
          goal: en.goal,
          suggestedMetrics: en.suggestedMetrics,
          language: 'en',
          conversionRate: conversionRate,
          productViewsIncrease: productViewsIncrease,
          clickThroughRate: clickThroughRate,
          averageOrderValue: averageOrderValue,
          customerRetention: customerRetention,
        },
        create: {
          ownerId: actualSystemUserId,
          name: `${name} (EN)`,
          text: en.text,
          category: category,
          goal: en.goal,
          suggestedMetrics: en.suggestedMetrics,
          language: 'en',
          conversionRate: conversionRate,
          productViewsIncrease: productViewsIncrease,
          clickThroughRate: clickThroughRate,
          averageOrderValue: averageOrderValue,
          customerRetention: customerRetention,
        }
      });

      // Check if it was created or updated
      if (resultEn.createdAt.getTime() === resultEn.updatedAt.getTime()) {
        createdEn++;
      } else {
        updatedEn++;
      }

      // Upsert Greek version
      const resultGr = await prisma.messageTemplate.upsert({
        where: {
          ownerId_name: {
            ownerId: actualSystemUserId,
            name: `${name} (GR)`
          }
        },
        update: {
          text: gr.text,
          category: category,
          goal: gr.goal,
          suggestedMetrics: gr.suggestedMetrics,
          language: 'gr',
          conversionRate: conversionRate,
          productViewsIncrease: productViewsIncrease,
          clickThroughRate: clickThroughRate,
          averageOrderValue: averageOrderValue,
          customerRetention: customerRetention,
        },
        create: {
          ownerId: actualSystemUserId,
          name: `${name} (GR)`,
          text: gr.text,
          category: category,
          goal: gr.goal,
          suggestedMetrics: gr.suggestedMetrics,
          language: 'gr',
          conversionRate: conversionRate,
          productViewsIncrease: productViewsIncrease,
          clickThroughRate: clickThroughRate,
          averageOrderValue: averageOrderValue,
          customerRetention: customerRetention,
        }
      });

      // Check if it was created or updated
      if (resultGr.createdAt.getTime() === resultGr.updatedAt.getTime()) {
        createdGr++;
      } else {
        updatedGr++;
      }
    }

    // Count templates after seeding
    const countAfter = await prisma.messageTemplate.count({
      where: { ownerId: actualSystemUserId }
    });

    const totalTemplates = templateDefinitions.length * 2; // English + Greek
    console.log(`✅ Seeding completed:`);
    console.log(`   Before: ${countBefore} templates`);
    console.log(`   After: ${countAfter} templates`);
    console.log(`   English: ${createdEn} created, ${updatedEn} updated`);
    console.log(`   Greek: ${createdGr} created, ${updatedGr} updated`);
    console.log(`   Total: ${totalTemplates} templates (${templateDefinitions.length} per language)`);
    console.log(`\nCategories: cafe, restaurant, gym, sports_club, generic, hotels`);
    console.log('Templates are now available to all users via GET /api/templates');
    console.log('All templates support ONLY: {{first_name}}, {{last_name}}');

    return {
      createdEn,
      updatedEn,
      createdGr,
      updatedGr,
      total: totalTemplates,
      countBefore,
      countAfter
    };
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedTemplatesIdempotent()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seed failed:', error);
      process.exit(1);
    });
}

module.exports = { seedTemplatesIdempotent };

