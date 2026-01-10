#!/usr/bin/env node

/**
 * Audit script for Shopify subscription gating
 * Verifies:
 * 1) Campaign enqueue routes enforce SUBSCRIPTION_REQUIRED
 * 2) Subscription check happens before credit check
 * 3) Error code is SUBSCRIPTION_REQUIRED (not INACTIVE_SUBSCRIPTION)
 * 4) Gating is enforced at both enqueue and worker level
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const errors = [];
const warnings = [];

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

console.log('🔍 Auditing Shopify subscription gating...\n');

// 1) Check subscription gating in campaigns service
console.log('1. Checking campaigns service...');
const campaignsServicePath = join(rootDir, 'apps/shopify-api/services/campaigns.js');
if (checkFileContains(campaignsServicePath, 'isSubscriptionActive', 'Subscription check function call')) {
  // Check that subscription check happens before credit check
  const content = readFileSync(campaignsServicePath, 'utf-8');
  const subscriptionCheckIndex = content.indexOf('isSubscriptionActive');
  const creditCheckIndex = content.indexOf('getAvailableBalance') || content.indexOf('reserveCredits');
  
  if (subscriptionCheckIndex !== -1 && creditCheckIndex !== -1) {
    if (subscriptionCheckIndex > creditCheckIndex) {
      warnings.push('Subscription check should happen before credit check in campaigns service');
    }
  }
  
  // Check error reason
  checkFileContains(
    campaignsServicePath,
    'subscription_required',
    'subscription_required error reason',
  );
}

// 2) Check controller returns correct error code
console.log('2. Checking campaigns controller...');
const campaignsControllerPath = join(rootDir, 'apps/shopify-api/controllers/campaigns.js');
checkFileContains(
  campaignsControllerPath,
  'SUBSCRIPTION_REQUIRED',
  'SUBSCRIPTION_REQUIRED error code',
);
checkFileContains(
  campaignsControllerPath,
  '403',
  '403 status code for subscription required',
);

// 3) Check subscription service has isSubscriptionActive
console.log('3. Checking subscription service...');
const subscriptionServicePath = join(rootDir, 'apps/shopify-api/services/subscription.js');
checkFileContains(
  subscriptionServicePath,
  'isSubscriptionActive',
  'isSubscriptionActive function',
);

// 4) Check worker-level gating (bulk send)
console.log('4. Checking worker gating...');
const smsBulkPath = join(rootDir, 'apps/shopify-api/services/smsBulk.js');
checkFileContains(
  smsBulkPath,
  'isSubscriptionActive',
  'Subscription check in bulk SMS send',
);
const creditValidationPath = join(rootDir, 'apps/shopify-api/services/credit-validation.js');
checkFileContains(
  creditValidationPath,
  'SubscriptionRequiredError',
  'Subscription gating in credit validation',
);
const automationTriggersPath = join(rootDir, 'apps/shopify-api/queue/jobs/automationTriggers.js');
checkFileContains(
  automationTriggersPath,
  'SubscriptionRequiredError',
  'Automation gating for subscription required',
);

// 5) Check allowance consumption logic
console.log('5. Checking allowance consumption...');
const subscriptionServicePath2 = join(rootDir, 'apps/shopify-api/services/subscription.js');
checkFileContains(
  subscriptionServicePath2,
  'trackSmsUsage|usedSmsThisPeriod',
  'SMS usage tracking',
);

// 6) Check campaigns service consumes allowance before credits
console.log('6. Checking consumption order...');
const campaignsServicePath2 = join(rootDir, 'apps/shopify-api/services/campaigns.js');
const content = readFileSync(campaignsServicePath2, 'utf-8');

// Find the enqueueCampaign function and check order within it
const enqueueFunctionMatch = content.match(/export\s+async\s+function\s+enqueueCampaign[\s\S]*?(?=\n\s*export|\n\s*\/\/|$)/);
if (enqueueFunctionMatch) {
  const functionBody = enqueueFunctionMatch[0];
  
  // Find where allowance is calculated (not just imported)
  const allowanceCalculationMatch = functionBody.match(/const\s+remainingAllowance[\s\S]*?=/);
  const allowanceCalculationIndex = allowanceCalculationMatch ? functionBody.indexOf(allowanceCalculationMatch[0]) : -1;
  
  // Find where credits are reserved (actual call, not import)
  const creditReserveCallMatch = functionBody.match(/await\s+reserveCredits\(/);
  const creditReserveCallIndex = creditReserveCallMatch ? functionBody.indexOf(creditReserveCallMatch[0]) : -1;
  
  // Find creditsToReserve calculation
  const creditsToReserveMatch = functionBody.match(/const\s+creditsToReserve[\s\S]*?=/);
  const creditsToReserveIndex = creditsToReserveMatch ? functionBody.indexOf(creditsToReserveMatch[0]) : -1;
  
  // Allowance should be calculated before credit reservation call
  if (allowanceCalculationIndex !== -1 && creditReserveCallIndex !== -1) {
    if (allowanceCalculationIndex > creditReserveCallIndex) {
      warnings.push('Allowance should be calculated before credits are reserved in campaigns service');
    }
  }
  
  // creditsToReserve should be calculated after allowance
  if (creditsToReserveIndex !== -1 && allowanceCalculationIndex !== -1) {
    if (creditsToReserveIndex < allowanceCalculationIndex) {
      warnings.push('creditsToReserve should be calculated after allowance check');
    }
  }
} else {
  warnings.push('Could not find enqueueCampaign function to check consumption order');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('AUDIT SUMMARY');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ PASS: All checks passed');
  process.exit(0);
} else {
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
}
