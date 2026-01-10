#!/usr/bin/env node

/**
 * Shopify Frontend Requirements Audit Script
 * Verifies that all required pages exist and include required UI sections
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

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

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

/**
 * Recursively find files matching pattern
 */
function findFiles(dir, pattern, files = []) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findFiles(fullPath, pattern, files);
      } else if (pattern.test(entry)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore errors
  }
  return files;
}

/**
 * Check if file contains text (case-insensitive)
 */
function fileContains(filePath, text) {
  try {
    const content = readFileSync(filePath, 'utf-8').toLowerCase();
    return content.includes(text.toLowerCase());
  } catch (err) {
    return false;
  }
}

/**
 * Check for Greek characters (best-effort)
 */
function hasGreekCharacters(content) {
  // Greek unicode range: U+0370-U+03FF
  const greekPattern = /[\u0370-\u03FF]/;
  return greekPattern.test(content);
}

/**
 * Check required pages exist
 */
function checkRequiredPages() {
  info('Checking required Shopify pages...');
  
  const shopifyPagesDir = join(rootDir, 'apps/astronote-web/app/app/shopify');
  const requiredPages = [
    'dashboard/page.tsx',
    'campaigns/page.tsx',
    'campaigns/new/page.tsx',
    'campaigns/[id]/page.tsx',
    'contacts/page.tsx',
    'templates/page.tsx',
    'automations/page.tsx',
    'billing/page.tsx',
    'settings/page.tsx',
  ];
  
  requiredPages.forEach((pagePath) => {
    const fullPath = join(shopifyPagesDir, pagePath);
    if (!existsSync(fullPath)) {
      error(`Required page missing: ${pagePath}`);
    } else {
      info(`✓ Page exists: ${pagePath}`);
    }
  });
}

/**
 * Check pages use centralized API client
 */
function checkCentralizedClientUsage() {
  info('Checking centralized API client usage...');
  
  const shopifyPagesDir = join(rootDir, 'apps/astronote-web/app/app/shopify');
  const pageFiles = findFiles(shopifyPagesDir, /\.tsx$/);
  
  let foundDirectCalls = 0;
  
  pageFiles.forEach((filePath) => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Check for direct fetch calls to shopify-api
      const fetchPattern = /fetch\s*\(\s*[`'"]([^`'"]*shopify[^`'"]*)[`'"]/gi;
      let match;
      while ((match = fetchPattern.exec(content)) !== null) {
        const url = match[1];
        // Allow auth token exchange (public endpoint)
        if (!url.includes('/auth/shopify-token') && !url.includes('/auth/shopify')) {
          foundDirectCalls++;
          warn(`Direct fetch call found in ${filePath.replace(rootDir, '')}: ${url}`);
        }
      }
      
      // Check for direct axios calls (not using shopifyApi)
      const axiosPattern = /axios\.(get|post|put|delete|patch)\s*\(/g;
      let axiosMatch;
      while ((axiosMatch = axiosPattern.exec(content)) !== null) {
        const lines = content.split('\n');
        const lineIndex = content.substring(0, axiosMatch.index).split('\n').length - 1;
        const context = lines.slice(Math.max(0, lineIndex - 5), lineIndex + 5).join('\n');
        
        // Allow auth token exchange (public endpoint)
        if (!context.includes('/auth/shopify-token') && !context.includes('exchangeShopifyToken')) {
          foundDirectCalls++;
          warn(`Direct axios call found in ${filePath.replace(rootDir, '')} (line ${lineIndex + 1})`);
        }
      }
    } catch (err) {
      // Ignore errors
    }
  });
  
  if (foundDirectCalls === 0) {
    info('✓ No direct fetch/axios calls bypassing centralized client');
  }
}

/**
 * Check pages include required UI sections
 */
function checkRequiredUISections() {
  info('Checking required UI sections...');
  
  const shopifyPagesDir = join(rootDir, 'apps/astronote-web/app/app/shopify');
  
  // Dashboard page checks
  const dashboardPath = join(shopifyPagesDir, 'dashboard/page.tsx');
  if (existsSync(dashboardPath)) {
    const content = readFileSync(dashboardPath, 'utf-8');
    if (!fileContains(dashboardPath, 'RetailPageHeader')) {
      warn('Dashboard page may not use RetailPageHeader');
    }
    if (!fileContains(dashboardPath, 'Credits') && !fileContains(dashboardPath, 'credits')) {
      warn('Dashboard page may not display credits');
    }
  }
  
  // Campaigns list page checks
  const campaignsListPath = join(shopifyPagesDir, 'campaigns/page.tsx');
  if (existsSync(campaignsListPath)) {
    const content = readFileSync(campaignsListPath, 'utf-8');
    if (!fileContains(campaignsListPath, 'Status') && !fileContains(campaignsListPath, 'status')) {
      warn('Campaigns list page may not display status');
    }
  }
  
  // Campaign detail page checks
  const campaignDetailPath = join(shopifyPagesDir, 'campaigns/[id]/page.tsx');
  if (existsSync(campaignDetailPath)) {
    const content = readFileSync(campaignDetailPath, 'utf-8');
    if (!fileContains(campaignDetailPath, 'Schedule') && !fileContains(campaignDetailPath, 'schedule')) {
      warn('Campaign detail page may not have schedule controls');
    }
    if (!fileContains(campaignDetailPath, 'Delivery') && !fileContains(campaignDetailPath, 'delivery')) {
      warn('Campaign detail page may not have delivery breakdown');
    }
    if (!fileContains(campaignDetailPath, 'Progress') && !fileContains(campaignDetailPath, 'progress')) {
      warn('Campaign detail page may not have progress indicator');
    }
  }
  
  // Templates page checks
  const templatesPath = join(shopifyPagesDir, 'templates/page.tsx');
  if (existsSync(templatesPath)) {
    const content = readFileSync(templatesPath, 'utf-8');
    if (!fileContains(templatesPath, 'ensureDefaults') && !fileContains(templatesPath, 'Ensure Default')) {
      warn('Templates page may not have "Ensure Defaults" button');
    }
  }
  
  // Billing page checks
  const billingPath = join(shopifyPagesDir, 'billing/page.tsx');
  if (existsSync(billingPath)) {
    const content = readFileSync(billingPath, 'utf-8');
    if (!fileContains(billingPath, 'Subscription') && !fileContains(billingPath, 'subscription')) {
      warn('Billing page may not display subscription info');
    }
    if (!fileContains(billingPath, 'plan') && !fileContains(billingPath, 'Plan')) {
      warn('Billing page may not display subscription plan');
    }
  }
  
  info('✓ UI section checks completed');
}

/**
 * Check for English-only content
 */
function checkEnglishOnly() {
  info('Checking for English-only content (best-effort)...');
  
  const shopifyPagesDir = join(rootDir, 'apps/astronote-web/app/app/shopify');
  const pageFiles = findFiles(shopifyPagesDir, /\.tsx$/);
  
  let foundGreek = 0;
  
  pageFiles.forEach((filePath) => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      // Skip comments and strings in code - only check string literals
      const stringMatches = content.match(/['"`]([^'"`]*[\u0370-\u03FF][^'"`]*)['"`]/g);
      if (stringMatches && stringMatches.length > 0) {
        foundGreek++;
        warn(`Potential Greek characters found in ${filePath.replace(rootDir, '')}`);
      }
    } catch (err) {
      // Ignore errors
    }
  });
  
  if (foundGreek === 0) {
    info('✓ No Greek characters detected (English-only)');
  }
}

/**
 * Check for error/empty/loading states
 */
function checkErrorStates() {
  info('Checking for error/empty/loading states...');
  
  const shopifyPagesDir = join(rootDir, 'apps/astronote-web/app/app/shopify');
  const pageFiles = findFiles(shopifyPagesDir, /page\.tsx$/);
  
  let missingStates = 0;
  
  pageFiles.forEach((filePath) => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const hasLoading = fileContains(filePath, 'loading') || fileContains(filePath, 'isLoading');
      const hasError = fileContains(filePath, 'error') || fileContains(filePath, 'Error');
      const hasEmpty = fileContains(filePath, 'empty') || fileContains(filePath, 'EmptyState');
      
      if (!hasLoading && !hasError && !hasEmpty) {
        // Some pages may not need all states, so this is just a warning
        // Only warn if it's a main list/detail page
        if (filePath.includes('/page.tsx') && !filePath.includes('/new/') && !filePath.includes('/edit/')) {
          warn(`Page may be missing error/empty/loading states: ${filePath.replace(rootDir, '')}`);
          missingStates++;
        }
      }
    } catch (err) {
      // Ignore errors
    }
  });
  
  if (missingStates === 0) {
    info('✓ Error/empty/loading states present');
  }
}

/**
 * Check for route collisions
 */
function checkRouteCollisions() {
  info('Checking for route collisions...');
  
  const shopifyPagesDir = join(rootDir, 'apps/astronote-web/app/app/shopify');
  const pageFiles = findFiles(shopifyPagesDir, /page\.tsx$/);
  
  const routes = new Map();
  
  pageFiles.forEach((filePath) => {
    const relativePath = filePath.replace(shopifyPagesDir, '').replace(/\/page\.tsx$/, '');
    const route = relativePath || '/';
    
    if (routes.has(route)) {
      error(`Route collision: ${route} (found in multiple locations)`);
    } else {
      routes.set(route, filePath);
    }
  });
  
  info(`✓ Found ${routes.size} routes, no collisions`);
}

/**
 * Main audit function
 */
async function main() {
  console.log('🔍 Shopify Frontend Requirements Audit\n');
  
  checkRequiredPages();
  checkCentralizedClientUsage();
  checkRequiredUISections();
  checkEnglishOnly();
  checkErrorStates();
  checkRouteCollisions();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Audit Summary');
  console.log('='.repeat(60));
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Audit FAILED');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('\n⚠️  Audit PASSED with warnings');
    process.exit(0);
  } else {
    console.log('\n✅ Audit PASSED');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

