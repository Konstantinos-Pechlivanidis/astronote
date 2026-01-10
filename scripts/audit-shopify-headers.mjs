#!/usr/bin/env node

/**
 * Shopify Headers Audit Script
 * Verifies that all API calls use centralized client and include required headers
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
 * Check centralized API client
 */
function checkCentralizedClient() {
  info('Checking centralized API client...');
  
  const axiosPath = join(rootDir, 'apps/astronote-web/src/lib/shopify/api/axios.ts');
  if (!existsSync(axiosPath)) {
    error('Centralized API client not found: axios.ts');
    return;
  }
  
  const content = readFileSync(axiosPath, 'utf-8');
  
  // Check for tenant header injection
  if (!content.includes('X-Shopify-Shop-Domain')) {
    error('Centralized client does not inject X-Shopify-Shop-Domain header');
  } else {
    info('✓ Centralized client injects X-Shopify-Shop-Domain header');
  }
  
  // Check for auth token injection
  if (!content.includes('Authorization') || !content.includes('Bearer')) {
    error('Centralized client does not inject Authorization header');
  } else {
    info('✓ Centralized client injects Authorization header');
  }
  
  // Check for Accept header
  if (!content.includes("'Accept'") && !content.includes('"Accept"')) {
    warn('Centralized client may not set Accept header');
  } else {
    info('✓ Centralized client sets Accept header');
  }
  
  // Check for Content-Type header
  if (!content.includes('Content-Type') || !content.includes('application/json')) {
    error('Centralized client does not set Content-Type header');
  } else {
    info('✓ Centralized client sets Content-Type header');
  }
  
  // Check for public endpoint detection
  if (!content.includes('isPublicEndpoint') && !content.includes('public')) {
    warn('Centralized client may not detect public endpoints');
  } else {
    info('✓ Centralized client detects public endpoints');
  }
  
  // Check for shop domain resolver usage
  if (!content.includes('resolveShopDomain')) {
    error('Centralized client does not use shop domain resolver');
  } else {
    info('✓ Centralized client uses shop domain resolver');
  }
}

/**
 * Check shop domain resolver
 */
function checkShopDomainResolver() {
  info('Checking shop domain resolver...');
  
  const resolverPath = join(rootDir, 'apps/astronote-web/src/lib/shopify/api/shop-domain.ts');
  if (!existsSync(resolverPath)) {
    error('Shop domain resolver not found: shop-domain.ts');
    return;
  }
  
  const content = readFileSync(resolverPath, 'utf-8');
  
  // Check for validation
  if (!content.includes('isValidShopDomain') && !content.includes('normalizeShopDomain')) {
    error('Shop domain resolver does not validate shop domains');
  } else {
    info('✓ Shop domain resolver validates shop domains');
  }
  
  // Check for App Bridge context check
  if (!content.includes('App Bridge') && !content.includes('getShopDomainFromAppBridge')) {
    warn('Shop domain resolver may not check App Bridge context');
  } else {
    info('✓ Shop domain resolver checks App Bridge context');
  }
  
  // Check for sessionStorage usage
  if (!content.includes('sessionStorage')) {
    warn('Shop domain resolver may not use sessionStorage');
  } else {
    info('✓ Shop domain resolver uses sessionStorage');
  }
  
  // Check for URL query param check
  if (!content.includes('URLSearchParams') || !content.includes('get(\'shop\')')) {
    warn('Shop domain resolver may not check URL query params');
  } else {
    info('✓ Shop domain resolver checks URL query params');
  }
}

/**
 * Check for direct fetch/axios calls bypassing client
 */
function checkDirectCalls() {
  info('Checking for direct fetch/axios calls...');
  
  const shopifyDir = join(rootDir, 'apps/astronote-web/app/app/shopify');
  const libDir = join(rootDir, 'apps/astronote-web/src/lib/shopify');
  
  const files = [
    ...findFiles(shopifyDir, /\.tsx?$/),
    ...findFiles(libDir, /\.tsx?$/),
  ];
  
  let foundDirectCalls = 0;
  
  files.forEach(filePath => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Skip if it's the centralized client itself
      if (filePath.includes('axios.ts')) {
        return;
      }
      
      // Check for direct fetch calls to shopify-api
      const fetchPattern = /fetch\s*\(\s*[`'"]([^`'"]*shopify[^`'"]*|[^`'"]*localhost[^`'"]*)[`'"]/gi;
      let match;
      while ((match = fetchPattern.exec(content)) !== null) {
        const url = match[1];
        // Allow auth token exchange (public endpoint)
        if (!url.includes('/auth/shopify-token') && !url.includes('/auth/shopify')) {
          foundDirectCalls++;
          error(`Direct fetch call found in ${filePath.replace(rootDir, '')}: ${url}`);
        }
      }
      
      // Check for direct axios calls (not using shopifyApi)
      const axiosPattern = /axios\.(get|post|put|delete|patch)\s*\(/g;
      let axiosMatch;
      while ((axiosMatch = axiosPattern.exec(content)) !== null) {
        // Check if it's importing shopifyApi or using it
        const lines = content.split('\n');
        const lineIndex = content.substring(0, axiosMatch.index).split('\n').length - 1;
        const context = lines.slice(Math.max(0, lineIndex - 5), lineIndex + 5).join('\n');
        
        // Allow auth token exchange (public endpoint)
        if (!context.includes('/auth/shopify-token') && !context.includes('exchangeShopifyToken')) {
          foundDirectCalls++;
          error(`Direct axios call found in ${filePath.replace(rootDir, '')} (line ${lineIndex + 1})`);
        }
      }
      
      // Check for hardcoded API URLs (skip config files with default values)
      if (!filePath.includes('config.ts') && !filePath.includes('config.js')) {
        const hardcodedUrlPattern = /['"](https?:\/\/[^'"]*(?:localhost|127\.0\.0\.1)[^'"]*)['"]/g;
        while ((match = hardcodedUrlPattern.exec(content)) !== null) {
          const url = match[1];
          // Only flag localhost URLs as they shouldn't be in production code
          if (url.includes('localhost') || url.includes('127.0.0.1')) {
            warn(`Hardcoded localhost URL found in ${filePath.replace(rootDir, '')}: ${url}`);
          }
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
 * Check for header typos
 */
function checkHeaderTypos() {
  info('Checking for header typos...');
  
  const shopifyDir = join(rootDir, 'apps/astronote-web/app/app/shopify');
  const libDir = join(rootDir, 'apps/astronote-web/src/lib/shopify');
  
  const files = [
    ...findFiles(shopifyDir, /\.tsx?$/),
    ...findFiles(libDir, /\.tsx?$/),
  ];
  
  const headerTypos = [
    /X-Shopify-shop-domain/gi,
    /x-shopify-shop-domain/gi,
    /X-SHOPIFY-SHOP-DOMAIN/gi,
    /X-Shopify-ShopDomain/gi,
    /X-ShopifyShopDomain/gi,
  ];
  
  files.forEach(filePath => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Skip comments and strings - only check actual code
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Skip comment lines
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          return;
        }
        
        headerTypos.forEach(pattern => {
          if (pattern.test(line)) {
            // Check if it's in a comment or string
            const commentIndex = line.indexOf('//');
            const stringIndex = line.indexOf("'") || line.indexOf('"');
            const matchIndex = line.search(pattern);
            
            // Only warn if the match is before any comment or is actual code
            if (matchIndex !== -1 && (commentIndex === -1 || matchIndex < commentIndex) && (stringIndex === -1 || matchIndex < stringIndex)) {
              warn(`Potential header typo in ${filePath.replace(rootDir, '')}:${idx + 1}: ${pattern.source}`);
            }
          }
        });
      });
    } catch (err) {
      // Ignore errors
    }
  });
  
  info('✓ Header typo check completed');
}

/**
 * Check that protected endpoints use centralized client
 */
function checkProtectedEndpoints() {
  info('Checking protected endpoint usage...');
  
  const libDir = join(rootDir, 'apps/astronote-web/src/lib/shopify/api');
  const apiFiles = findFiles(libDir, /\.ts$/);
  
  const protectedEndpoints = [
    '/campaigns',
    '/contacts',
    '/templates',
    '/automations',
    '/billing',
    '/subscriptions',
    '/settings',
    '/dashboard',
  ];
  
  apiFiles.forEach(filePath => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Skip utility files that don't make API calls
      if (filePath.includes('shop-domain.ts') || filePath.includes('config.ts')) {
        return;
      }
      
      // Check if file uses shopifyApi
      if (!content.includes('shopifyApi') && !content.includes('from \'./axios\'')) {
        // Skip if it's axios.ts itself
        if (!filePath.includes('axios.ts')) {
          warn(`API file may not use centralized client: ${filePath.replace(rootDir, '')}`);
        }
      }
      
      // Check for protected endpoints
      protectedEndpoints.forEach(endpoint => {
        if (content.includes(endpoint)) {
          // Check if it's using shopifyApi
          const endpointPattern = new RegExp(`['"]${endpoint.replace('/', '\\/')}[^'"]*['"]`, 'g');
          const matches = content.match(endpointPattern);
          if (matches) {
            matches.forEach(match => {
              // Check context around the match
              const matchIndex = content.indexOf(match);
              const context = content.substring(Math.max(0, matchIndex - 100), matchIndex + 100);
              if (!context.includes('shopifyApi') && !context.includes('from \'./axios\'')) {
                warn(`Protected endpoint ${match} may not use centralized client in ${filePath.replace(rootDir, '')}`);
              }
            });
          }
        }
      });
    } catch (err) {
      // Ignore errors
    }
  });
  
  info('✓ Protected endpoint check completed');
}

/**
 * Main audit function
 */
async function main() {
  console.log('🔍 Shopify Headers Audit\n');
  
  checkCentralizedClient();
  checkShopDomainResolver();
  checkDirectCalls();
  checkHeaderTypos();
  checkProtectedEndpoints();
  
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

