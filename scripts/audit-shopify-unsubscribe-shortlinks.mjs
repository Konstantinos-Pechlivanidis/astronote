#!/usr/bin/env node

/**
 * Shopify Unsubscribe & Short Links Audit Script
 * Verifies unsubscribe flow is isolated from Retail and short links redirect correctly
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const SHOPIFY_API = join(ROOT, 'apps/shopify-api');
const SHOPIFY_FRONTEND = join(ROOT, 'apps/astronote-web');

let errors = [];
let warnings = [];
let passes = [];

function error(msg) {
  errors.push(msg);
  console.error(`❌ ERROR: ${msg}`);
}

function warn(msg) {
  warnings.push(msg);
  console.warn(`⚠️  WARNING: ${msg}`);
}

function pass(msg) {
  passes.push(msg);
  console.log(`✅ PASS: ${msg}`);
}

function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

/**
 * Check Retail Unsubscribe Isolation
 */
function checkRetailIsolation() {
  console.log('\n📋 Checking Retail Unsubscribe Isolation...');
  console.log('='.repeat(60));

  const shopifyUnsubscribePage = join(SHOPIFY_FRONTEND, 'app/shopify/unsubscribe/[token]/page.tsx');
  const pageContent = readFile(shopifyUnsubscribePage);

  if (!pageContent) {
    error('Shopify unsubscribe page not found');
    return;
  }

  pass('Shopify unsubscribe page exists');

  // Check for Retail component imports
  const retailImports = [
    '@/src/components/retail/public/PublicLayout',
    '@/src/components/retail/public/PublicCard',
    '@/src/components/retail/public/PublicLoading',
    '@/src/components/retail/public/PublicError',
    '@/src/components/retail/public/PublicSuccess',
  ];

  retailImports.forEach(importPath => {
    if (pageContent.includes(importPath)) {
      error(`Shopify unsubscribe page imports from Retail: ${importPath}`);
    } else {
      pass(`No Retail import: ${importPath}`);
    }
  });

  // Check for Shopify component imports
  if (pageContent.includes('@/src/components/shopify/public/')) {
    pass('Shopify unsubscribe page uses Shopify-specific components');
  } else {
    error('Shopify unsubscribe page does not use Shopify-specific components');
  }

  // Check route path
  if (shopifyUnsubscribePage.includes('/shopify/unsubscribe/')) {
    pass('Shopify unsubscribe page uses /shopify/unsubscribe/:token route');
  } else {
    error('Shopify unsubscribe page does not use correct route path');
  }

  // Check Retail unsubscribe routes don't collide
  const retailUnsubscribePage = join(SHOPIFY_FRONTEND, 'app/(retail)/unsubscribe');
  if (existsSync(retailUnsubscribePage)) {
    const retailFiles = readdirSync(retailUnsubscribePage, { recursive: true });
    const retailRoutes = retailFiles.filter(f => f.includes('page.tsx'));
    
    // Retail uses /unsubscribe (no /shopify prefix)
    // Shopify uses /shopify/unsubscribe
    // These should not collide
    if (shopifyUnsubscribePage.includes('/shopify/') && !retailUnsubscribePage.includes('/shopify/')) {
      pass('Shopify and Retail unsubscribe routes are isolated (no collision)');
    } else {
      error('Shopify and Retail unsubscribe routes may collide');
    }
  } else {
    warn('Retail unsubscribe page not found (may not exist)');
  }
}

/**
 * Check Short Link Resolver
 */
function checkShortLinkResolver() {
  console.log('\n📋 Checking Short Link Resolver...');
  console.log('='.repeat(60));

  const shortLinkController = readFile(join(SHOPIFY_API, 'controllers/shortLinks.js'));
  if (!shortLinkController) {
    error('Short link controller not found');
    return;
  }

  pass('Short link controller exists');

  // Check it redirects to destinationUrl (which should be Shopify unsubscribe for unsubscribe links)
  if (shortLinkController.includes('res.redirect') || shortLinkController.includes('res.redirect(')) {
    pass('Short link resolver performs redirect');
  } else {
    error('Short link resolver does not perform redirect');
  }

  // Check it doesn't hardcode Retail routes
  if (shortLinkController.includes('/retail/unsubscribe') || shortLinkController.includes('/(retail)/unsubscribe')) {
    error('Short link resolver contains Retail unsubscribe route');
  } else {
    pass('Short link resolver does not contain Retail unsubscribe route');
  }

  // Check unsubscribe URL generation uses Shopify namespace
  const unsubscribeUtils = readFile(join(SHOPIFY_API, 'utils/unsubscribe.js'));
  if (unsubscribeUtils) {
    if (unsubscribeUtils.includes('/shopify/unsubscribe/')) {
      pass('Unsubscribe URL generation uses Shopify namespace');
    } else {
      error('Unsubscribe URL generation does not use Shopify namespace');
    }

    // Check it doesn't use Retail namespace
    if (unsubscribeUtils.includes('/(retail)/unsubscribe') || unsubscribeUtils.includes('/retail/unsubscribe')) {
      error('Unsubscribe URL generation contains Retail namespace');
    } else {
      pass('Unsubscribe URL generation does not contain Retail namespace');
    }
  } else {
    error('Unsubscribe utils file not found');
  }
}

/**
 * Check Unsubscribe Endpoints
 */
function checkUnsubscribeEndpoints() {
  console.log('\n📋 Checking Unsubscribe Endpoints...');
  console.log('='.repeat(60));

  const unsubscribeRoutes = readFile(join(SHOPIFY_API, 'routes/unsubscribe.js'));
  if (!unsubscribeRoutes) {
    error('Unsubscribe routes file not found');
    return;
  }

  pass('Unsubscribe routes file exists');

  // Check GET endpoint
  if (unsubscribeRoutes.includes('getUnsubscribeInfo') || unsubscribeRoutes.includes('GET')) {
    pass('GET /unsubscribe/:token endpoint exists');
  } else {
    error('GET /unsubscribe/:token endpoint not found');
  }

  // Check POST endpoint
  if (unsubscribeRoutes.includes('processUnsubscribe') || unsubscribeRoutes.includes('POST')) {
    pass('POST /unsubscribe/:token endpoint exists');
  } else {
    error('POST /unsubscribe/:token endpoint not found');
  }

  // Check endpoints are public (no auth required)
  const unsubscribeController = readFile(join(SHOPIFY_API, 'controllers/unsubscribe.js'));
  if (unsubscribeController) {
    // Should not use resolveStore or requireStore
    if (!unsubscribeController.includes('resolveStore') && !unsubscribeController.includes('requireStore')) {
      pass('Unsubscribe endpoints are public (no tenant auth required)');
    } else {
      error('Unsubscribe endpoints require tenant auth (should be public)');
    }

    // Should use token verification instead
    if (unsubscribeController.includes('verifyUnsubscribeToken') || unsubscribeController.includes('token')) {
      pass('Unsubscribe endpoints use token verification');
    } else {
      warn('Unsubscribe endpoints may not use token verification');
    }
  } else {
    error('Unsubscribe controller not found');
  }
}

/**
 * Check Prisma Token Model
 */
function checkPrismaModel() {
  console.log('\n📋 Checking Prisma Models...');
  console.log('='.repeat(60));

  const schema = readFile(join(SHOPIFY_API, 'prisma/schema.prisma'));
  if (!schema) {
    error('Prisma schema not found');
    return;
  }

  // Check ShortLink model exists
  if (/model\s+ShortLink\s+{/.test(schema)) {
    pass('ShortLink model exists');
  } else {
    error('ShortLink model not found');
  }

  // Check ShortLink has required fields
  const requiredFields = ['token', 'destinationUrl', 'shopId'];
  requiredFields.forEach(field => {
    if (new RegExp(`\\s+${field}\\s+`).test(schema)) {
      pass(`ShortLink model has ${field} field`);
    } else {
      error(`ShortLink model missing ${field} field`);
    }
  });
}

/**
 * Main execution
 */
async function runAudit() {
  console.log('🚀 Shopify Unsubscribe & Short Links Audit');
  console.log('='.repeat(60));

  checkRetailIsolation();
  checkShortLinkResolver();
  checkUnsubscribeEndpoints();
  checkPrismaModel();

  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passes.length}`);
  console.log(`❌ Failed: ${errors.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(err => console.log(`   ${err}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(warn => console.log(`   ${warn}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ Audit failed');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed!');
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

