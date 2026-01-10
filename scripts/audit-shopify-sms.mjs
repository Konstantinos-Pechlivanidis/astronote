#!/usr/bin/env node

/**
 * Shopify SMS Campaigns, Unsubscribe & Short Links Audit Script
 * Performs static checks for:
 * - Required Prisma models/fields exist
 * - Required backend routes exist and are registered
 * - Required frontend pages/hooks exist and call correct endpoints
 * - Unsubscribe/short links public routes are not protected incorrectly
 * - No route collisions in Next App Router
 * - No obvious wrong imports in relevant frontend files
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, '..');
const SHOPIFY_API = join(ROOT, 'apps/shopify-api');
const SHOPIFY_FRONTEND = join(ROOT, 'apps/astronote-web/app/app/shopify');
const SHOPIFY_FRONTEND_ALT = join(ROOT, 'apps/astronote-web/app/shopify'); // Alternative path structure
const PRISMA_SCHEMA = join(SHOPIFY_API, 'prisma/schema.prisma');

const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', 'logs', '.next'];
const EXCLUDE_FILES = ['.test.js', '.spec.js', '.md', '.json'];

let errors = [];
let warnings = [];

/**
 * Read file content
 */
function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

/**
 * Get all JS/TS files recursively
 */
function getAllFiles(dir, fileList = []) {
  if (!existsSync(dir)) return fileList;
  
  const files = readdirSync(dir);
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (stat.isFile()) {
      const ext = file.split('.').pop();
      if (['js', 'ts', 'tsx', 'jsx'].includes(ext) && !EXCLUDE_FILES.some(ex => file.includes(ex))) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

/**
 * Check 1: Prisma models and fields exist
 */
function checkPrismaModels() {
  console.log('🔍 Checking Prisma models and fields...');
  
  const schema = readFile(PRISMA_SCHEMA);
  if (!schema) {
    errors.push('❌ Cannot read Prisma schema');
    return;
  }

  // Required models
  const requiredModels = [
    'Campaign',
    'CampaignRecipient',
    'CampaignMetrics',
    'ShortLink',
    'Contact',
  ];

  requiredModels.forEach(model => {
    const pattern = new RegExp(`model\\s+${model}\\s*\\{`);
    if (!pattern.test(schema)) {
      errors.push(`❌ Prisma model '${model}' not found in schema`);
    }
  });

  // Required Campaign fields
  const campaignFields = ['id', 'shopId', 'name', 'message', 'status', 'scheduleAt', 'createdAt'];
  if (schema.includes('model Campaign')) {
    campaignFields.forEach(field => {
      const pattern = new RegExp(`${field}\\s+[\\w\\[\\]?]+`);
      if (!pattern.test(schema.split('model Campaign')[1].split('}')[0])) {
        warnings.push(`⚠️  Campaign model may be missing field '${field}'`);
      }
    });
  }

  // Required CampaignRecipient fields
  const recipientFields = ['id', 'campaignId', 'phoneE164', 'status', 'mittoMessageId', 'deliveryStatus'];
  if (schema.includes('model CampaignRecipient')) {
    recipientFields.forEach(field => {
      const pattern = new RegExp(`${field}\\s+[\\w\\[\\]?]+`);
      if (!pattern.test(schema.split('model CampaignRecipient')[1].split('}')[0])) {
        warnings.push(`⚠️  CampaignRecipient model may be missing field '${field}'`);
      }
    });
  }

  // Required ShortLink fields
  const shortLinkFields = ['id', 'token', 'destinationUrl', 'clicks'];
  if (schema.includes('model ShortLink')) {
    shortLinkFields.forEach(field => {
      const pattern = new RegExp(`${field}\\s+[\\w\\[\\]?]+`);
      if (!pattern.test(schema.split('model ShortLink')[1].split('}')[0])) {
        warnings.push(`⚠️  ShortLink model may be missing field '${field}'`);
      }
    });
  }

  // Check for unique constraint on CampaignRecipient
  if (schema.includes('model CampaignRecipient')) {
    const recipientSection = schema.split('model CampaignRecipient')[1].split('}')[0];
    if (!recipientSection.includes('@@unique') || !recipientSection.includes('campaignId') || !recipientSection.includes('phoneE164')) {
      warnings.push('⚠️  CampaignRecipient may be missing unique constraint on [campaignId, phoneE164]');
    }
  }

  console.log(`   ✅ Prisma models check complete (${errors.length} errors, ${warnings.length} warnings)`);
}

/**
 * Check 2: Backend routes exist and are registered
 */
function checkBackendRoutes() {
  console.log('🔍 Checking backend routes...');
  
  const appJs = readFile(join(SHOPIFY_API, 'app.js'));
  if (!appJs) {
    errors.push('❌ Cannot read app.js');
    return;
  }

  // Required campaign routes
  const campaignRoutes = [
    { method: 'GET', path: '/campaigns', description: 'List campaigns' },
    { method: 'POST', path: '/campaigns', description: 'Create campaign' },
    { method: 'GET', path: '/campaigns/:id', description: 'Get campaign' },
    { method: 'POST', path: '/campaigns/:id/enqueue', description: 'Enqueue campaign' },
    { method: 'PUT', path: '/campaigns/:id/schedule', description: 'Schedule campaign' },
  ];

  // Check routes file exists
  const campaignsRouteFile = readFile(join(SHOPIFY_API, 'routes/campaigns.js'));
  if (!campaignsRouteFile) {
    errors.push('❌ campaigns.js route file not found');
  } else {
    campaignRoutes.forEach(route => {
      // Check if route exists - use flexible pattern matching
      // Routes are defined as: r.get('/', ...) for base path, r.get('/:id', ...) for id routes
      // Routes are mounted at /campaigns in app.js, so /campaigns becomes '/' in routes file
      let found = false;
      
      // For routes with :id, check for /:id pattern (since routes are mounted at /campaigns)
      if (route.path.includes(':id')) {
        const routeSuffix = route.path.replace('/campaigns', '');
        // Check for patterns like: r.get('/:id', ...) or r.post('/:id/enqueue', ...)
        if (routeSuffix === '/:id') {
          found = campaignsRouteFile.includes(`'/:id'`) || campaignsRouteFile.includes(`"/:id"`);
        } else if (routeSuffix === '/:id/enqueue') {
          found = campaignsRouteFile.includes(`'/:id/enqueue'`) || campaignsRouteFile.includes(`"/:id/enqueue"`);
        } else if (routeSuffix === '/:id/schedule') {
          found = campaignsRouteFile.includes(`'/:id/schedule'`) || campaignsRouteFile.includes(`"/:id/schedule"`);
        }
      } else {
        // For base routes like /campaigns, check for '/' pattern (since routes are mounted at /campaigns)
        if (route.path === '/campaigns') {
          // Check for r.get('/' or r.post('/' patterns
          const method = route.method.toLowerCase();
          found = campaignsRouteFile.includes(`r.${method}(`) && 
                  (campaignsRouteFile.includes(`'/'`) || campaignsRouteFile.includes(`"/"`));
        }
      }
      
      if (!found) {
        warnings.push(`⚠️  Campaign route ${route.method} ${route.path} may not exist`);
      }
    });
  }

  // Check unsubscribe routes (public, no tenant middleware)
  const unsubscribeRouteFile = readFile(join(SHOPIFY_API, 'routes/unsubscribe.js'));
  if (!unsubscribeRouteFile) {
    errors.push('❌ unsubscribe.js route file not found');
  } else {
    if (unsubscribeRouteFile.includes('resolveStore') || unsubscribeRouteFile.includes('requireStore')) {
      errors.push('❌ Unsubscribe routes incorrectly use tenant middleware');
    }
  }

  // Check unsubscribe routes are registered as public
  // Can be registered as '/unsubscribe' or '/api/unsubscribe'
  const hasUnsubscribeRoute = appJs.includes("app.use('/unsubscribe") || 
                                 appJs.includes("app.use('/api/unsubscribe") ||
                                 appJs.includes('unsubscribeRoutes');
  if (!hasUnsubscribeRoute) {
    warnings.push('⚠️  Unsubscribe routes may not be registered in app.js');
  } else {
    // Check they don't use tenant middleware
    // Look for patterns like: app.use('/unsubscribe', resolveStore) or app.use('/unsubscribe', requireStore)
    const unsubscribeRoutePattern = /app\.use\(['"]\/[^'"]*unsubscribe['"],\s*(resolveStore|requireStore)/;
    if (unsubscribeRoutePattern.test(appJs)) {
      errors.push('❌ Unsubscribe routes incorrectly use tenant middleware in app.js');
    }
  }

  // Check short link routes (public)
  const shortLinkRouteFile = readFile(join(SHOPIFY_API, 'routes/shortLinks.js'));
  if (!shortLinkRouteFile) {
    errors.push('❌ shortLinks.js route file not found');
  } else {
    if (shortLinkRouteFile.includes('resolveStore') || shortLinkRouteFile.includes('requireStore')) {
      errors.push('❌ Short link routes incorrectly use tenant middleware');
    }
  }

  // Check short link routes are registered as public
  if (!appJs.includes("app.use('/r'")) {
    warnings.push('⚠️  Short link routes may not be registered in app.js');
  } else {
    if (appJs.includes("app.use('/r', resolveStore") || appJs.includes("app.use('/r', requireStore")) {
      errors.push('❌ Short link routes incorrectly use tenant middleware in app.js');
    }
  }

  console.log(`   ✅ Backend routes check complete (${errors.length} errors, ${warnings.length} warnings)`);
}

/**
 * Check 3: Frontend pages exist
 */
function checkFrontendPages() {
  console.log('🔍 Checking frontend pages...');
  
  // Check campaigns pages
  const campaignsListPage = join(SHOPIFY_FRONTEND, 'campaigns/page.tsx');
  const campaignsNewPage = join(SHOPIFY_FRONTEND, 'campaigns/new/page.tsx');
  const campaignsDetailPage = join(SHOPIFY_FRONTEND, 'campaigns/[id]/page.tsx');

  if (!existsSync(campaignsListPage)) {
    errors.push('❌ Campaigns list page not found: campaigns/page.tsx');
  }
  if (!existsSync(campaignsNewPage)) {
    errors.push('❌ Campaigns create page not found: campaigns/new/page.tsx');
  }
  if (!existsSync(campaignsDetailPage)) {
    errors.push('❌ Campaigns detail page not found: campaigns/[id]/page.tsx');
  }

  // Check unsubscribe page (CRITICAL)
  // Path: app/shopify/unsubscribe/[token]/page.tsx (can be in app/app/shopify or app/shopify)
  const unsubscribePage1 = join(SHOPIFY_FRONTEND, 'unsubscribe', '[token]', 'page.tsx');
  const unsubscribePage2 = join(SHOPIFY_FRONTEND_ALT, 'unsubscribe', '[token]', 'page.tsx');
  const unsubscribePage = existsSync(unsubscribePage1) ? unsubscribePage1 : 
                          existsSync(unsubscribePage2) ? unsubscribePage2 : null;
  
  if (!unsubscribePage) {
    errors.push('❌ CRITICAL: Unsubscribe page not found: app/shopify/unsubscribe/[token]/page.tsx');
  } else {
    const content = readFile(unsubscribePage);
    if (content) {
      // Check it calls Shopify API (not Retail API)
      if (content.includes('SHOPIFY_API_BASE_URL') || content.includes('shopify-api')) {
        // Good
      } else if (content.includes('RETAIL_API_BASE_URL') || content.includes('retail-api')) {
        errors.push('❌ Unsubscribe page calls Retail API instead of Shopify API');
      }
      
      // Check it doesn't require tenant auth
      if (content.includes('shopifyApi') && !content.includes('unsubscribe')) {
        warnings.push('⚠️  Unsubscribe page may use shopifyApi (should use public axios)');
      }
    }
  }

  console.log(`   ✅ Frontend pages check complete (${errors.length} errors, ${warnings.length} warnings)`);
}

/**
 * Check 4: No route collisions
 */
function checkRouteCollisions() {
  console.log('🔍 Checking for route collisions...');
  
  // Check for duplicate unsubscribe routes
  const retailUnsubscribe = join(ROOT, 'apps/astronote-web/app/(retail)/unsubscribe');
  const shopifyUnsubscribe = join(SHOPIFY_FRONTEND, 'unsubscribe');
  
  // Both can exist (different route groups), but verify they're in different groups
  if (existsSync(retailUnsubscribe) && existsSync(shopifyUnsubscribe)) {
    // Check if they're in different route groups
    const retailPath = retailUnsubscribe.replace(ROOT, '');
    const shopifyPath = shopifyUnsubscribe.replace(ROOT, '');
    
    if (retailPath.includes('(retail)') && shopifyPath.includes('app/shopify')) {
      // Good - different route groups
    } else {
      warnings.push('⚠️  Unsubscribe routes may collide (check route groups)');
    }
  }

  console.log(`   ✅ Route collisions check complete (${warnings.length} warnings)`);
}

/**
 * Check 5: Frontend API usage
 */
function checkFrontendApiUsage() {
  console.log('🔍 Checking frontend API usage...');
  
  const campaignsPages = getAllFiles(join(SHOPIFY_FRONTEND, 'campaigns'));
  
  campaignsPages.forEach(file => {
    const content = readFile(file);
    if (!content) return;

    // Check for direct axios imports (should use shopifyApi for protected endpoints)
    if (content.includes('import axios') && !file.includes('unsubscribe')) {
      const lines = content.split('\n');
      const lineNum = lines.findIndex(line => line.includes('import axios'));
      warnings.push(`⚠️  ${file.replace(ROOT, '')}:${lineNum + 1} - Direct axios import (should use shopifyApi for protected endpoints)`);
    }

    // Check for shopifyApi usage
    if (!content.includes('shopifyApi') && !content.includes('useCampaigns') && !content.includes('useCampaign')) {
      warnings.push(`⚠️  ${file.replace(ROOT, '')} - May not use shopifyApi or hooks`);
    }
  });

  // Check unsubscribe page uses public API
  const unsubscribePage = join(SHOPIFY_FRONTEND, 'unsubscribe/[token]/page.tsx');
  if (existsSync(unsubscribePage)) {
    const content = readFile(unsubscribePage);
    if (content) {
      // Should use direct axios or public client, not shopifyApi
      if (content.includes('shopifyApi') && !content.includes('unsubscribe')) {
        warnings.push('⚠️  Unsubscribe page may use shopifyApi (should use public axios)');
      }
    }
  }

  console.log(`   ✅ Frontend API usage check complete (${warnings.length} warnings)`);
}

/**
 * Check 6: Scheduled send worker exists
 */
function checkScheduledWorker() {
  console.log('🔍 Checking scheduled send worker...');
  
  const schedulerFile = readFile(join(SHOPIFY_API, 'services/scheduler.js'));
  if (!schedulerFile) {
    errors.push('❌ scheduler.js service not found');
  } else {
    // Check for processScheduledCampaigns function
    if (!schedulerFile.includes('processScheduledCampaigns')) {
      errors.push('❌ processScheduledCampaigns function not found in scheduler.js');
    } else {
      // Check it checks scheduleAt field
      if (!schedulerFile.includes('scheduleAt')) {
        warnings.push('⚠️  processScheduledCampaigns may not check scheduleAt field');
      }
    }
  }

  // Check if scheduler is started in index.js
  const indexFile = readFile(join(SHOPIFY_API, 'index.js'));
  if (indexFile && !indexFile.includes('startScheduledCampaignsProcessor') && !indexFile.includes('processScheduledCampaigns')) {
    warnings.push('⚠️  Scheduler may not be started in index.js');
  }

  console.log(`   ✅ Scheduled worker check complete (${errors.length} errors, ${warnings.length} warnings)`);
}

/**
 * Check 7: Delivery status webhook handlers
 */
function checkDeliveryWebhooks() {
  console.log('🔍 Checking delivery status webhook handlers...');
  
  // Check webhook routes - can be in mitto-webhooks.js or mitto.js
  const mittoWebhookFile = readFile(join(SHOPIFY_API, 'routes/mitto-webhooks.js'));
  const mittoFile = readFile(join(SHOPIFY_API, 'routes/mitto.js'));
  const webhookFile = mittoWebhookFile || mittoFile;
  
  if (!webhookFile) {
    errors.push('❌ mitto-webhooks.js or mitto.js route file not found');
  } else {
    // Check for DLR webhook handler
    if (!webhookFile.includes('/webhooks/mitto/dlr') && !webhookFile.includes('/dlr') && !webhookFile.includes('router.post')) {
      errors.push('❌ DLR webhook handler not found in mitto webhook routes');
    } else {
      // Check it updates deliveryStatus
      if (!webhookFile.includes('deliveryStatus')) {
        warnings.push('⚠️  DLR webhook handler may not update deliveryStatus');
      }
      
      // Check it updates CampaignRecipient
      if (!webhookFile.includes('CampaignRecipient') && !webhookFile.includes('campaignRecipient')) {
        warnings.push('⚠️  DLR webhook handler may not update CampaignRecipient');
      }
    }
  }

  console.log(`   ✅ Delivery webhooks check complete (${errors.length} errors, ${warnings.length} warnings)`);
}

/**
 * Main audit function
 */
function runAudit() {
  console.log('🚀 Starting Shopify SMS Audit...\n');

  checkPrismaModels();
  checkBackendRoutes();
  checkFrontendPages();
  checkRouteCollisions();
  checkFrontendApiUsage();
  checkScheduledWorker();
  checkDeliveryWebhooks();

  console.log('\n📊 Audit Summary:');
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Warnings: ${warnings.length}\n`);

  if (errors.length > 0) {
    console.log('❌ ERRORS:');
    errors.forEach(err => console.log(`   ${err}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(warn => console.log(`   ${warn}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All checks passed!\n');
    process.exit(0);
  } else if (errors.length > 0) {
    console.log('\n❌ Audit failed with errors\n');
    process.exit(1);
  } else {
    console.log('\n⚠️  Audit passed with warnings\n');
    process.exit(0);
  }
}

runAudit();

