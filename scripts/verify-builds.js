#!/usr/bin/env node
/**
 * Build Verification Script
 * Verifies that both frontend and backend build processes work correctly
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Verifying build commands...\n');

const results = {
  frontend: { success: false, error: null },
  backend: { success: false, error: null },
};

// 1. Frontend Build (Vite)
console.log('1. Building frontend (apps/web)...');
try {
  execSync('npm run build', {
    cwd: join(rootDir, 'apps/web'),
    stdio: 'inherit',
  });
  results.frontend.success = true;
  console.log('   ✅ Frontend build successful\n');
} catch (error) {
  results.frontend.success = false;
  results.frontend.error = error.message;
  console.log(`   ❌ Frontend build failed: ${error.message}\n`);
}

// 2. Backend Prisma Generation (equivalent to build)
console.log('2. Generating Prisma client (apps/shopify-api)...');
try {
  execSync('npm run prisma:generate', {
    cwd: join(rootDir, 'apps/shopify-api'),
    stdio: 'inherit',
  });
  results.backend.success = true;
  console.log('   ✅ Prisma client generation successful\n');
} catch (error) {
  results.backend.success = false;
  results.backend.error = error.message;
  console.log(`   ❌ Prisma client generation failed: ${error.message}\n`);
}

// Summary
console.log('📊 Build Verification Summary:');
console.log(`   Frontend: ${results.frontend.success ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Backend:  ${results.backend.success ? '✅ PASS' : '❌ FAIL'}`);

if (results.frontend.success && results.backend.success) {
  console.log('\n✅ All builds verified successfully!');
  process.exit(0);
} else {
  console.log('\n❌ Some builds failed. See errors above.');
  process.exit(1);
}

