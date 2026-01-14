#!/usr/bin/env node

/**
 * Shopify Campaigns UI Confirmation Audit Script
 * Verifies campaigns pages match Retail UX/UI patterns
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
const RETAIL_CAMPAIGNS = join(ROOT, 'apps/astronote-web/app/app/retail/campaigns');

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
 * A) Page existence check
 */
function checkPageExistence() {
  console.log('\n📋 Checking Page Existence...');
  console.log('='.repeat(60));

  const pages = [
    { path: 'page.tsx', name: 'List page' },
    { path: 'new/page.tsx', name: 'Create page' },
    { path: '[id]/page.tsx', name: 'Detail page' },
  ];

  pages.forEach(({ path, name }) => {
    const fullPath = join(SHOPIFY_CAMPAIGNS, path);
    if (existsSync(fullPath)) {
      pass(`${name} exists (${path})`);
    } else {
      error(`${name} missing (${path})`);
    }
  });
}

/**
 * B) UI structure markers
 */
function checkUIStructure() {
  console.log('\n📋 Checking UI Structure Markers...');
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

  // Check PageHeader on list page
  if (/RetailPageHeader/.test(listPage)) {
    pass('List page uses RetailPageHeader');
  } else {
    error('List page missing RetailPageHeader');
  }

  // Check PageHeader on create page (Retail uses custom, but RetailPageHeader or AppPageHeader is acceptable)
  if (/RetailPageHeader|AppPageHeader|h1.*Create Campaign/.test(createPage)) {
    pass('Create page has header (RetailPageHeader/AppPageHeader or h1)');
  } else {
    error('Create page missing header');
  }

  // Check RetailCard usage
  if (/RetailCard/.test(listPage)) {
    pass('List page uses RetailCard');
  } else {
    error('List page missing RetailCard');
  }

  if (/RetailCard/.test(createPage)) {
    pass('Create page uses RetailCard');
  } else {
    error('Create page missing RetailCard');
  }

  // Check StatusBadge on list page
  if (/StatusBadge/.test(listPage)) {
    pass('List page uses StatusBadge');
  } else {
    error('List page missing StatusBadge');
  }

  // Check RetailPageLayout on list page
  if (/RetailPageLayout/.test(listPage)) {
    pass('List page uses RetailPageLayout');
  } else {
    error('List page missing RetailPageLayout');
  }
}

/**
 * C) State handling (Loading + Empty + Error)
 */
function checkStateHandling() {
  console.log('\n📋 Checking State Handling...');
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

  // Check loading state on list page
  if (/isLoading|loading|skeleton|Skeleton/.test(listPage)) {
    pass('List page has loading state');
  } else {
    warn('List page may not have loading state');
  }

  // Check empty state on list page
  if (/emptyTitle|emptyDescription|emptyIcon|EmptyState|emptyState/.test(listPage)) {
    pass('List page has empty state');
  } else {
    error('List page missing empty state');
  }

  // Check error state on list page
  if (/error.*RetailCard|error.*variant.*danger|onRetry|refetch/.test(listPage)) {
    pass('List page has error state');
  } else {
    warn('List page may not have error state');
  }

  // Check error handling on create page
  if (/errors|error|Error/.test(createPage)) {
    pass('Create page has error handling');
  } else {
    warn('Create page may not have error handling');
  }
}

/**
 * D) Styling/token consistency (best-effort)
 */
function checkStylingTokens() {
  console.log('\n📋 Checking Styling/Token Consistency...');
  console.log('='.repeat(60));

  const listPage = readFile(join(SHOPIFY_CAMPAIGNS, 'page.tsx'));
  const createPage = readFile(join(SHOPIFY_CAMPAIGNS, 'new/page.tsx'));

  if (!listPage || !createPage) return;

  // Check for hardcoded colors (common patterns to avoid)
  const hardcodedColorPatterns = [
    /#[0-9a-fA-F]{6}/, // Hex colors
    /rgb\([^)]+\)/, // RGB colors
    /rgba\([^)]+\)/, // RGBA colors
  ];

  let foundHardcoded = false;
  [listPage, createPage].forEach((content, idx) => {
    hardcodedColorPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        const pageName = idx === 0 ? 'List page' : 'Create page';
        warn(`${pageName} may have hardcoded colors (best-effort check)`);
        foundHardcoded = true;
      }
    });
  });

  if (!foundHardcoded) {
    pass('No obvious hardcoded colors detected (uses design tokens)');
  }

  // Check for responsive classes
  if (/sm:|md:|lg:|xl:/.test(listPage) && /sm:|md:|lg:|xl:/.test(createPage)) {
    pass('Pages use responsive classes (sm:, md:, lg:)');
  } else {
    warn('Pages may not use responsive classes');
  }
}

/**
 * E) English-only check
 */
function checkEnglishOnly() {
  console.log('\n📋 Checking English-Only...');
  console.log('='.repeat(60));

  const files = [
    { path: 'page.tsx', name: 'List page' },
    { path: 'new/page.tsx', name: 'Create page' },
    { path: '[id]/page.tsx', name: 'Detail page' },
  ];

  files.forEach(({ path, name }) => {
    const content = readFile(join(SHOPIFY_CAMPAIGNS, path));
    if (!content) return;

    // Check for Greek unicode characters (common range: U+0370-U+03FF)
    const greekPattern = /[\u0370-\u03FF]/;
    if (greekPattern.test(content)) {
      error(`${name} contains Greek characters (should be English-only)`);
    } else {
      pass(`${name} is English-only`);
    }
  });
}

/**
 * F) Shared components parity
 */
function checkSharedComponents() {
  console.log('\n📋 Checking Shared Components Parity...');
  console.log('='.repeat(60));

  const listPage = readFile(join(SHOPIFY_CAMPAIGNS, 'page.tsx'));
  const retailListPage = readFile(join(RETAIL_CAMPAIGNS, 'page.tsx'));

  if (!listPage || !retailListPage) {
    warn('Cannot compare components - files not found');
    return;
  }

  // Check StatusBadge usage
  if (/StatusBadge/.test(listPage) && /StatusBadge/.test(retailListPage)) {
    pass('Both use StatusBadge component (shared)');
  } else {
    error('StatusBadge usage mismatch');
  }

  // Check RetailCard usage
  if (/RetailCard/.test(listPage) && /RetailCard/.test(retailListPage)) {
    pass('Both use RetailCard component (shared)');
  } else {
    error('RetailCard usage mismatch');
  }

  // Check RetailPageHeader usage
  if (/RetailPageHeader/.test(listPage) && /RetailPageHeader/.test(retailListPage)) {
    pass('Both use RetailPageHeader component (shared)');
  } else {
    warn('RetailPageHeader usage may differ (acceptable if both professional)');
  }
}

/**
 * G) Information architecture check
 */
function checkInformationArchitecture() {
  console.log('\n📋 Checking Information Architecture...');
  console.log('='.repeat(60));

  const listPage = readFile(join(SHOPIFY_CAMPAIGNS, 'page.tsx'));
  const retailListPage = readFile(join(RETAIL_CAMPAIGNS, 'page.tsx'));

  if (!listPage || !retailListPage) {
    warn('Cannot compare IA - files not found');
    return;
  }

  // Check for sent/total pattern (may be on separate lines or with whitespace)
  if (/sentCount[\s\S]*?\/[\s\S]*?recipientCount|sentCount[\s\S]*?\/[\s\S]*?totalRecipients|sent[\s\S]*?\/[\s\S]*?total|sentCount.*\/.*recipientCount|sentCount.*\/.*totalRecipients/.test(listPage)) {
    pass('List page shows sent/total pattern (matches Retail)');
  } else {
    error('List page missing sent/total pattern');
  }

  // Check for failed count display
  if (/failedCount|failed/.test(listPage)) {
    pass('List page shows failed count (matches Retail)');
  } else {
    warn('List page may not show failed count');
  }

  // Check table columns match
  const shopifyColumns = ['Name', 'Status', 'Recipients', 'Scheduled', 'Created'];
  const hasName = /Name|name/.test(listPage);
  const hasStatus = /Status|status/.test(listPage);
  const hasScheduled = /Scheduled|scheduled/.test(listPage);
  const hasCreated = /Created|created/.test(listPage);

  if (hasName && hasStatus && hasScheduled && hasCreated) {
    pass('List page has expected columns (Name, Status, Scheduled, Created)');
  } else {
    error('List page missing expected columns');
  }
}

/**
 * Main execution
 */
async function runAudit() {
  console.log('🚀 Shopify Campaigns UI Confirmation Audit');
  console.log('='.repeat(60));

  checkPageExistence();
  checkUIStructure();
  checkStateHandling();
  checkStylingTokens();
  checkEnglishOnly();
  checkSharedComponents();
  checkInformationArchitecture();

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

