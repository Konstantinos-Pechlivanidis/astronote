#!/usr/bin/env node
/**
 * Build Verification Script
 * Verifies that workspace packages build correctly
 * Only targets: astronote-web, retail-api, shopify-api
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Verifying workspace builds...\n');

const results = {
  web: { success: false, error: null },
  retail: { success: false, error: null },
  shopify: { success: false, error: null },
};

// 1. Frontend Build (astronote-web)
console.log('1. Building frontend (apps/astronote-web)...');
try {
  execSync('npm run build', {
    cwd: join(rootDir, 'apps/astronote-web'),
    stdio: 'inherit',
  });
  results.web.success = true;
  console.log('   ✅ Frontend build successful\n');
} catch (error) {
  results.web.success = false;
  results.web.error = error.message;
  console.log(`   ❌ Frontend build failed: ${error.message}\n`);
}

// 2. Retail API Build (Prisma generation)
console.log('2. Building retail-api (apps/retail-api)...');
try {
  execSync('npm run build', {
    cwd: join(rootDir, 'apps/retail-api'),
    stdio: 'inherit',
  });
  results.retail.success = true;
  console.log('   ✅ Retail API build successful\n');
} catch (error) {
  results.retail.success = false;
  results.retail.error = error.message;
  console.log(`   ❌ Retail API build failed: ${error.message}\n`);
}

// 3. Shopify API Build (Prisma generation)
console.log('3. Building shopify-api (apps/shopify-api)...');
try {
  execSync('npm run build', {
    cwd: join(rootDir, 'apps/shopify-api'),
    stdio: 'inherit',
  });
  results.shopify.success = true;
  console.log('   ✅ Shopify API build successful\n');
} catch (error) {
  results.shopify.success = false;
  results.shopify.error = error.message;
  console.log(`   ❌ Shopify API build failed: ${error.message}\n`);
}

// Summary
console.log('📊 Build Verification Summary:');
console.log(`   Frontend (astronote-web): ${results.web.success ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Retail API:                ${results.retail.success ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Shopify API:               ${results.shopify.success ? '✅ PASS' : '❌ FAIL'}`);

if (results.web.success && results.retail.success && results.shopify.success) {
  console.log('\n✅ All workspace builds verified successfully!');
  process.exit(0);
} else {
  console.log('\n❌ Some builds failed. See errors above.');
  process.exit(1);
}
