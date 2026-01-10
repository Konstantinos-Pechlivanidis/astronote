#!/usr/bin/env node

/**
 * Shopify UI Consistency Audit Script
 * Statically verifies UI consistency, layout usage, and component patterns
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
 * Check if ShopifyShell exists and is used
 */
function checkLayoutShell() {
  info('Checking layout shell...');
  
  const shellPath = join(rootDir, 'apps/astronote-web/src/components/shopify/ShopifyShell.tsx');
  if (!existsSync(shellPath)) {
    error('ShopifyShell component not found');
    return;
  }
  
  const layoutPath = join(rootDir, 'apps/astronote-web/app/app/shopify/layout.tsx');
  if (!existsSync(layoutPath)) {
    error('Shopify layout.tsx not found');
    return;
  }
  
  const layoutContent = readFileSync(layoutPath, 'utf-8');
  if (!layoutContent.includes('ShopifyShell')) {
    error('Shopify layout.tsx does not use ShopifyShell');
  } else {
    info('✓ ShopifyShell found and used in layout');
  }
}

/**
 * Check navigation components
 */
function checkNavigation() {
  info('Checking navigation components...');
  
  const sidebarPath = join(rootDir, 'apps/astronote-web/app/app/shopify/_components/ShopifySidebar.tsx');
  const topbarPath = join(rootDir, 'apps/astronote-web/app/app/shopify/_components/ShopifyTopbar.tsx');
  const mobileNavPath = join(rootDir, 'apps/astronote-web/app/app/shopify/_components/ShopifyMobileNav.tsx');
  const navListPath = join(rootDir, 'apps/astronote-web/app/app/shopify/_components/ShopifyNavList.tsx');
  
  if (!existsSync(sidebarPath)) {
    error('ShopifySidebar component not found');
  } else {
    info('✓ ShopifySidebar found');
  }
  
  if (!existsSync(topbarPath)) {
    error('ShopifyTopbar component not found');
  } else {
    info('✓ ShopifyTopbar found');
  }
  
  if (!existsSync(mobileNavPath)) {
    error('ShopifyMobileNav component not found');
  } else {
    info('✓ ShopifyMobileNav found');
  }
  
  if (!existsSync(navListPath)) {
    error('ShopifyNavList component not found');
  } else {
    info('✓ ShopifyNavList found');
  }
  
  // Check if shell uses these components
  const shellPath = join(rootDir, 'apps/astronote-web/src/components/shopify/ShopifyShell.tsx');
  if (existsSync(shellPath)) {
    const shellContent = readFileSync(shellPath, 'utf-8');
    if (!shellContent.includes('ShopifySidebar')) {
      error('ShopifyShell does not use ShopifySidebar');
    }
    if (!shellContent.includes('ShopifyTopbar')) {
      error('ShopifyShell does not use ShopifyTopbar');
    }
    if (!shellContent.includes('ShopifyMobileNav')) {
      error('ShopifyShell does not use ShopifyMobileNav');
    }
  }
}

/**
 * Check page header usage
 */
function checkPageHeaders() {
  info('Checking page header usage...');
  
  const pages = [
    'apps/astronote-web/app/app/shopify/dashboard/page.tsx',
    'apps/astronote-web/app/app/shopify/campaigns/page.tsx',
    'apps/astronote-web/app/app/shopify/contacts/page.tsx',
    'apps/astronote-web/app/app/shopify/templates/page.tsx',
    'apps/astronote-web/app/app/shopify/automations/page.tsx',
    'apps/astronote-web/app/app/shopify/settings/page.tsx',
  ];
  
  pages.forEach(pagePath => {
    const fullPath = join(rootDir, pagePath);
    if (!existsSync(fullPath)) {
      warn(`Page not found: ${pagePath}`);
      return;
    }
    
    const content = readFileSync(fullPath, 'utf-8');
    
    if (!content.includes('RetailPageHeader')) {
      warn(`${pagePath} does not use RetailPageHeader`);
    }
    
    if (!content.includes('RetailPageLayout')) {
      error(`${pagePath} does not use RetailPageLayout`);
    }
  });
  
  info('✓ Page header checks completed');
}

/**
 * Check for hardcoded colors (best-effort)
 */
function checkHardcodedColors() {
  info('Checking for hardcoded colors...');
  
  const shopifyPages = findFiles(
    join(rootDir, 'apps/astronote-web/app/app/shopify'),
    /\.tsx$/
  );
  
  const colorPatterns = [
    /#[0-9a-fA-F]{3,6}/g, // Hex colors
    /rgb\(/g, // RGB colors
    /rgba\(/g, // RGBA colors
  ];
  
  let foundColors = 0;
  
  shopifyPages.forEach(pagePath => {
    const content = readFileSync(pagePath, 'utf-8');
    
    // Skip if it's a comment or string literal that's clearly a variable
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }
      
      // Check for hardcoded colors (but allow CSS variables and Tailwind classes)
      if (line.includes('#') && !line.includes('--color-') && !line.includes('text-') && !line.includes('bg-') && !line.includes('border-')) {
        const hexMatch = line.match(/#[0-9a-fA-F]{3,6}/);
        if (hexMatch) {
          foundColors++;
          warn(`Potential hardcoded color in ${pagePath}:${idx + 1}: ${hexMatch[0]}`);
        }
      }
    });
  });
  
  if (foundColors === 0) {
    info('✓ No obvious hardcoded colors found');
  }
}

/**
 * Check for broken imports
 */
function checkImports() {
  info('Checking for broken imports...');
  
  const shopifyPages = findFiles(
    join(rootDir, 'apps/astronote-web/app/app/shopify'),
    /\.tsx$/
  );
  
  shopifyPages.forEach(pagePath => {
    const content = readFileSync(pagePath, 'utf-8');
    const importLines = content.match(/^import .+ from ['"].+['"];?$/gm) || [];
    
    importLines.forEach(importLine => {
      // Extract import path
      const match = importLine.match(/from ['"](.+)['"]/);
      if (!match) return;
      
      const importPath = match[1];
      
      // Skip external imports
      if (!importPath.startsWith('@/') && !importPath.startsWith('./') && !importPath.startsWith('../')) {
        return;
      }
      
      // Check if it's a relative import
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const pageDir = dirname(pagePath);
        const resolvedPath = join(pageDir, importPath);
        const possibleExtensions = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'];
        
        let found = false;
        for (const ext of possibleExtensions) {
          if (existsSync(resolvedPath + ext) || existsSync(resolvedPath)) {
            found = true;
            break;
          }
        }
        
        if (!found) {
          error(`Broken import in ${pagePath}: ${importPath}`);
        }
      }
    });
  });
  
  info('✓ Import checks completed');
}

/**
 * Check for route collisions
 */
function checkRouteCollisions() {
  info('Checking for route collisions...');
  
  const shopifyDir = join(rootDir, 'apps/astronote-web/app/app/shopify');
  const pages = findFiles(shopifyDir, /page\.tsx$/);
  
  const routes = new Map();
  
  pages.forEach(pagePath => {
    const relativePath = pagePath.replace(shopifyDir, '').replace(/\/page\.tsx$/, '');
    const route = relativePath || '/';
    
    if (routes.has(route)) {
      error(`Route collision: ${route} defined in both ${routes.get(route)} and ${pagePath}`);
    } else {
      routes.set(route, pagePath);
    }
  });
  
  info(`✓ Found ${routes.size} routes, no collisions`);
}

/**
 * Main audit function
 */
async function main() {
  console.log('🔍 Shopify UI Consistency Audit\n');
  
  checkLayoutShell();
  checkNavigation();
  checkPageHeaders();
  checkHardcodedColors();
  checkImports();
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

