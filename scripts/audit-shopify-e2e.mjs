#!/usr/bin/env node

/**
 * Shopify End-to-End Audit Script
 * Performs static checks for:
 * - Tenant/auth resolution
 * - Route registration
 * - Prisma field usage vs schema
 * - Frontend endpoint usage and imports
 * - Unsubscribe/public routes not incorrectly protected
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
 * Check 1: Protected routes use resolveStore + requireStore
 */
function checkProtectedRoutes() {
  console.log('🔍 Checking protected routes use tenant middleware...');
  
  const appJs = readFile(join(SHOPIFY_API, 'app.js'));
  if (!appJs) {
    errors.push('❌ Cannot read app.js');
    return;
  }

  // Routes that should be protected
  const protectedRoutes = [
    '/dashboard',
    '/contacts',
    '/campaigns',
    '/automations',
    '/reports',
    '/discounts',
    '/billing',
    '/subscriptions',
    '/settings',
    '/audiences',
    '/shopify',
    '/tracking',
    '/admin/templates',
  ];

  protectedRoutes.forEach(route => {
    const pattern = new RegExp(`app\\.use\\(['"]${route.replace('/', '\\/')}['"]`);
    const match = appJs.match(pattern);
    if (match) {
      const line = appJs.substring(0, appJs.indexOf(match[0])).split('\n').length;
      const hasResolveStore = appJs.includes(`app.use('${route}', resolveStore`);
      const hasRequireStore = appJs.includes(`app.use('${route}', resolveStore, requireStore`);
      
      if (!hasResolveStore) {
        errors.push(`❌ Route ${route} missing resolveStore middleware (line ~${line})`);
      } else if (!hasRequireStore) {
        warnings.push(`⚠️  Route ${route} has resolveStore but missing requireStore (line ~${line})`);
      }
    }
  });

  console.log(`   ✅ Protected routes check complete (${errors.length} errors, ${warnings.length} warnings)`);
}

/**
 * Check 2: Public routes do NOT use tenant middleware
 */
function checkPublicRoutes() {
  console.log('🔍 Checking public routes do NOT use tenant middleware...');
  
  const appJs = readFile(join(SHOPIFY_API, 'app.js'));
  if (!appJs) return;

  // Routes that should be public (no tenant middleware)
  const publicRoutes = [
    '/unsubscribe',
    '/api/opt-in',
    '/r',
    '/webhooks/stripe',
    '/automation-webhooks',
    '/auth',
  ];

  publicRoutes.forEach(route => {
    const pattern = new RegExp(`app\\.use\\(['"]${route.replace('/', '\\/')}['"]`);
    const match = appJs.match(pattern);
    if (match) {
      const line = appJs.substring(0, appJs.indexOf(match[0])).split('\n').length;
      const hasResolveStore = appJs.includes(`app.use('${route}', resolveStore`);
      const hasRequireStore = appJs.includes(`app.use('${route}', resolveStore, requireStore`);
      
      if (hasRequireStore) {
        errors.push(`❌ Public route ${route} incorrectly uses requireStore middleware (line ~${line})`);
      } else if (hasResolveStore && route !== '/templates') {
        // Templates route uses resolveStore but not requireStore (optional store context)
        warnings.push(`⚠️  Public route ${route} uses resolveStore (may be intentional, verify) (line ~${line})`);
      }
    }
  });

  console.log(`   ✅ Public routes check complete (${errors.length} errors, ${warnings.length} warnings)`);
}

/**
 * Check 3: Prisma field usage vs schema
 */
function checkPrismaFields() {
  console.log('🔍 Checking Prisma field usage vs schema...');
  
  const schema = readFile(PRISMA_SCHEMA);
  if (!schema) {
    errors.push('❌ Cannot read Prisma schema');
    return;
  }

  // Extract field names from schema
  const fieldMappings = {};
  const modelMatches = schema.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g);
  for (const match of modelMatches) {
    const modelName = match[1];
    const modelBody = match[2];
    const fieldMatches = modelBody.matchAll(/(\w+)\s+[\w\[\]?]+/g);
    for (const fieldMatch of fieldMatches) {
      const fieldName = fieldMatch[1];
      if (!fieldMappings[modelName]) {
        fieldMappings[modelName] = [];
      }
      fieldMappings[modelName].push(fieldName);
    }
  }

  // Known mismatches to check
  const knownMismatches = {
    'UserAutomation': { wrong: 'active', correct: 'isActive' },
    'Segment': { wrong: 'active', correct: 'isActive' },
    'SmsPackage': { wrong: 'active', correct: 'isActive' },
  };

  const apiFiles = getAllFiles(join(SHOPIFY_API, 'services'));
  apiFiles.push(...getAllFiles(join(SHOPIFY_API, 'controllers')));

  apiFiles.forEach(file => {
    const content = readFile(file);
    if (!content) return;

    Object.entries(knownMismatches).forEach(([model, { wrong, correct }]) => {
      // Check for wrong field usage
      const wrongPattern = new RegExp(`prisma\\.${model.toLowerCase()}\\.\\w+.*\\{[^}]*${wrong}\\s*:`, 's');
      if (wrongPattern.test(content)) {
        const lines = content.split('\n');
        const lineNum = lines.findIndex(line => line.includes(wrong) && line.includes(model.toLowerCase()));
        errors.push(`❌ ${file.replace(ROOT, '')}:${lineNum + 1} - ${model} uses '${wrong}' instead of '${correct}'`);
      }
    });
  });

  console.log(`   ✅ Prisma field check complete (${errors.length} errors)`);
}

/**
 * Check 4: Frontend uses shopifyApi instance (not raw axios)
 */
function checkFrontendApiUsage() {
  console.log('🔍 Checking frontend API usage...');
  
  const frontendFiles = getAllFiles(SHOPIFY_FRONTEND);
  
  frontendFiles.forEach(file => {
    const content = readFile(file);
    if (!content) return;

    // Check for direct axios imports (should use shopifyApi)
    if (content.includes('import axios') && !content.includes('from \'axios\'') && !file.includes('axios.ts')) {
      const lines = content.split('\n');
      const lineNum = lines.findIndex(line => line.includes('import axios'));
      warnings.push(`⚠️  ${file.replace(ROOT, '')}:${lineNum + 1} - Direct axios import (should use shopifyApi)`);
    }

    // Check for direct fetch calls to shopify-api (exclude hooks and API client files)
    if (content.includes('fetch(') && content.includes('shopify') && !file.includes('axios.ts') && !file.includes('hooks/') && !file.includes('api/')) {
      const lines = content.split('\n');
      const lineNum = lines.findIndex(line => line.includes('fetch(') && line.includes('shopify'));
      if (lineNum >= 0) {
        warnings.push(`⚠️  ${file.replace(ROOT, '')}:${lineNum + 1} - Direct fetch call (should use shopifyApi)`);
      }
    }
  });

  console.log(`   ✅ Frontend API usage check complete (${warnings.length} warnings)`);
}

/**
 * Check 5: Unsubscribe routes are public
 */
function checkUnsubscribeRoutes() {
  console.log('🔍 Checking unsubscribe routes are public...');
  
  const unsubscribeRoute = readFile(join(SHOPIFY_API, 'routes/unsubscribe.js'));
  if (!unsubscribeRoute) {
    errors.push('❌ Cannot read unsubscribe routes');
    return;
  }

  // Unsubscribe routes should NOT import resolveStore or requireStore
  if (unsubscribeRoute.includes('resolveStore') || unsubscribeRoute.includes('requireStore')) {
    errors.push('❌ Unsubscribe routes incorrectly use tenant middleware');
  }

  // Verify unsubscribe controller scopes by shopId from token (not from header)
  const unsubscribeController = readFile(join(SHOPIFY_API, 'controllers/unsubscribe.js'));
  if (unsubscribeController) {
    if (!unsubscribeController.includes('verifyUnsubscribeToken')) {
      errors.push('❌ Unsubscribe controller does not verify token');
    }
    if (!unsubscribeController.includes('shopId') || !unsubscribeController.includes('contactId')) {
      warnings.push('⚠️  Unsubscribe controller may not properly scope by shopId');
    }
  }

  console.log(`   ✅ Unsubscribe routes check complete (${errors.length} errors, ${warnings.length} warnings)`);
}

/**
 * Check 6: Frontend shop domain resolution
 */
function checkFrontendShopDomain() {
  console.log('🔍 Checking frontend shop domain resolution...');
  
  const shopDomainFile = readFile(join(ROOT, 'apps/astronote-web/src/lib/shopify/api/shop-domain.ts'));
  if (!shopDomainFile) {
    errors.push('❌ Cannot read shop-domain.ts');
    return;
  }

  // Check that resolveShopDomain prioritizes token
  if (!shopDomainFile.includes('decodeJWT') || !shopDomainFile.includes('payload?.shopDomain')) {
    errors.push('❌ shop-domain.ts does not properly decode JWT token for shopDomain');
  }

  // Check that URL param is only used for redirect routes
  if (!shopDomainFile.includes('isRedirectRoute') && !shopDomainFile.includes('/auth/callback')) {
    warnings.push('⚠️  shop-domain.ts may not properly restrict URL param usage');
  }

  console.log(`   ✅ Frontend shop domain check complete (${errors.length} errors, ${warnings.length} warnings)`);
}

/**
 * Main audit function
 */
function runAudit() {
  console.log('🚀 Starting Shopify E2E Audit...\n');

  checkProtectedRoutes();
  checkPublicRoutes();
  checkPrismaFields();
  checkFrontendApiUsage();
  checkUnsubscribeRoutes();
  checkFrontendShopDomain();

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

