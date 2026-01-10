#!/usr/bin/env node

/**
 * Shopify Campaigns Audit Script
 * Verifies campaign endpoints and functionality are complete
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
const SHOPIFY_FRONTEND = join(ROOT, 'apps/astronote-web');

let errors = [];
let warnings = [];

function error(msg) {
  errors.push(msg);
  console.error(`❌ ERROR: ${msg}`);
}

function warn(msg) {
  warnings.push(msg);
  console.warn(`⚠️  WARNING: ${msg}`);
}

function pass(msg) {
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
 * Check campaign endpoints exist
 */
function checkCampaignEndpoints() {
  console.log('\n📋 Checking Campaign Endpoints...');
  console.log('='.repeat(60));

  const routes = readFile(join(SHOPIFY_API, 'routes/campaigns.js'));
  if (!routes) {
    error('Campaign routes file not found');
    return;
  }

  const requiredEndpoints = [
    { method: 'GET', path: '/campaigns', name: 'list' },
    { method: 'GET', path: '/campaigns/:id', name: 'getOne' },
    { method: 'POST', path: '/campaigns', name: 'create' },
    { method: 'PUT', path: '/campaigns/:id', name: 'update' },
    { method: 'DELETE', path: '/campaigns/:id', name: 'delete' },
    { method: 'POST', path: '/campaigns/:id/enqueue', name: 'enqueue' },
    { method: 'PUT', path: '/campaigns/:id/schedule', name: 'schedule' },
    { method: 'POST', path: '/campaigns/:id/cancel', name: 'cancel' },
    { method: 'GET', path: '/campaigns/:id/status', name: 'status' },
  ];

  // Check routes - match actual route definitions from routes file
  const routeChecks = [
    { method: 'GET', path: '/campaigns', pattern: /r\.get\(['"]\/['"]/, name: 'list' },
    { method: 'GET', path: '/campaigns/:id', pattern: /r\.get\(['"]\/:id['"]/, name: 'getOne' },
    { method: 'POST', path: '/campaigns', pattern: /r\.post\(['"]\/['"]/, name: 'create' },
    { method: 'PUT', path: '/campaigns/:id', pattern: /r\.put\(['"]\/:id['"]/, name: 'update' },
    { method: 'DELETE', path: '/campaigns/:id', pattern: /r\.delete\(['"]\/:id['"]/, name: 'delete' },
    { method: 'POST', path: '/campaigns/:id/enqueue', pattern: /\/:id\/enqueue/, name: 'enqueue' },
    { method: 'PUT', path: '/campaigns/:id/schedule', pattern: /\/:id\/schedule/, name: 'schedule' },
    { method: 'POST', path: '/campaigns/:id/cancel', pattern: /\/:id\/cancel/, name: 'cancel' },
    { method: 'GET', path: '/campaigns/:id/status', pattern: /\/:id\/status/, name: 'status' },
  ];

  routeChecks.forEach(({ method, path, pattern, name }) => {
    if (pattern.test(routes)) {
      pass(`${method} ${path} exists`);
    } else {
      // Check if route exists with different pattern (e.g., controller name)
      const controllerCheck = new RegExp(`ctrl\\.${name}`, 'i');
      if (controllerCheck.test(routes)) {
        pass(`${method} ${path} exists (via controller)`);
      } else {
        error(`${method} ${path} not found`);
      }
    }
  });

  // Check controller functions
  const controller = readFile(join(SHOPIFY_API, 'controllers/campaigns.js'));
  if (controller) {
    const requiredFunctions = [
      { name: 'list', pattern: /export\s+(async\s+)?function\s+list/ },
      { name: 'getOne', pattern: /export\s+(async\s+)?function\s+getOne/ },
      { name: 'create', pattern: /export\s+(async\s+)?function\s+create/ },
      { name: 'update', pattern: /export\s+(async\s+)?function\s+update/ },
      { name: 'remove', pattern: /export\s+(async\s+)?function\s+remove/ }, // Note: uses 'remove' not 'delete'
      { name: 'enqueue', pattern: /export\s+(async\s+)?function\s+enqueue/ },
      { name: 'schedule', pattern: /export\s+(async\s+)?function\s+schedule/ },
      { name: 'cancel', pattern: /export\s+(async\s+)?function\s+cancel/ },
      { name: 'status', pattern: /export\s+(async\s+)?function\s+status/ },
    ];
    requiredFunctions.forEach(({ name, pattern }) => {
      if (pattern.test(controller)) {
        pass(`Controller function ${name} exists`);
      } else {
        error(`Controller function ${name} not found`);
      }
    });
  } else {
    error('Campaign controller not found');
  }

  // Check service functions
  const service = readFile(join(SHOPIFY_API, 'services/campaigns.js'));
  if (service) {
    const requiredServiceFunctions = ['listCampaigns', 'getCampaignById', 'createCampaign', 'updateCampaign', 'deleteCampaign', 'enqueueCampaign', 'scheduleCampaign', 'cancelCampaign'];
    requiredServiceFunctions.forEach(func => {
      if (new RegExp(`export\\s+async\\s+function\\s+${func}`).test(service)) {
        pass(`Service function ${func} exists`);
      } else {
        error(`Service function ${func} not found`);
      }
    });
  } else {
    error('Campaign service not found');
  }
}

/**
 * Check unsubscribe link is added to messages
 */
function checkUnsubscribeLink() {
  console.log('\n📋 Checking Unsubscribe Link Integration...');
  console.log('='.repeat(60));

  const bulkSmsJob = readFile(join(SHOPIFY_API, 'queue/jobs/bulkSms.js'));
  if (bulkSmsJob) {
    if (bulkSmsJob.includes('appendUnsubscribeLink')) {
      pass('Unsubscribe link is appended in bulk SMS job');
    } else {
      error('Unsubscribe link not appended in bulk SMS job');
    }

    if (bulkSmsJob.includes('/shopify/unsubscribe/')) {
      pass('Unsubscribe URL uses Shopify namespace');
    } else {
      warn('Unsubscribe URL may not use Shopify namespace');
    }
  } else {
    error('Bulk SMS job file not found');
  }

  const unsubscribeUtils = readFile(join(SHOPIFY_API, 'utils/unsubscribe.js'));
  if (unsubscribeUtils) {
    if (unsubscribeUtils.includes('/shopify/unsubscribe/')) {
      pass('Unsubscribe URL generation uses Shopify namespace');
    } else {
      error('Unsubscribe URL generation does not use Shopify namespace');
    }
  } else {
    error('Unsubscribe utils file not found');
  }
}

/**
 * Check tenant scoping
 */
function checkTenantScoping() {
  console.log('\n📋 Checking Tenant Scoping...');
  console.log('='.repeat(60));

  const appJs = readFile(join(SHOPIFY_API, 'app.js'));
  if (appJs) {
    if (/\/campaigns.*resolveStore|resolveStore.*campaigns/.test(appJs)) {
      pass('Campaign routes protected with resolveStore middleware');
    } else {
      error('Campaign routes not protected with resolveStore middleware');
    }
  } else {
    warn('app.js not found, cannot verify tenant scoping');
  }
}

/**
 * Main execution
 */
async function runAudit() {
  console.log('🚀 Shopify Campaigns Audit');
  console.log('='.repeat(60));

  checkCampaignEndpoints();
  checkUnsubscribeLink();
  checkTenantScoping();

  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(60));
  const passCount = passes.length;
  console.log(`✅ Passed: ${passCount}`);
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

// Track passes
let passes = [];
const originalPass = pass;
pass = function(msg) {
  passes.push(msg);
  return originalPass(msg);
};

runAudit().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

