#!/usr/bin/env node

/**
 * Shopify Campaigns UI Parity Audit Script
 * Verifies campaigns list/create pages match Retail UI patterns
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
const SHOPIFY_CAMPAIGNS = join(ROOT, 'apps/astronote-web/app/app/shopify/campaigns');

const errors = [];
const warnings = [];
const passes = [];

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
  } catch {
    return null;
  }
}

function checkPagesExist() {
  console.log('\n📋 Checking Campaign Pages Exist...');
  console.log('='.repeat(60));

  const requiredPages = [
    { path: 'page.tsx', name: 'List page' },
    { path: 'new/page.tsx', name: 'Create page' },
  ];

  requiredPages.forEach(({ path, name }) => {
    const fullPath = join(SHOPIFY_CAMPAIGNS, path);
    if (existsSync(fullPath)) {
      pass(`${name} exists (${path})`);
    } else {
      error(`${name} missing (${path})`);
    }
  });
}

function checkUIComponents() {
  console.log('\n📋 Checking UI Components Usage...');
  console.log('='.repeat(60));

  const listPage = readFile(join(SHOPIFY_CAMPAIGNS, 'page.tsx'));
  const createPage = readFile(join(SHOPIFY_CAMPAIGNS, 'new/page.tsx'));

  if (!listPage) {
    error('List page not found');
    return;
  }
  if (!createPage) {
    error('Create page not found');
    return;
  }

  if (/RetailPageLayout/.test(listPage)) {
    pass('List page uses RetailPageLayout');
  } else {
    error('List page missing RetailPageLayout');
  }

  if (/RetailPageHeader/.test(listPage)) {
    pass('List page uses RetailPageHeader');
  } else {
    error('List page missing RetailPageHeader');
  }

  if (/StatusBadge/.test(listPage)) {
    pass('List page uses StatusBadge');
  } else {
    error('List page missing StatusBadge');
  }

  if (/StatsCards/.test(listPage)) {
    pass('List page renders metrics cards');
  } else {
    error('List page missing metrics cards');
  }

  if (/RetailPageLayout/.test(createPage)) {
    pass('Create page uses RetailPageLayout');
  } else {
    error('Create page missing RetailPageLayout');
  }

  // Accept either RetailPageHeader directly or the shared AppPageHeader wrapper.
  if (/RetailPageHeader|AppPageHeader/.test(createPage)) {
    pass('Create page uses RetailPageHeader (direct or via AppPageHeader)');
  } else {
    error('Create page missing RetailPageHeader (direct or via AppPageHeader)');
  }

  if (/RetailCard/.test(createPage)) {
    pass('Create page uses RetailCard');
  } else {
    warn('Create page may not use RetailCard');
  }
}

function checkListStates() {
  console.log('\n📋 Checking List Loading/Empty/Error States...');
  console.log('='.repeat(60));

  const listPage = readFile(join(SHOPIFY_CAMPAIGNS, 'page.tsx'));
  if (!listPage) {
    error('List page not found');
    return;
  }

  if (/CampaignSkeleton|campaignsLoading|isLoading.*campaigns|useCampaigns.*isLoading/.test(listPage)) {
    pass('List page includes loading state');
  } else {
    error('List page missing loading state');
  }

  if (/emptyTitle|EmptyState/.test(listPage)) {
    pass('List page includes empty state');
  } else {
    error('List page missing empty state');
  }

  if (/campaignsError|error=/.test(listPage)) {
    pass('List page includes error state');
  } else {
    error('List page missing error state');
  }
}

function checkStatusFilter() {
  console.log('\n📋 Checking Status Filter...');
  console.log('='.repeat(60));

  const listPage = readFile(join(SHOPIFY_CAMPAIGNS, 'page.tsx'));
  if (!listPage) {
    error('List page not found');
    return;
  }

  const requiredStatuses = [
    'draft',
    'scheduled',
    'sending',
    'sent',
    'failed',
    'cancelled',
  ];
  requiredStatuses.forEach((status) => {
    if (new RegExp(`value=\"${status}\"|value='${status}'`).test(listPage)) {
      pass(`Status filter includes ${status}`);
    } else {
      error(`Status filter missing ${status}`);
    }
  });

  // Note: paused and completed are valid statuses in the schema (CampaignStatus enum)
  // They are supported and should be allowed in the status filter
}

function checkSentTotalDisplay() {
  console.log('\n📋 Checking Sent/Total Display...');
  console.log('='.repeat(60));

  const listPage = readFile(join(SHOPIFY_CAMPAIGNS, 'page.tsx'));
  if (!listPage) {
    error('List page not found');
    return;
  }

  if (/sentCount/.test(listPage)) {
    pass('List page displays sentCount');
  } else {
    error('List page missing sentCount display');
  }

  if (/recipientCount|totalRecipients/.test(listPage)) {
    pass('List page displays recipient counts');
  } else {
    error('List page missing recipient counts');
  }

  if (/failedCount/.test(listPage)) {
    pass('List page displays failedCount');
  } else {
    warn('List page may not display failedCount');
  }
}

function checkEnglishOnly() {
  console.log('\n📋 Checking English-Only...');
  console.log('='.repeat(60));

  const files = [
    { path: 'page.tsx', name: 'List page' },
    { path: 'new/page.tsx', name: 'Create page' },
  ];

  files.forEach(({ path, name }) => {
    const content = readFile(join(SHOPIFY_CAMPAIGNS, path));
    if (!content) return;

    const greekPattern = /[\u0370-\u03FF]/;
    if (greekPattern.test(content)) {
      error(`${name} contains Greek characters (should be English-only)`);
    } else {
      pass(`${name} is English-only`);
    }
  });
}

async function runAudit() {
  console.log('🚀 Shopify Campaigns UI Parity Audit');
  console.log('='.repeat(60));

  checkPagesExist();
  checkUIComponents();
  checkListStates();
  checkStatusFilter();
  checkSentTotalDisplay();
  checkEnglishOnly();

  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passes.length}`);
  console.log(`❌ Failed: ${errors.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach((err) => console.log(`   ${err}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((warn) => console.log(`   ${warn}`));
  }

  if (errors.length > 0 || warnings.length > 0) {
    console.log('\n❌ Audit failed');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed!');
    process.exit(0);
  }
}

runAudit().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
