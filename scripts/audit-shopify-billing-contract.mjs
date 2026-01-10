#!/usr/bin/env node

/**
 * Audit script for Shopify billing contract
 * Verifies backend endpoints exist and billing summary contains key fields.
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

console.log('🔍 Auditing Shopify billing contract...\n');

// 1) Check routes
console.log('1. Checking route registration...');
const billingRoutesPath = join(rootDir, 'apps/shopify-api/routes/billing.js');
if (checkFileExists(billingRoutesPath, 'Billing routes')) {
  checkFileContains(billingRoutesPath, '/summary', 'GET /billing/summary');
  checkFileContains(billingRoutesPath, '/packages', 'GET /billing/packages');
  checkFileContains(billingRoutesPath, '/purchase', 'POST /billing/purchase');
  checkFileContains(billingRoutesPath, '/balance', 'GET /billing/balance');
  checkFileContains(billingRoutesPath, '/history', 'GET /billing/history');
}

const subscriptionsRoutesPath = join(
  rootDir,
  'apps/shopify-api/routes/subscriptions.js',
);
if (checkFileExists(subscriptionsRoutesPath, 'Subscriptions routes')) {
  checkFileContains(subscriptionsRoutesPath, '/switch', 'POST /subscriptions/switch');
  checkFileContains(subscriptionsRoutesPath, '/cancel', 'POST /subscriptions/cancel');
  checkFileContains(subscriptionsRoutesPath, '/portal', 'GET /subscriptions/portal');
}

// 2) Check billing summary shape
console.log('2. Checking billing summary shape...');
const subscriptionServicePath = join(
  rootDir,
  'apps/shopify-api/services/subscription.js',
);
if (checkFileExists(subscriptionServicePath, 'Subscription service')) {
  checkFileContains(
    subscriptionServicePath,
    'getBillingSummary',
    'getBillingSummary function',
  );
  checkFileContains(
    subscriptionServicePath,
    'subscription',
    'subscription key in summary',
  );
  checkFileContains(
    subscriptionServicePath,
    'allowance',
    'allowance key in summary',
  );
  checkFileContains(
    subscriptionServicePath,
    'credits',
    'credits key in summary',
  );
  checkFileContains(
    subscriptionServicePath,
    'billingCurrency',
    'billingCurrency key in summary',
    false,
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
