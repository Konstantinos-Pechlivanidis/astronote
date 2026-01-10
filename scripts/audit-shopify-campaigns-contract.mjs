#!/usr/bin/env node

/**
 * Audit script for Shopify campaigns backend contract
 * Verifies required routes, tenant scoping, and key schema fields exist.
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

console.log('🔍 Auditing Shopify campaigns backend contract...\n');

// 1) Ensure campaigns routes exist and are mounted with tenant scoping
console.log('1. Checking campaigns route registration...');
const appPath = join(rootDir, 'apps/shopify-api/app.js');
if (checkFileExists(appPath, 'Shopify API app')) {
  // Check for campaigns route mounting (flexible pattern)
  const content = readFileSync(appPath, 'utf-8');
  if (/campaigns.*resolveStore|resolveStore.*campaigns/.test(content) || /\/campaigns/.test(content)) {
    // Routes exist, check if tenant scoping middleware is present
    if (/resolveStore|requireStore/.test(content)) {
      // Tenant scoping middleware exists
    } else {
      warnings.push('Campaigns routes may not use tenant scoping middleware');
    }
  } else {
    errors.push('Campaigns routes not found in app.js');
  }
}

// 2) Ensure campaigns endpoints exist
console.log('2. Checking campaigns endpoints...');
const routesPath = join(rootDir, 'apps/shopify-api/routes/campaigns.js');
if (checkFileExists(routesPath, 'Campaigns routes file')) {
  checkFileContains(routesPath, "r\\.get\\s*\\(\\s*['\"]/['\"]", 'GET /campaigns list route');
  checkFileContains(routesPath, "r\\.post\\s*\\(\\s*['\"]/['\"]", 'POST /campaigns create route');
  checkFileContains(
    routesPath,
    "stats/summary",
    'GET /campaigns/stats/summary route',
  );
}

// 3) Ensure list query schema supports pagination
console.log('3. Checking list query schema...');
const schemaPath = join(rootDir, 'apps/shopify-api/schemas/campaigns.schema.js');
if (checkFileExists(schemaPath, 'Campaigns schema file')) {
  checkFileContains(schemaPath, 'listCampaignsQuerySchema', 'List query schema');
  checkFileContains(schemaPath, 'page:', 'List query includes page');
  checkFileContains(schemaPath, 'pageSize:', 'List query includes pageSize');
  checkFileContains(schemaPath, 'sortBy', 'List query includes sortBy');
  checkFileContains(schemaPath, 'sortOrder', 'List query includes sortOrder');
}

// 4) Ensure create schema includes schedule fields
console.log('4. Checking create schema fields...');
if (checkFileExists(schemaPath, 'Campaigns schema file')) {
  checkFileContains(schemaPath, 'scheduleType', 'Create schema includes scheduleType');
  checkFileContains(schemaPath, 'scheduleAt', 'Create schema includes scheduleAt');
}

// 5) Ensure auxiliary endpoints used by create page exist
console.log('5. Checking auxiliary endpoints...');
const audiencesPath = join(rootDir, 'apps/shopify-api/routes/audiences.js');
if (checkFileExists(audiencesPath, 'Audiences routes file')) {
  checkFileContains(audiencesPath, "r\\.get\\s*\\(\\s*['\"]/['\"]", 'GET /audiences list route');
}
const shopifyRoutesPath = join(rootDir, 'apps/shopify-api/routes/shopify.js');
if (checkFileExists(shopifyRoutesPath, 'Shopify routes file')) {
  checkFileContains(
    shopifyRoutesPath,
    "discounts",
    'Shopify discounts routes present (/shopify/discounts)',
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
