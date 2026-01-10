#!/usr/bin/env node

/**
 * Shopify Frontend API Usage Audit Script
 * Statically verifies frontend API calls match backend routes
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
 * Extract backend routes from route files
 */
function extractBackendRoutes() {
  info('Extracting backend routes...');
  
  const routesDir = join(rootDir, 'apps/shopify-api/routes');
  const routeFiles = findFiles(routesDir, /\.js$/);
  
  const routes = new Set();
  
  routeFiles.forEach(filePath => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Match route definitions: r.get('/path', ...), router.get('/path', ...), etc.
      const routePatterns = [
        /\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g,
        /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g,
      ];
      
      routePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const method = match[1].toUpperCase();
          const path = match[2];
          routes.add(`${method} ${path}`);
        }
      });
    } catch (err) {
      // Ignore errors
    }
  });
  
  info(`✓ Found ${routes.size} backend routes`);
  return routes;
}

/**
 * Extract frontend API calls
 */
function extractFrontendApiCalls() {
  info('Extracting frontend API calls...');
  
  const shopifyDir = join(rootDir, 'apps/astronote-web/app/app/shopify');
  const apiClientDir = join(rootDir, 'apps/astronote-web/src/lib/shopify/api');
  
  const apiCalls = [];
  
  // Check API client files
  const apiClientFiles = findFiles(apiClientDir, /\.ts$/);
  apiClientFiles.forEach(filePath => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Match shopifyApi.get/post/put/delete calls
      const apiPattern = /shopifyApi\.(get|post|put|delete|patch)\s*<[^>]*>\s*\(['"]([^'"]+)['"]/g;
      
      let match;
      while ((match = apiPattern.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];
        apiCalls.push({
          method,
          path,
          file: filePath.replace(rootDir, ''),
          type: 'api-client',
        });
      }
    } catch (err) {
      // Ignore errors
    }
  });
  
  // Check page files for direct fetch calls
  const pageFiles = findFiles(shopifyDir, /\.tsx?$/);
  pageFiles.forEach(filePath => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Check for direct fetch calls to shopify-api
      const fetchPattern = /fetch\s*\(\s*[`'"]([^`'"]*shopify[^`'"]*|[^`'"]*localhost[^`'"]*|[^`'"]*onrender[^`'"]*)[`'"]/gi;
      
      let match;
      while ((match = fetchPattern.exec(content)) !== null) {
        const url = match[1];
        if (url.includes('shopify') || url.includes('localhost') || url.includes('onrender')) {
          warn(`Direct fetch call found in ${filePath.replace(rootDir, '')}: ${url}`);
          apiCalls.push({
            method: 'UNKNOWN',
            path: url,
            file: filePath.replace(rootDir, ''),
            type: 'direct-fetch',
          });
        }
      }
      
      // Check for hardcoded API URLs
      const hardcodedUrlPattern = /['"](https?:\/\/[^'"]*(?:localhost|127\.0\.0\.1|onrender)[^'"]*)['"]/g;
      while ((match = hardcodedUrlPattern.exec(content)) !== null) {
        const url = match[1];
        if (url.includes('shopify-api') || url.includes('shopify')) {
          warn(`Hardcoded URL found in ${filePath.replace(rootDir, '')}: ${url}`);
        }
      }
    } catch (err) {
      // Ignore errors
    }
  });
  
  info(`✓ Found ${apiCalls.length} frontend API calls`);
  return apiCalls;
}

/**
 * Check if API calls use centralized client
 */
function checkCentralizedClient() {
  info('Checking centralized client usage...');
  
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
  
  // Check for response interceptor
  if (!content.includes('interceptors.response')) {
    warn('Centralized client may not have response interceptor');
  } else {
    info('✓ Centralized client has response interceptor');
  }
}

/**
 * Verify API endpoint mappings
 */
function verifyEndpointMappings(backendRoutes, frontendCalls) {
  info('Verifying endpoint mappings...');
  
  // Normalize backend routes (remove :id params for matching)
  const normalizedBackendRoutes = new Map();
  backendRoutes.forEach(route => {
    const [method, path] = route.split(' ');
    const normalized = path.replace(/:[^/]+/g, ':id');
    normalizedBackendRoutes.set(`${method} ${normalized}`, route);
  });
  
  // Check frontend calls
  const unmatchedCalls = [];
  
  frontendCalls.forEach(call => {
    if (call.type === 'direct-fetch') {
      error(`Direct fetch call bypassing centralized client: ${call.file}`);
      return;
    }
    
    const [method, path] = [call.method, call.path];
    const normalized = path.replace(/\/[^/]+$/g, '/:id').replace(/\/[^/]+\/[^/]+$/g, '/:id/:sub');
    
    // Check if route exists (exact match or normalized match)
    const exactMatch = normalizedBackendRoutes.has(`${method} ${path}`);
    const normalizedMatch = normalizedBackendRoutes.has(`${method} ${normalized}`);
    
    if (!exactMatch && !normalizedMatch) {
      // Some routes are dynamic (/:id), so check if pattern matches
      const patternMatch = Array.from(normalizedBackendRoutes.keys()).some(route => {
        const [routeMethod, routePath] = route.split(' ');
        if (routeMethod !== method) return false;
        
        // Convert route path to regex pattern
        const routePattern = routePath.replace(/:[^/]+/g, '[^/]+');
        const routeRegex = new RegExp(`^${routePattern}$`);
        return routeRegex.test(path);
      });
      
      if (!patternMatch) {
        unmatchedCalls.push(call);
      }
    }
  });
  
  if (unmatchedCalls.length > 0) {
    unmatchedCalls.forEach(call => {
      warn(`Unmatched API call: ${call.method} ${call.path} in ${call.file}`);
    });
  } else {
    info('✓ All API calls match backend routes');
  }
}

/**
 * Check for missing required parameters
 */
function checkRequiredParameters() {
  info('Checking for missing required parameters...');
  
  const billingApiPath = join(rootDir, 'apps/astronote-web/src/lib/shopify/api/billing.ts');
  if (existsSync(billingApiPath)) {
    const content = readFileSync(billingApiPath, 'utf-8');
    
    // Check if getPackages accepts currency parameter
    if (content.includes('getPackages') && !content.includes('currency')) {
      warn('getPackages may not accept currency parameter');
    } else {
      info('✓ getPackages accepts currency parameter');
    }
  }
  
  const templatesApiPath = join(rootDir, 'apps/astronote-web/src/lib/shopify/api/templates.ts');
  if (existsSync(templatesApiPath)) {
    const content = readFileSync(templatesApiPath, 'utf-8');
    
    // Check if list accepts eshopType parameter
    if (content.includes('list') && !content.includes('eshopType')) {
      warn('templatesApi.list may not accept eshopType parameter');
    } else {
      info('✓ templatesApi.list accepts eshopType parameter');
    }
  }
}

/**
 * Main audit function
 */
async function main() {
  console.log('🔍 Shopify Frontend API Usage Audit\n');
  
  checkCentralizedClient();
  
  const backendRoutes = extractBackendRoutes();
  const frontendCalls = extractFrontendApiCalls();
  
  verifyEndpointMappings(backendRoutes, frontendCalls);
  checkRequiredParameters();
  
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

