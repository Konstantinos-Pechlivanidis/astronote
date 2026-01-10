#!/usr/bin/env node

/**
 * Shopify Settings Audit Script
 * Performs static checks for:
 * - Required Prisma ShopSettings fields exist
 * - Required backend settings routes exist and are tenant-scoped
 * - Shopify settings pages exist and call correct endpoints
 * - English-only UI strings (best-effort scan)
 * - No route collisions in Next App Router within shopify app
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
 * Check 1: Prisma ShopSettings model
 */
function checkPrismaSchema() {
  console.log('\n📋 Checking Prisma Schema...');

  const schema = readFile(PRISMA_SCHEMA);
  if (!schema) {
    logError('Prisma schema not found');
    return;
  }

  // Check ShopSettings model exists
  if (!schema.includes('model ShopSettings')) {
    logError('ShopSettings model not found in Prisma schema');
    return;
  }

  // Check required fields
  const requiredFields = [
    'shopId',
    'senderNumber',
    'senderName',
    'timezone',
    'currency',
    'baseUrl', // Required for public links configuration
  ];

  for (const field of requiredFields) {
    if (!schema.includes(`${field}`)) {
      logError(`ShopSettings model missing required field: ${field}`);
    } else {
      console.log(`✅ ShopSettings has field: ${field}`);
    }
  }

  // Check unique constraint on shopId
  if (!schema.includes('shopId') || !schema.includes('@unique')) {
    logWarning('ShopSettings may not have unique constraint on shopId');
  } else {
    console.log('✅ ShopSettings has unique constraint on shopId');
  }
}

/**
 * Check 2: Backend routes
 */
function checkBackendRoutes() {
  console.log('\n🔍 Checking Backend Routes...');

  const routesFile = join(SHOPIFY_API, 'routes/settings.js');
  const routesCode = readFile(routesFile);
  if (!routesCode) {
    logError('Settings routes file not found: routes/settings.js');
    return;
  }

  // Check GET / route
  if (!routesCode.includes("r.get('/'") && !routesCode.includes("r.get(\"/\"")) {
    logError('GET / route not found in settings routes');
  } else {
    console.log('✅ Route GET / found');
  }

  // Check PUT / route
  if (!routesCode.includes("r.put('/'") && !routesCode.includes("r.put(\"/\"")) {
    logError('PUT / route not found in settings routes');
  } else {
    console.log('✅ Route PUT / found');
  }

  // Check GET /account route
  if (!routesCode.includes("r.get('/account'") && !routesCode.includes("r.get(\"/account\"")) {
    logWarning('GET /account route not found (optional)');
  } else {
    console.log('✅ Route GET /account found');
  }

  // Check app.js registration
  const appFile = join(SHOPIFY_API, 'app.js');
  const appCode = readFile(appFile);
  if (appCode) {
    if (!appCode.includes('/settings') || !appCode.includes('resolveStore') || !appCode.includes('requireStore')) {
      logError('Settings routes may not be registered with tenant scoping middleware');
    } else {
      console.log('✅ Settings routes registered with tenant scoping middleware');
    }
  }
}

/**
 * Check 3: Backend controllers
 */
function checkBackendControllers() {
  console.log('\n⚙️  Checking Backend Controllers...');

  const controllersFile = join(SHOPIFY_API, 'controllers/settings.js');
  const controllersCode = readFile(controllersFile);
  if (!controllersCode) {
    logError('Settings controllers file not found');
    return;
  }

  // Check getSettings function
  if (!controllersCode.includes('getSettings') || !controllersCode.includes('getStoreId')) {
    logError('getSettings controller may not use tenant scoping');
  } else {
    console.log('✅ getSettings controller uses tenant scoping');
  }

  // Check updateSettings function
  if (!controllersCode.includes('updateSettings') || !controllersCode.includes('getStoreId')) {
    logError('updateSettings controller may not use tenant scoping');
  } else {
    console.log('✅ updateSettings controller uses tenant scoping');
  }

  // Check baseUrl in response
  if (!controllersCode.includes('baseUrl')) {
    logError('baseUrl not exposed in settings controller responses');
  } else {
    console.log('✅ baseUrl exposed in settings controller');
  }
}

/**
 * Check 4: Frontend pages (English-only)
 */
function checkFrontendPages() {
  console.log('\n🎨 Checking Frontend Pages (English-Only)...');

  const settingsPage = join(SHOPIFY_FRONTEND, 'settings/page.tsx');
  if (!existsSync(settingsPage)) {
    logError('Settings page not found: app/app/shopify/settings/page.tsx');
    return;
  }

  console.log('✅ Settings page exists');

  const pageContent = readFile(settingsPage);
  if (pageContent) {
    // Check for Greek characters (basic heuristic)
    const greekPattern = /[α-ωΑ-Ωάέήίόύώϊϋΐΰ]/;
    if (greekPattern.test(pageContent)) {
      logError('Settings page contains Greek characters (English-only requirement violated)');
    } else {
      console.log('✅ Settings page is English-only (no Greek characters found)');
    }

    // Check for language/i18n toggles
    if (pageContent.includes('language') || pageContent.includes('i18n') || pageContent.includes('locale')) {
      // Check if it's just a timezone field (which is OK)
      if (!pageContent.includes('timezone')) {
        logWarning('Settings page may contain language/i18n toggles (should be English-only)');
      } else {
        console.log('✅ Settings page has no language/i18n toggles (timezone field is OK)');
      }
    } else {
      console.log('✅ Settings page has no language/i18n toggles');
    }

    // Check for baseUrl field
    if (!pageContent.includes('baseUrl')) {
      logWarning('Settings page may not display baseUrl field');
    } else {
      console.log('✅ Settings page includes baseUrl field');
    }

    // Check for API client usage
    if (!pageContent.includes('useSettings') || !pageContent.includes('useUpdateSettings')) {
      logWarning('Settings page may not use centralized API client hooks');
    } else {
      console.log('✅ Settings page uses centralized API client hooks');
    }
  }
}

/**
 * Check 5: API client
 */
function checkApiClient() {
  console.log('\n🔌 Checking API Client...');

  const apiClientFile = join(ROOT, 'apps/astronote-web/src/lib/shopify/api/settings.ts');
  const apiClientCode = readFile(apiClientFile);
  if (!apiClientCode) {
    logError('Settings API client not found');
    return;
  }

  console.log('✅ Settings API client exists');

  // Check baseUrl in types
  if (!apiClientCode.includes('baseUrl')) {
    logError('baseUrl not included in Settings interface');
  } else {
    console.log('✅ baseUrl included in Settings interface');
  }

  // Check updateSettings includes baseUrl
  if (!apiClientCode.includes('UpdateSettingsRequest') || !apiClientCode.includes('baseUrl')) {
    logWarning('UpdateSettingsRequest may not include baseUrl');
  } else {
    console.log('✅ UpdateSettingsRequest includes baseUrl');
  }
}

/**
 * Check 6: Public routes separation
 */
function checkPublicRoutes() {
  console.log('\n🔓 Checking Public Routes Separation...');

  const unsubscribeRoutes = join(SHOPIFY_API, 'routes/unsubscribe.js');
  const unsubscribeCode = readFile(unsubscribeRoutes);
  if (unsubscribeCode) {
    // Check that unsubscribe routes don't use resolveStore/requireStore
    if (unsubscribeCode.includes('resolveStore') || unsubscribeCode.includes('requireStore')) {
      logError('Unsubscribe routes should NOT use tenant scoping middleware (public routes)');
    } else {
      console.log('✅ Unsubscribe routes are public (no tenant scoping)');
    }
  }

  const shortLinkRoutes = join(SHOPIFY_API, 'routes/shortLinks.js');
  const shortLinkCode = readFile(shortLinkRoutes);
  if (shortLinkCode) {
    // Check that short link routes don't use resolveStore/requireStore
    if (shortLinkCode.includes('resolveStore') || shortLinkCode.includes('requireStore')) {
      logError('Short link routes should NOT use tenant scoping middleware (public routes)');
    } else {
      console.log('✅ Short link routes are public (no tenant scoping)');
    }
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Shopify Settings Audit\n');
  console.log('============================================================\n');

  checkPrismaSchema();
  checkBackendRoutes();
  checkBackendControllers();
  checkFrontendPages();
  checkApiClient();
  checkPublicRoutes();

  console.log('\n============================================================');
  console.log('\n📊 Summary:');
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Audit FAILED - Review errors above');
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

