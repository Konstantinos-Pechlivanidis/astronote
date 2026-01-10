#!/usr/bin/env node

/**
 * Audit script for Shopify campaigns frontend usage
 * Verifies:
 * 1) Centralized campaigns API wrapper exists and uses Shopify API client
 * 2) Shopify campaign hooks import the wrapper (no direct legacy client)
 * 3) Campaigns list/create pages avoid direct axios/fetch
 * 4) Idempotency headers are present in enqueue/retry calls
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
  const regex = new RegExp(pattern, 'm');
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
  const regex = new RegExp(pattern, 'm');
  if (regex.test(content)) {
    errors.push(`Found forbidden usage in ${filePath}: ${description}`);
    return false;
  }
  return true;
}

function checkFileContainsRegex(filePath, pattern, description, isError = true) {
  if (!existsSync(filePath)) {
    if (isError) {
      errors.push(`File not found: ${filePath}`);
    }
    return false;
  }
  const content = readFileSync(filePath, 'utf-8');
  const regex = new RegExp(pattern, 'm');
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

console.log('🔍 Auditing Shopify campaigns frontend usage...\n');

// 1) Wrapper exists and uses Shopify API client
console.log('1. Checking campaigns wrapper...');
const wrapperPath = join(rootDir, 'apps/astronote-web/src/lib/shopify/api/campaigns.ts');
if (checkFileExists(wrapperPath, 'Shopify campaigns API wrapper')) {
  checkFileContainsRegex(wrapperPath, 'shopify/api/axios|shopifyApi', 'Shopify API client usage');
  checkFileContains(wrapperPath, 'Idempotency-Key', 'Idempotency header usage');
  checkFileContainsRegex(wrapperPath, 'listCampaigns|campaignsApi', 'List campaigns function');
  checkFileContainsRegex(wrapperPath, 'createCampaign|campaignsApi', 'Create campaign function');
}

// 2) Hooks import wrapper (use centralized API client)
console.log('2. Checking campaigns hooks import wrapper...');
const hookFiles = [
  'apps/astronote-web/src/features/shopify/campaigns/hooks/useCampaigns.ts',
  'apps/astronote-web/src/features/shopify/campaigns/hooks/useCampaignStats.ts',
  'apps/astronote-web/src/features/shopify/campaigns/hooks/useCampaignMutations.ts',
];

hookFiles.forEach((relativePath) => {
  const fullPath = join(rootDir, relativePath);
  if (checkFileExists(fullPath, relativePath)) {
    checkFileContainsRegex(
      fullPath,
      'shopify/api/campaigns|campaignsApi',
      'Import from centralized campaigns API',
    );
    checkFileNotContains(
      fullPath,
      'axios\\.(get|post|put|delete)|fetch\\s*\\(',
      'Direct axios/fetch usage (should use campaignsApi)',
    );
  }
});

// 3) Ensure list/create pages use hooks (not direct API calls)
console.log('3. Checking list/create pages use hooks...');
const listPagePath = join(
  rootDir,
  'apps/astronote-web/app/app/shopify/campaigns/page.tsx',
);
const createPagePath = join(
  rootDir,
  'apps/astronote-web/app/app/shopify/campaigns/new/page.tsx',
);

if (checkFileExists(listPagePath, 'List page')) {
  checkFileContains(listPagePath, 'useCampaigns', 'List page uses useCampaigns hook');
  checkFileNotContains(listPagePath, 'axios\\.(get|post|put|delete)|fetch\\s*\\(', 'Direct axios/fetch usage');
}

if (checkFileExists(createPagePath, 'Create page')) {
  checkFileContains(createPagePath, 'useCreateCampaign', 'Create page uses useCreateCampaign hook');
  checkFileNotContains(createPagePath, 'axios\\.(get|post|put|delete)|fetch\\s*\\(', 'Direct axios/fetch usage');
}

// 4) Verify tenant header injection path exists
console.log('4. Checking tenant header injection...');
const axiosPath = join(rootDir, 'apps/astronote-web/src/lib/shopify/api/axios.ts');
if (checkFileExists(axiosPath, 'Shopify API axios instance')) {
  checkFileContains(axiosPath, 'X-Shopify-Shop-Domain', 'X-Shopify-Shop-Domain header injection');
  checkFileContains(axiosPath, 'Authorization.*Bearer', 'Authorization Bearer header injection');
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
