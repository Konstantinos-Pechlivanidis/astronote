#!/usr/bin/env node

/**
 * Shopify Frontend Deployment Readiness Audit Script
 * Verifies all Shopify pages are production-ready
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const SHOPIFY_PAGES = join(ROOT, 'apps/astronote-web/app/app/shopify');
const SHOPIFY_SRC = join(ROOT, 'apps/astronote-web/src');

let errors = [];
let warnings = [];
let passes = [];

function error(msg, file = null, line = null) {
  const location = file ? (line ? `${file}:${line}` : file) : '';
  errors.push({ msg, file, line });
  console.error(`❌ ERROR: ${msg}${location ? ` (${location})` : ''}`);
}

function warn(msg, file = null, line = null) {
  const location = file ? (line ? `${file}:${line}` : file) : '';
  warnings.push({ msg, file, line });
  console.warn(`⚠️  WARNING: ${msg}${location ? ` (${location})` : ''}`);
}

function pass(msg) {
  passes.push(msg);
  console.log(`✅ PASS: ${msg}`);
}

/**
 * Find all Shopify page files
 */
function findShopifyPages(dir = SHOPIFY_PAGES, pages = []) {
  if (!existsSync(dir)) return pages;
  
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      findShopifyPages(fullPath, pages);
    } else if (entry.name === 'page.tsx' || entry.name === 'page.js') {
      pages.push(fullPath);
    }
  }
  return pages;
}

/**
 * Check API usage in a file
 */
function checkAPIUsage(content, file) {
  const lines = content.split('\n');
  let hasIssues = false;

  // Check for direct fetch/axios calls (should use shopifyApi)
  const directFetchRegex = /fetch\s*\(\s*['"`](https?:\/\/|.*\/api\/shopify)/;
  const directAxiosRegex = /axios\.(get|post|put|delete|patch)\s*\(/;
  const retailApiRegex = /['"`].*\/api\/retail\//;

  lines.forEach((line, idx) => {
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

    // Check for direct fetch to shopify-api
    if (directFetchRegex.test(line) && !line.includes('shopifyApi')) {
      error(`Direct fetch call detected (should use shopifyApi or API wrapper)`, file, idx + 1);
      hasIssues = true;
    }

    // Check for direct axios calls
    if (directAxiosRegex.test(line)) {
      error(`Direct axios call detected (should use shopifyApi or API wrapper)`, file, idx + 1);
      hasIssues = true;
    }

    // Check for retail API endpoints
    if (retailApiRegex.test(line)) {
      error(`Retail API endpoint referenced (should use Shopify API)`, file, idx + 1);
      hasIssues = true;
    }
  });

  // Check for shopifyApi or API wrapper usage
  const hasShopifyApi = /shopifyApi|campaignsApi|contactsApi|templatesApi|billingApi|settingsApi|audiencesApi|discountsApi|automationsApi|dashboardApi/.test(content);
  const hasReactQueryHooks = /useCampaigns|useContacts|useTemplates|useBilling|useSettings|useAudiences|useDiscounts|useAutomations|useDashboard|useCreateCampaign|useUpdateCampaign|useDeleteCampaign|useEnqueueCampaign|useScheduleCampaign|useCancelCampaign|useCreateContact|useUpdateContact|useDeleteContact|useImportContacts|useCreateTemplate|useUpdateTemplate|useDeleteTemplate|useCreateAutomation|useUpdateAutomation|useDeleteAutomation/.test(content);
  const hasMutations = /useMutation|mutate|mutateAsync/.test(content);

  // Only warn if there's API-related code but no centralized client or hooks
  if (!hasShopifyApi && !hasReactQueryHooks && !hasMutations && (content.includes('api') || content.includes('fetch') || content.includes('axios')) && !file.includes('auth') && !file.includes('callback')) {
    warn(`No centralized API client usage detected (may be using hooks)`, file);
  }

  return !hasIssues;
}

/**
 * Check UI states in a file
 */
function checkUIStates(content, file) {
  const lines = content.split('\n');
  let hasLoading = false;
  let hasError = false;
  let hasEmpty = false;

  // Check for loading state
  if (/isLoading|loading|skeleton|Skeleton|Loading/.test(content)) {
    hasLoading = true;
  }

  // Check for error state
  if (/isError|error|Error|onRetry|refetch/.test(content)) {
    hasError = true;
  }

  // Check for empty state
  if (/emptyState|EmptyState|emptyTitle|emptyDescription|length === 0|items\.length === 0/.test(content)) {
    hasEmpty = true;
  }

  // Main pages should have all states (but some pages like success/cancel don't need them)
  const isMainPage = file.includes('/page.tsx') && !file.includes('/auth/') && !file.includes('/callback');
  const isSimplePage = file.includes('/success') || file.includes('/cancel') || file.includes('/status');
  
  if (isMainPage && !isSimplePage) {
    // Only check list pages for empty state
    const isListPage = file.includes('/campaigns/page') || file.includes('/contacts/page') || file.includes('/templates/page') || file.includes('/automations/page');
    
    if (isListPage && !hasLoading) {
      warn(`List page may be missing loading state`, file);
    }
    if (isListPage && !hasError) {
      warn(`List page may be missing error state`, file);
    }
    if (isListPage && !hasEmpty) {
      warn(`List page may be missing empty state`, file);
    }
  }

  return true;
}

/**
 * Check for English-only content
 */
function checkEnglishOnly(content, file) {
  // Check for Greek unicode characters
  const greekPattern = /[\u0370-\u03FF]/;
  if (greekPattern.test(content)) {
    error(`Greek characters detected (Shopify must be English-only)`, file);
    return false;
  }
  return true;
}

/**
 * Check for route collisions
 */
function checkRouteCollisions(pages) {
  const routes = new Map();
  let hasCollisions = false;

  pages.forEach(page => {
    const relativePath = relative(SHOPIFY_PAGES, page);
    const route = relativePath
      .replace(/\/page\.tsx?$/, '')
      .replace(/\[(\w+)\]/g, ':$1')
      .replace(/\\/g, '/');

    if (routes.has(route)) {
      error(`Route collision detected: ${route} (${routes.get(route)} and ${page})`);
      hasCollisions = true;
    } else {
      routes.set(route, page);
    }
  });

  return !hasCollisions;
}

/**
 * Check for hardcoded URLs
 */
function checkHardcodedURLs(content, file) {
  const lines = content.split('\n');
  let hasIssues = false;

  const localhostRegex = /localhost:\d+|127\.0\.0\.1:\d+/;
  const prodUrlRegex = /https?:\/\/[^'"]*\.(com|net|org|io)[^'"]*/;
  const apiUrlRegex = /['"`]https?:\/\/[^'"]*\/api\/shopify[^'"]*['"`]/;

  lines.forEach((line, idx) => {
    // Skip comments and config files
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    if (file.includes('config.ts') || file.includes('config.js')) return;

    // Check for localhost
    if (localhostRegex.test(line) && !line.includes('SHOPIFY_API_BASE_URL')) {
      error(`Hardcoded localhost URL detected`, file, idx + 1);
      hasIssues = true;
    }

    // Check for hardcoded API URLs (should use config)
    if (apiUrlRegex.test(line) && !line.includes('SHOPIFY_API_BASE_URL') && !line.includes('shopifyApi')) {
      warn(`Hardcoded API URL detected (should use SHOPIFY_API_BASE_URL)`, file, idx + 1);
    }
  });

  return !hasIssues;
}

/**
 * Check for crash-prone patterns
 */
function checkCrashPrevention(content, file) {
  const lines = content.split('\n');
  let hasIssues = false;

  // Check for direct array access without optional chaining
  const unsafeArrayAccess = /\.(map|filter|forEach|find|reduce)\s*\(/;
  const safeArrayAccess = /\.items\?\.(map|filter|forEach|find|reduce)\s*\(|data\?\.(map|filter|forEach|find|reduce)\s*\(/;

  lines.forEach((line, idx) => {
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

    // Check for unsafe array access on API data
    if (unsafeArrayAccess.test(line) && !safeArrayAccess.test(line)) {
      if (line.includes('data.') || line.includes('items.') || line.includes('campaigns.') || line.includes('contacts.')) {
        warn(`Potential unsafe array access (consider optional chaining)`, file, idx + 1);
      }
    }
  });

  return true;
}

/**
 * Check for UI component usage
 */
function checkUIComponents(content, file) {
  const isMainPage = file.includes('/page.tsx') && !file.includes('/auth/') && !file.includes('/callback');
  
  if (isMainPage) {
    // Check for PageHeader
    if (!/RetailPageHeader|PageHeader/.test(content)) {
      warn(`Main page may be missing PageHeader`, file);
    }

    // Check for Card usage
    if (!/RetailCard|Card/.test(content)) {
      warn(`Main page may be missing Card component`, file);
    }
  }

  return true;
}

/**
 * Main execution
 */
async function runAudit() {
  console.log('🚀 Shopify Frontend Deployment Readiness Audit');
  console.log('='.repeat(60));

  // Find all pages
  console.log('\n📋 Discovering Shopify Pages...');
  console.log('='.repeat(60));
  const pages = findShopifyPages();
  pass(`Found ${pages.length} Shopify pages`);

  // Check route collisions
  console.log('\n📋 Checking Route Collisions...');
  console.log('='.repeat(60));
  if (checkRouteCollisions(pages)) {
    pass('No route collisions detected');
  }

  // Check each page
  console.log('\n📋 Checking Pages...');
  console.log('='.repeat(60));
  
  let apiIssues = 0;
  let uiIssues = 0;
  let englishIssues = 0;
  let urlIssues = 0;

  pages.forEach(page => {
    const content = readFileSync(page, 'utf-8');
    const relativePath = relative(ROOT, page);

    // Check API usage
    if (!checkAPIUsage(content, relativePath)) {
      apiIssues++;
    }

    // Check UI states
    checkUIStates(content, relativePath);

    // Check English-only
    if (!checkEnglishOnly(content, relativePath)) {
      englishIssues++;
    }

    // Check hardcoded URLs
    if (!checkHardcodedURLs(content, relativePath)) {
      urlIssues++;
    }

    // Check crash prevention
    checkCrashPrevention(content, relativePath);

    // Check UI components
    checkUIComponents(content, relativePath);
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passes.length}`);
  console.log(`❌ Failed: ${errors.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(({ msg, file, line }) => {
      console.log(`   ${msg}${file ? ` (${file}${line ? `:${line}` : ''})` : ''}`);
    });
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(({ msg, file, line }) => {
      console.log(`   ${msg}${file ? ` (${file}${line ? `:${line}` : ''})` : ''}`);
    });
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

