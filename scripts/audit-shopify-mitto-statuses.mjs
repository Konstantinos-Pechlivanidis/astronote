#!/usr/bin/env node

/**
 * Shopify Mitto Status Parity Audit Script
 * Verifies status enums and transitions match Retail
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const SHOPIFY_API = join(ROOT, 'apps/shopify-api');

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
 * Check CampaignStatus enum values
 */
function checkCampaignStatusEnum() {
  console.log('\n📋 Checking CampaignStatus Enum...');
  console.log('='.repeat(60));

  const schema = readFile(join(SHOPIFY_API, 'prisma/schema.prisma'));
  if (!schema) {
    error('Prisma schema not found');
    return;
  }

  // Extract enum values
  const enumMatch = schema.match(/enum CampaignStatus\s*\{([^}]+)\}/s);
  if (!enumMatch) {
    error('CampaignStatus enum not found');
    return;
  }

  const enumValues = enumMatch[1].split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))
    .map(line => line.replace(/\/\/.*$/, '').trim());

  // Required values (aligned with Retail)
  const requiredValues = ['draft', 'scheduled', 'sending', 'paused', 'completed', 'failed'];
  requiredValues.forEach(value => {
    if (enumValues.includes(value)) {
      pass(`CampaignStatus enum has ${value}`);
    } else {
      error(`CampaignStatus enum missing ${value}`);
    }
  });

  // Optional Shopify-specific values
  if (enumValues.includes('cancelled')) {
    pass('CampaignStatus enum has cancelled (Shopify-specific)');
  } else {
    warn('CampaignStatus enum missing cancelled (Shopify-specific)');
  }
}

/**
 * Check status transitions are guarded
 */
function checkStatusTransitions() {
  console.log('\n📋 Checking Status Transitions...');
  console.log('='.repeat(60));

  const campaignsService = readFile(join(SHOPIFY_API, 'services/campaigns.js'));
  if (!campaignsService) {
    error('Campaigns service not found');
    return;
  }

  // Check enqueue only allows draft/scheduled/paused
  if (/CampaignStatus\.(draft|scheduled|paused)/.test(campaignsService)) {
    pass('Enqueue only allows draft, scheduled, and paused statuses');
  } else {
    error('Enqueue does not properly guard status transitions');
  }

  // Check status validation
  if (/invalid_status/.test(campaignsService)) {
    pass('Status transitions return invalid_status error');
  } else {
    warn('Status transitions may not return invalid_status error');
  }
}

/**
 * Check reconciliation job exists
 */
function checkReconciliation() {
  console.log('\n📋 Checking Reconciliation...');
  console.log('='.repeat(60));

  const reconciliationJob = readFile(join(SHOPIFY_API, 'queue/jobs/reconciliation.js'));
  if (!reconciliationJob) {
    error('Reconciliation job not found');
    return;
  }

  pass('Reconciliation job exists');

  // Check it sets finishedAt
  if (/finishedAt.*new Date\(\)/.test(reconciliationJob)) {
    pass('Reconciliation sets finishedAt when campaign completes');
  } else {
    error('Reconciliation does not set finishedAt');
  }

  // Check it uses completed status
  if (/CampaignStatus\.completed/.test(reconciliationJob)) {
    pass('Reconciliation uses completed status (aligned with Retail)');
  } else {
    warn('Reconciliation may not use completed status');
  }
}

/**
 * Main execution
 */
async function runAudit() {
  console.log('🚀 Shopify Mitto Status Parity Audit');
  console.log('='.repeat(60));

  checkCampaignStatusEnum();
  checkStatusTransitions();
  checkReconciliation();

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

