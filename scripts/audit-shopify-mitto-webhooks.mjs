#!/usr/bin/env node

/**
 * Shopify Mitto Webhooks Parity Audit Script
 * Verifies webhook handler matches Retail behavior
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
 * Check webhook endpoint exists and is public
 */
function checkWebhookEndpoint() {
  console.log('\n📋 Checking Webhook Endpoint...');
  console.log('='.repeat(60));

  const routes = readFile(join(SHOPIFY_API, 'routes/mitto-webhooks.js'));
  const appJs = readFile(join(SHOPIFY_API, 'app.js'));

  // Check route exists
  if (routes && /\/webhooks\/mitto\/dlr/.test(routes)) {
    pass('Mitto DLR webhook route exists');
  } else if (appJs && /\/webhooks\/mitto\/dlr/.test(appJs)) {
    pass('Mitto DLR webhook route exists (in app.js)');
  } else {
    error('Mitto DLR webhook route not found');
  }

  // Check it's public (no resolveStore/requireStore)
  if (routes && !/resolveStore|requireStore/.test(routes)) {
    pass('Webhook endpoint is public (no tenant auth required)');
  } else if (appJs && !/\/webhooks\/mitto.*resolveStore|requireStore/.test(appJs)) {
    pass('Webhook endpoint is public (no tenant auth required)');
  } else {
    error('Webhook endpoint requires tenant auth (should be public)');
  }
}

/**
 * Check signature verification exists
 */
function checkSignatureVerification() {
  console.log('\n📋 Checking Signature Verification...');
  console.log('='.repeat(60));

  const mittoController = readFile(join(SHOPIFY_API, 'controllers/mitto.js'));
  if (!mittoController) {
    error('Mitto controller not found');
    return;
  }

  // Check signature verification
  if (/verifyMittoSignature|verifyWebhook/.test(mittoController)) {
    pass('Webhook handler has signature verification');
  } else {
    error('Webhook handler missing signature verification');
  }

  // Check it's called before processing
  if (/verifyMittoSignature.*req\)|verifyWebhook.*req\)/.test(mittoController)) {
    pass('Signature verification is called before processing');
  } else {
    error('Signature verification may not be called before processing');
  }
}

/**
 * Check dedup/replay protection exists
 */
function checkDedupProtection() {
  console.log('\n📋 Checking Dedup/Replay Protection...');
  console.log('='.repeat(60));

  const mittoController = readFile(join(SHOPIFY_API, 'controllers/mitto.js'));
  if (!mittoController) {
    error('Mitto controller not found');
    return;
  }

  // Check webhook replay protection
  if (/webhookReplay|webhook-replay|checkWebhookReplay/.test(mittoController)) {
    pass('Webhook handler has replay protection');
  } else {
    warn('Webhook handler may not have replay protection');
  }
}

/**
 * Check deliveryStatus is updated
 */
function checkDeliveryStatusUpdate() {
  console.log('\n📋 Checking Delivery Status Updates...');
  console.log('='.repeat(60));

  const mittoController = readFile(join(SHOPIFY_API, 'controllers/mitto.js'));
  if (!mittoController) {
    error('Mitto controller not found');
    return;
  }

  // Check deliveryStatus is updated
  if (/deliveryStatus.*statusIn/.test(mittoController)) {
    pass('Webhook updates deliveryStatus field');
  } else {
    error('Webhook does not update deliveryStatus');
  }

  // Check status is updated
  if (/status.*newStatus|status.*sent|status.*failed/.test(mittoController)) {
    pass('Webhook updates recipient status');
  } else {
    error('Webhook does not update recipient status');
  }

  // Check failedAt is set
  if (/failedAt.*doneAt/.test(mittoController)) {
    pass('Webhook sets failedAt when delivery fails');
  } else {
    error('Webhook does not set failedAt');
  }
}

/**
 * Check tenant safety
 */
function checkTenantSafety() {
  console.log('\n📋 Checking Tenant Safety...');
  console.log('='.repeat(60));

  const mittoController = readFile(join(SHOPIFY_API, 'controllers/mitto.js'));
  if (!mittoController) {
    error('Mitto controller not found');
    return;
  }

  // Check shopId validation
  if (/shopId.*recipient|shopId.*campaign/.test(mittoController)) {
    pass('Webhook validates shopId for tenant safety');
  } else {
    warn('Webhook may not validate shopId');
  }
}

/**
 * Main execution
 */
async function runAudit() {
  console.log('🚀 Shopify Mitto Webhooks Parity Audit');
  console.log('='.repeat(60));

  checkWebhookEndpoint();
  checkSignatureVerification();
  checkDedupProtection();
  checkDeliveryStatusUpdate();
  checkTenantSafety();

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

