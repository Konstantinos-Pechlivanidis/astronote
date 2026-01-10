#!/usr/bin/env node

/**
 * Shopify Templates Parity Audit Script
 * Performs static checks for:
 * - Required Prisma Template fields/models exist
 * - Required backend routes exist and are tenant-scoped
 * - ensure-defaults function exists
 * - Frontend pages exist (if applicable)
 * - No duplicates risks (unique constraint exists)
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
const PRISMA_SCHEMA = join(SHOPIFY_API, 'prisma/schema.prisma');

let errors = [];
let warnings = [];

function logError(message) {
  console.error(`❌ ERROR: ${message}`);
  errors.push(message);
}

function logWarning(message) {
  console.warn(`⚠️  WARNING: ${message}`);
  warnings.push(message);
}

function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

/**
 * Check 1: Prisma Template model fields
 */
function checkPrismaSchema() {
  console.log('\n📋 Checking Prisma Schema...');
  
  const schema = readFile(PRISMA_SCHEMA);
  if (!schema) {
    logError('Prisma schema not found');
    return;
  }

  // Required fields for Retail alignment + Shopify-specific requirements
  const requiredFields = [
    'shopId', // Tenant scoping (CRITICAL)
    'eshopType', // eShop type categorization (REQUIRED)
    'templateKey', // Stable identity for defaults (REQUIRED)
    'name', // Retail-aligned field
    'text', // Retail-aligned field
    'language', // Retail-aligned field
    'goal', // Retail-aligned field
    'suggestedMetrics', // Retail-aligned field
  ];

  const missingFields = [];
  for (const field of requiredFields) {
    if (!schema.includes(` ${field} `) && !schema.includes(` ${field}\n`) && !schema.includes(` ${field}\r`)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    logError(`Missing Prisma Template fields: ${missingFields.join(', ')}`);
  } else {
    console.log('✅ Prisma Template model has all required fields');
  }

  // Check for EshopType enum
  if (!schema.includes('enum EshopType')) {
    logError('EshopType enum not found in Prisma schema');
  } else {
    console.log('✅ EshopType enum exists');
  }

  // Check for unique constraint on (shopId, eshopType, templateKey)
  if (!schema.includes('@@unique([shopId, eshopType, templateKey])')) {
    logError('Template model missing unique constraint on (shopId, eshopType, templateKey)');
  } else {
    console.log('✅ Template model has unique constraint on (shopId, eshopType, templateKey)');
  }

  // Check for indexes
  const requiredIndexes = [
    'shopId',
    'eshopType',
    'language',
  ];

  for (const indexField of requiredIndexes) {
    if (!schema.includes(`@@index([shopId, ${indexField}])`) && !schema.includes(`@@index([${indexField}])`)) {
      logWarning(`Template model may be missing index on ${indexField}`);
    }
  }

  // Check Shop model has eshopType field
  if (!schema.includes('eshopType') || !schema.match(/model Shop[\s\S]*?eshopType/)) {
    logWarning('Shop model may be missing eshopType field');
  } else {
    console.log('✅ Shop model has eshopType field');
  }
}

/**
 * Check 2: Backend routes exist and are tenant-scoped
 */
function checkBackendRoutes() {
  console.log('\n🔍 Checking Backend Routes...');

  const routesDir = join(SHOPIFY_API, 'routes');
  if (!existsSync(routesDir)) {
    logError('Backend routes directory not found');
    return;
  }

  // Check for templates routes file
  const templatesRoutesFile = join(routesDir, 'templates.js');
  const templatesRoutes = readFile(templatesRoutesFile);
  if (!templatesRoutes) {
    logError('Templates routes file not found: routes/templates.js');
    return;
  }

  // Check for required routes
  const requiredRoutes = [
    { method: 'GET', path: '/' },
    { method: 'GET', path: '/categories' },
    { method: 'GET', path: '/:id' },
    { method: 'POST', path: '/ensure-defaults' },
  ];

  for (const route of requiredRoutes) {
    const methodPattern = route.method === 'GET' ? 'router\\.get|r\\.get' : 
                         route.method === 'POST' ? 'router\\.post|r\\.post' : null;
    
    if (methodPattern) {
      const pathPattern = route.path === '/' ? '[\'"]/[\'"]|[\'"]$' : 
                         route.path === '/:id' ? '/:id' :
                         route.path.replace(':', '\\w+');
      const regex = new RegExp(`${methodPattern}\\(['"]${pathPattern}`, 'i');
      if (!regex.test(templatesRoutes)) {
        logWarning(`${route.method} ${route.path} may not be registered`);
      } else {
        console.log(`✅ Route ${route.method} ${route.path} found`);
      }
    }
  }

  // Check for tenant resolver middleware usage
  if (!templatesRoutes.includes('resolveStore') && !templatesRoutes.includes('store-resolution')) {
    logError('Templates routes do not use tenant resolver middleware');
  } else {
    console.log('✅ Templates routes use tenant resolver middleware');
  }
}

/**
 * Check 3: ensure-defaults function exists
 */
function checkEnsureDefaultsFunction() {
  console.log('\n🔧 Checking ensure-defaults Function...');

  const templatesService = join(SHOPIFY_API, 'services/templates.js');
  const serviceCode = readFile(templatesService);
  if (!serviceCode) {
    logError('Templates service not found');
    return;
  }

  // Check for ensureDefaultTemplates function
  if (!serviceCode.includes('ensureDefaultTemplates') && !serviceCode.includes('function ensureDefaultTemplates')) {
    logError('ensureDefaultTemplates function not found in templates service');
  } else {
    console.log('✅ ensureDefaultTemplates function exists');
  }

  // Check for DEFAULT_TEMPLATES constant
  if (!serviceCode.includes('DEFAULT_TEMPLATES')) {
    logWarning('DEFAULT_TEMPLATES constant may not be defined');
  } else {
    console.log('✅ DEFAULT_TEMPLATES constant exists');
  }

  // Check for idempotent upsert logic
  if (!serviceCode.includes('upsert') || !serviceCode.includes('shopId_eshopType_templateKey')) {
    logWarning('ensureDefaultTemplates may not use idempotent upsert with unique constraint');
  } else {
    console.log('✅ ensureDefaultTemplates uses idempotent upsert');
  }

  // Check controller has ensureDefaultTemplates endpoint
  const templatesController = join(SHOPIFY_API, 'controllers/templates.js');
  const controllerCode = readFile(templatesController);
  if (controllerCode && !controllerCode.includes('ensureDefaultTemplates')) {
    logWarning('ensureDefaultTemplates controller function may not exist');
  } else if (controllerCode) {
    console.log('✅ ensureDefaultTemplates controller function exists');
  }
}

/**
 * Check 4: Frontend pages (if applicable) - ENGLISH-ONLY
 */
function checkFrontendPages() {
  console.log('\n🎨 Checking Frontend Pages (English-Only)...');

  // Templates pages are optional (may be used within campaign creation flow)
  const templatesPage = join(SHOPIFY_FRONTEND, 'templates/page.tsx');
  if (!existsSync(templatesPage)) {
    logWarning('Templates list page not found: app/app/shopify/templates/page.tsx (optional)');
  } else {
    console.log('✅ Templates list page exists');
    
    // Check for English-only: no Greek strings, no i18n toggles
    const pageContent = readFile(templatesPage);
    if (pageContent) {
      // Check for Greek characters (basic heuristic)
      const greekPattern = /[α-ωΑ-Ωάέήίόύώϊϋΐΰ]/;
      if (greekPattern.test(pageContent)) {
        logError('Templates page contains Greek characters (English-only requirement violated)');
      } else {
        console.log('✅ Templates page is English-only (no Greek characters found)');
      }

      // Check for language/i18n toggles
      if (pageContent.includes('language') || pageContent.includes('i18n') || pageContent.includes('locale')) {
        logWarning('Templates page may contain language/i18n toggles (should be English-only)');
      } else {
        console.log('✅ Templates page has no language/i18n toggles');
      }
    }
  }

  // Check for API client usage
  const apiClientFile = join(ROOT, 'apps/astronote-web/src/lib/shopify/api/templates.ts');
  if (!existsSync(apiClientFile)) {
    logWarning('Shopify templates API client not found');
  } else {
    console.log('✅ Shopify templates API client exists');
    
    // Check API client enforces English-only
    const apiContent = readFile(apiClientFile);
    if (apiContent) {
      // Check if language is forced to 'en'
      if (apiContent.includes("language = 'en'") || apiContent.includes('language: \'en\'')) {
        console.log('✅ API client enforces English-only (language = "en")');
      } else {
        logWarning('API client may not enforce English-only language');
      }
    }
  }
}

/**
 * Check 5: Service layer tenant scoping and English-only enforcement
 */
function checkServiceLayer() {
  console.log('\n⚙️  Checking Service Layer (English-Only)...');

  const templatesService = join(SHOPIFY_API, 'services/templates.js');
  const serviceCode = readFile(templatesService);
  if (!serviceCode) {
    logError('Templates service not found');
    return;
  }

  // Check listTemplates requires shopId parameter
  if (!serviceCode.includes('listTemplates(shopId') && !serviceCode.includes('listTemplates(shopId,')) {
    logError('listTemplates function does not require shopId parameter (tenant scoping missing)');
  } else {
    console.log('✅ listTemplates function requires shopId parameter');
  }

  // Check getTemplateById requires shopId parameter
  if (!serviceCode.includes('getTemplateById(shopId') && !serviceCode.includes('getTemplateById(shopId,')) {
    logError('getTemplateById function does not require shopId parameter (tenant scoping missing)');
  } else {
    console.log('✅ getTemplateById function requires shopId parameter');
  }

  // Check where clause includes shopId
  if (!serviceCode.includes('where: {') || !serviceCode.includes('shopId')) {
    logWarning('Service queries may not filter by shopId');
  } else {
    console.log('✅ Service queries filter by shopId');
  }

  // Check English-only enforcement
  if (serviceCode.includes("language = 'en'") || serviceCode.includes('language: \'en\'')) {
    console.log('✅ Service enforces English-only (language = "en")');
  } else {
    logWarning('Service may not enforce English-only language');
  }

  // Check for Greek language support (should NOT exist)
  if (serviceCode.includes("'gr'") || serviceCode.includes('"gr"')) {
    logError('Service allows Greek language (violates English-only requirement)');
  } else {
    console.log('✅ Service does not support Greek language (English-only)');
  }

  // Check ensureDefaultTemplates repairs language
  if (serviceCode.includes('repaired') && serviceCode.includes('language')) {
    console.log('✅ ensureDefaultTemplates repairs non-English language');
  } else {
    logWarning('ensureDefaultTemplates may not repair non-English language');
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Shopify Templates Parity Audit\n');
  console.log('='.repeat(60));

  checkPrismaSchema();
  checkBackendRoutes();
  checkEnsureDefaultsFunction();
  checkFrontendPages();
  checkServiceLayer();

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Audit FAILED - Please fix the errors above');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('\n⚠️  Audit PASSED with warnings - Review warnings above');
    process.exit(0);
  } else {
    console.log('\n✅ Audit PASSED - All checks successful');
    process.exit(0);
  }
}

main();

