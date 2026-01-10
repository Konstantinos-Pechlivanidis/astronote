#!/usr/bin/env node

/**
 * Shopify Campaigns Endpoints Audit Script
 * Verifies campaigns pages use centralized API client correctly
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
const SHOPIFY_CAMPAIGNS = join(ROOT, 'apps/astronote-web/app/app/shopify/campaigns');
const SHOPIFY_HOOKS = join(ROOT, 'apps/astronote-web/src/features/shopify/campaigns/hooks');

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
 * Check no direct fetch/axios calls in campaigns pages
 */
function checkNoDirectAPICalls() {
  console.log('\n📋 Checking No Direct API Calls...');
  console.log('='.repeat(60));

  const files = [
    { path: 'page.tsx', name: 'List page' },
    { path: '[id]/page.tsx', name: 'Detail page' },
    { path: 'new/page.tsx', name: 'Create page' },
  ];

  files.forEach(({ path, name }) => {
    const content = readFile(join(SHOPIFY_CAMPAIGNS, path));
    if (!content) return;

    // Check for direct fetch calls
    if (/fetch\(['"]\/api\//.test(content)) {
      error(`${name} uses direct fetch() calls (should use centralized client)`);
    } else {
      pass(`${name} does not use direct fetch() calls`);
    }

    // Check for direct axios calls
    if (/axios\.(get|post|put|delete)\(/.test(content)) {
      error(`${name} uses direct axios calls (should use centralized client)`);
    } else {
      pass(`${name} does not use direct axios calls`);
    }
  });
}

/**
 * Check hooks use centralized client
 */
function checkHooksUseClient() {
  console.log('\n📋 Checking Hooks Use Centralized Client...');
  console.log('='.repeat(60));

  const hooks = [
    { path: 'useCampaigns.ts', name: 'useCampaigns' },
    { path: 'useCampaignMutations.ts', name: 'useCampaignMutations' },
  ];

  hooks.forEach(({ path, name }) => {
    const content = readFile(join(SHOPIFY_HOOKS, path));
    if (!content) {
      warn(`${name} hook not found`);
      return;
    }

    // Check for campaignsApi usage
    if (/campaignsApi/.test(content)) {
      pass(`${name} uses campaignsApi (centralized client)`);
    } else {
      error(`${name} does not use campaignsApi`);
    }

    // Check for shopifyApi import
    if (/from.*shopify.*api.*campaigns/.test(content)) {
      pass(`${name} imports from centralized campaigns API`);
    } else {
      warn(`${name} may not import from centralized campaigns API`);
    }
  });
}

/**
 * Check list endpoint uses required params
 */
function checkListEndpointParams() {
  console.log('\n📋 Checking List Endpoint Params...');
  console.log('='.repeat(60));

  const useCampaigns = readFile(join(SHOPIFY_HOOKS, 'useCampaigns.ts'));
  if (!useCampaigns) {
    error('useCampaigns hook not found');
    return;
  }

  // Check for page param (in params object or function call)
  if (/page\s*[:=]|params.*page|page\s*,/.test(useCampaigns)) {
    pass('List endpoint uses page param');
  } else {
    warn('List endpoint may not use page param');
  }

  // Check for pageSize param (in params object or function call)
  if (/pageSize\s*[:=]|params.*pageSize|pageSize\s*,/.test(useCampaigns)) {
    pass('List endpoint uses pageSize param');
  } else {
    warn('List endpoint may not use pageSize param');
  }
}

/**
 * Check no retail endpoint calls
 */
function checkNoRetailEndpoints() {
  console.log('\n📋 Checking No Retail Endpoints...');
  console.log('='.repeat(60));

  const files = [
    { path: 'page.tsx', name: 'List page' },
    { path: '[id]/page.tsx', name: 'Detail page' },
    { path: 'new/page.tsx', name: 'Create page' },
  ];

  files.forEach(({ path, name }) => {
    const content = readFile(join(SHOPIFY_CAMPAIGNS, path));
    if (!content) return;

    // Check for retail API calls
    if (/\/api\/retail\//.test(content)) {
      error(`${name} calls retail endpoints (should use shopify endpoints)`);
    } else {
      pass(`${name} does not call retail endpoints`);
    }
  });
}

/**
 * Main execution
 */
async function runAudit() {
  console.log('🚀 Shopify Campaigns Endpoints Audit');
  console.log('='.repeat(60));

  checkNoDirectAPICalls();
  checkHooksUseClient();
  checkListEndpointParams();
  checkNoRetailEndpoints();

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

