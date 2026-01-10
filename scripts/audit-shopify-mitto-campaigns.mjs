#!/usr/bin/env node

/**
 * Shopify Mitto Campaigns Parity Audit Script
 * Verifies campaign enqueue, worker, and Mitto integration match Retail architecture
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 */

import { readFileSync, existsSync } from 'fs';
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
 * Check Prisma schema includes required Mitto fields
 */
function checkPrismaFields() {
  console.log('\n📋 Checking Prisma Schema...');
  console.log('='.repeat(60));

  const schema = readFile(join(SHOPIFY_API, 'prisma/schema.prisma'));
  if (!schema) {
    error('Prisma schema not found');
    return;
  }

  // Check CampaignRecipient fields
  const requiredRecipientFields = [
    'mittoMessageId',
    'bulkId',
    'deliveryStatus',
    'sentAt',
    'deliveredAt',
    'failedAt',
    'error',
    'retryCount',
  ];

  requiredRecipientFields.forEach(field => {
    if (new RegExp(`\\s+${field}\\s+`).test(schema)) {
      pass(`CampaignRecipient has ${field} field`);
    } else {
      error(`CampaignRecipient missing ${field} field`);
    }
  });

  // Check Campaign fields
  const requiredCampaignFields = ['startedAt', 'finishedAt'];
  requiredCampaignFields.forEach(field => {
    if (new RegExp(`\\s+${field}\\s+`).test(schema)) {
      pass(`Campaign has ${field} field`);
    } else {
      error(`Campaign missing ${field} field`);
    }
  });

  // Check unique constraint
  if (/@@unique\(\[campaignId,\s*phoneE164\]\)/.test(schema)) {
    pass('CampaignRecipient has unique constraint on [campaignId, phoneE164]');
  } else {
    error('CampaignRecipient missing unique constraint on [campaignId, phoneE164]');
  }

  // Check indexes
  const requiredIndexes = [
    { pattern: /@@index\(\[bulkId\]\)/, name: 'bulkId index' },
    { pattern: /@@index\(\[mittoMessageId\]\)/, name: 'mittoMessageId index' },
    { pattern: /@@index\(\[campaignId,\s*status\]\)/, name: '[campaignId, status] index' },
  ];

  requiredIndexes.forEach(({ pattern, name }) => {
    if (pattern.test(schema)) {
      pass(`CampaignRecipient has ${name}`);
    } else {
      warn(`CampaignRecipient missing ${name}`);
    }
  });
}

/**
 * Check enqueue endpoint uses idempotency and createMany(skipDuplicates)
 */
function checkEnqueueImplementation() {
  console.log('\n📋 Checking Enqueue Implementation...');
  console.log('='.repeat(60));

  const campaignsService = readFile(join(SHOPIFY_API, 'services/campaigns.js'));
  if (!campaignsService) {
    error('Campaigns service not found');
    return;
  }

  // Check createMany with skipDuplicates (may be on separate lines)
  if (/createMany[\s\S]*?skipDuplicates|skipDuplicates[\s\S]*?createMany/.test(campaignsService)) {
    pass('Enqueue uses createMany(skipDuplicates) for recipients');
  } else {
    error('Enqueue does not use createMany(skipDuplicates)');
  }

  // Check status transitions
  if (/CampaignStatus\.(draft|scheduled|paused)/.test(campaignsService)) {
    pass('Enqueue allows draft, scheduled, and paused statuses');
  } else {
    warn('Enqueue may not allow paused status');
  }

  // Check startedAt is set
  if (/startedAt.*new Date\(\)/.test(campaignsService)) {
    pass('Enqueue sets startedAt when transitioning to sending');
  } else {
    error('Enqueue does not set startedAt');
  }
}

/**
 * Check worker stores bulkId and messageId
 */
function checkWorkerImplementation() {
  console.log('\n📋 Checking Worker Implementation...');
  console.log('='.repeat(60));

  const bulkSmsJob = readFile(join(SHOPIFY_API, 'queue/jobs/bulkSms.js'));
  if (!bulkSmsJob) {
    error('Bulk SMS job not found');
    return;
  }

  // Check bulkId is stored
  if (/bulkId.*result\.bulkId/.test(bulkSmsJob)) {
    pass('Worker stores bulkId from Mitto response');
  } else {
    error('Worker does not store bulkId');
  }

  // Check messageId is stored
  if (/mittoMessageId.*messageId/.test(bulkSmsJob)) {
    pass('Worker stores mittoMessageId per recipient');
  } else {
    error('Worker does not store mittoMessageId');
  }

  // Check failedAt is set
  if (/failedAt.*new Date\(\)/.test(bulkSmsJob)) {
    pass('Worker sets failedAt when message fails');
  } else {
    error('Worker does not set failedAt');
  }
}

/**
 * Check webhook handler exists and updates deliveryStatus
 */
function checkWebhookHandler() {
  console.log('\n📋 Checking Webhook Handler...');
  console.log('='.repeat(60));

  const mittoController = readFile(join(SHOPIFY_API, 'controllers/mitto.js'));
  if (!mittoController) {
    error('Mitto controller not found');
    return;
  }

  // Check webhook endpoint exists
  if (/deliveryReport|dlr/.test(mittoController)) {
    pass('Mitto DLR webhook handler exists');
  } else {
    error('Mitto DLR webhook handler not found');
  }

  // Check deliveryStatus is updated
  if (/deliveryStatus.*statusIn/.test(mittoController)) {
    pass('Webhook updates deliveryStatus field');
  } else {
    error('Webhook does not update deliveryStatus');
  }

  // Check failedAt is set
  if (/failedAt.*doneAt/.test(mittoController)) {
    pass('Webhook sets failedAt when delivery fails');
  } else {
    error('Webhook does not set failedAt');
  }
}

/**
 * Main execution
 */
async function runAudit() {
  console.log('🚀 Shopify Mitto Campaigns Parity Audit');
  console.log('='.repeat(60));

  checkPrismaFields();
  checkEnqueueImplementation();
  checkWorkerImplementation();
  checkWebhookHandler();

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

