#!/usr/bin/env node

/**
 * Audit script for Shopify billing frontend usage
 * Verifies:
 * 1) Billing page uses billing hooks (no direct axios/fetch)
 * 2) Billing hooks import the centralized Shopify billing wrapper
 * 3) Wrapper uses Shopify API client (tenant headers)
 * 4) Switch/cancel/portal actions are wired in the billing page
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const errors = [];
const warnings = [];

function checkFileExists(path, description) {
  if (!existsSync(path)) {
    errors.push(`Missing: ${description} (${path})`);
    return false;
  }
  return true;
}

function checkFileContains(filePath, pattern, description, isError = true) {
  if (!existsSync(filePath)) {
    if (isError) {
      errors.push(`File not found: ${filePath}`);
    }
    return false;
  }
  const content = readFileSync(filePath, 'utf-8');
  const regex = new RegExp(pattern, 'i');
  if (!regex.test(content)) {
    if (isError) {
      errors.push(`Missing in ${filePath}: ${description}`);
    } else {
      warnings.push(`Missing in ${filePath}: ${description}`);
    }
    return false;
  }
  return true;
}

function checkFileNotContains(filePath, pattern, description) {
  if (!existsSync(filePath)) {
    errors.push(`File not found: ${filePath}`);
    return false;
  }
  const content = readFileSync(filePath, 'utf-8');
  const regex = new RegExp(pattern, 'i');
  if (regex.test(content)) {
    errors.push(`Found forbidden usage in ${filePath}: ${description}`);
    return false;
  }
  return true;
}

console.log('🔍 Auditing Shopify billing frontend usage...\n');

// 1) Check wrapper exists and uses Shopify API client
console.log('1. Checking billing wrapper...');
const wrapperPath = join(rootDir, 'apps/astronote-web/src/lib/shopifyBillingApi.ts');
if (checkFileExists(wrapperPath, 'Shopify billing wrapper')) {
  checkFileContains(
    wrapperPath,
    'shopify/api/axios',
    'Shopify API client usage',
  );
}

// 2) Ensure hooks use wrapper (not direct API file)
console.log('2. Checking billing hooks import wrapper...');
const hookFiles = [
  'apps/astronote-web/src/features/shopify/billing/hooks/useBillingSummary.ts',
  'apps/astronote-web/src/features/shopify/billing/hooks/useBillingBalance.ts',
  'apps/astronote-web/src/features/shopify/billing/hooks/useBillingPackages.ts',
  'apps/astronote-web/src/features/shopify/billing/hooks/useBillingHistory.ts',
  'apps/astronote-web/src/features/shopify/billing/hooks/useBillingMutations.ts',
  'apps/astronote-web/src/features/shopify/billing/hooks/useCalculateTopup.ts',
  'apps/astronote-web/src/features/shopify/billing/hooks/useSubscriptionStatus.ts',
  'apps/astronote-web/src/features/shopify/billing/hooks/useSubscriptionMutations.ts',
];

hookFiles.forEach((relativePath) => {
  const fullPath = join(rootDir, relativePath);
  if (checkFileExists(fullPath, relativePath)) {
    checkFileContains(
      fullPath,
      'shopifyBillingApi',
      'Import from shopifyBillingApi',
    );
    checkFileNotContains(
      fullPath,
      'shopify/api/billing',
      'Direct import of legacy billing client',
    );
  }
});

// 3) Ensure billing page avoids direct axios/fetch calls
console.log('3. Checking billing page usage...');
const billingPagePath = join(
  rootDir,
  'apps/astronote-web/app/app/shopify/billing/page.tsx',
);
if (checkFileExists(billingPagePath, 'Shopify billing page')) {
  checkFileNotContains(
    billingPagePath,
    'axios|fetch\\(',
    'Direct axios/fetch usage',
  );
  checkFileNotContains(
    billingPagePath,
    'shopify/api/billing',
    'Direct billing API client import',
  );
  checkFileContains(
    billingPagePath,
    'useSwitchInterval',
    'Switch interval action hook',
  );
  checkFileContains(
    billingPagePath,
    'useCancelSubscription',
    'Cancel subscription action hook',
  );
  checkFileContains(
    billingPagePath,
    'useGetPortal',
    'Portal action hook',
  );
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('AUDIT SUMMARY');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ PASS: All checks passed');
  process.exit(0);
}

if (errors.length > 0) {
  console.log(`\n❌ ERRORS (${errors.length}):`);
  errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
}
if (warnings.length > 0) {
  console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
  warnings.forEach((warn, i) => console.log(`  ${i + 1}. ${warn}`));
}
console.log('\n❌ FAIL: Some checks failed');
process.exit(1);
