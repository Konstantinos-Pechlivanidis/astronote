#!/usr/bin/env node

/**
 * Shopify Automations GraphQL Audit Script
 * Statically verifies GraphQL query quality, idempotency, and frontend integration
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
 * Check if GraphQL queries are stored in known directory
 */
function checkGraphQLQueries() {
  info('Checking GraphQL query files...');
  
  const graphqlFiles = findFiles(join(rootDir, 'apps/shopify-api'), /\.graphql$/);
  const graphqlInCode = findFiles(join(rootDir, 'apps/shopify-api'), /\.(js|ts)$/);
  
  // Check if shopify-graphql.js exists and uses queries
  const shopifyGraphqlPath = join(rootDir, 'apps/shopify-api/services/shopify-graphql.js');
  if (!existsSync(shopifyGraphqlPath)) {
    error('shopify-graphql.js service not found');
    return;
  }
  
  const shopifyGraphqlContent = readFileSync(shopifyGraphqlPath, 'utf-8');
  
  // Check for inline queries (should use variables)
  const inlineQueryPattern = /query\s+\w+\s*\([^)]*\)\s*\{[^}]*\$\{[^}]+\}/;
  if (inlineQueryPattern.test(shopifyGraphqlContent)) {
    warn('Potential unsafe string interpolation in GraphQL queries');
  }
  
  // Check that queries use variables
  const queryWithVariables = /query\s+\w+\s*\([^)]*\$[^)]+\)/;
  const queries = shopifyGraphqlContent.match(/query\s+\w+/g) || [];
  queries.forEach(queryMatch => {
    const queryName = queryMatch.replace('query ', '');
    const queryBlock = shopifyGraphqlContent.substring(
      shopifyGraphqlContent.indexOf(queryMatch),
      shopifyGraphqlContent.indexOf('}', shopifyGraphqlContent.indexOf(queryMatch)) + 1
    );
    
    // Check if query uses variables
    if (!queryBlock.includes('$')) {
      warn(`Query ${queryName} may not use variables for dynamic values`);
    }
  });
  
  info(`✓ Found ${queries.length} GraphQL queries in shopify-graphql.js`);
}

/**
 * Check pagination helpers
 */
function checkPagination() {
  info('Checking pagination implementation...');
  
  const shopifyGraphqlPath = join(rootDir, 'apps/shopify-api/services/shopify-graphql.js');
  if (!existsSync(shopifyGraphqlPath)) {
    return;
  }
  
  const content = readFileSync(shopifyGraphqlPath, 'utf-8');
  
  // Check for cursor-based pagination
  const hasPagination = content.includes('pageInfo') && 
                         content.includes('hasNextPage') && 
                         content.includes('endCursor');
  
  if (!hasPagination) {
    warn('Pagination may not be implemented for list queries');
  } else {
    // Check for maxPages limit
    if (!content.includes('maxPages')) {
      warn('Pagination may not have maxPages limit to prevent infinite loops');
    }
    
    info('✓ Pagination implementation found');
  }
}

/**
 * Check webhook handlers for deduplication
 */
function checkWebhookDeduplication() {
  info('Checking webhook deduplication...');
  
  const webhookControllerPath = join(rootDir, 'apps/shopify-api/controllers/automation-webhooks.js');
  if (!existsSync(webhookControllerPath)) {
    error('automation-webhooks.js controller not found');
    return;
  }
  
  const content = readFileSync(webhookControllerPath, 'utf-8');
  
  // Check for webhook replay protection
  const hasReplayProtection = content.includes('checkWebhookReplay') || 
                               content.includes('recordWebhookEvent');
  
  if (!hasReplayProtection) {
    error('Webhook handlers do not use replay protection');
  } else {
    info('✓ Webhook replay protection found');
  }
  
  // Check specific handlers
  const handlers = ['handleOrderCreated', 'handleOrderFulfilled', 'handleAbandonedCheckout'];
  handlers.forEach(handler => {
    if (content.includes(`export async function ${handler}`)) {
      const handlerContent = content.substring(
        content.indexOf(`export async function ${handler}`),
        content.indexOf('export async function', content.indexOf(`export async function ${handler}`) + 1) || content.length
      );
      
      if (!handlerContent.includes('checkWebhookReplay') && !handlerContent.includes('recordWebhookEvent')) {
        error(`${handler} does not use webhook replay protection`);
      }
    }
  });
}

/**
 * Check Prisma schema alignment
 */
function checkPrismaSchema() {
  info('Checking Prisma schema alignment...');
  
  const schemaPath = join(rootDir, 'apps/shopify-api/prisma/schema.prisma');
  if (!existsSync(schemaPath)) {
    error('Prisma schema not found');
    return;
  }
  
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  
  // Check for required models
  const requiredModels = [
    'EventProcessingState',
    'ScheduledAutomation',
    'WebhookEvent',
    'Automation',
    'UserAutomation',
  ];
  
  requiredModels.forEach(model => {
    if (!schemaContent.includes(`model ${model}`)) {
      error(`Prisma model ${model} not found`);
    }
  });
  
  // Check for EventProcessingState unique constraint
  if (schemaContent.includes('model EventProcessingState')) {
    if (!schemaContent.includes('@@unique([shopId, automationType])')) {
      error('EventProcessingState missing unique constraint on (shopId, automationType)');
    }
  }
  
  // Check for ScheduledAutomation unique jobId
  if (schemaContent.includes('model ScheduledAutomation')) {
    if (!schemaContent.includes('jobId') || !schemaContent.includes('@unique')) {
      warn('ScheduledAutomation may not have unique jobId constraint');
    }
  }
  
  info('✓ Prisma schema checks completed');
}

/**
 * Check frontend automations pages
 */
function checkFrontendPages() {
  info('Checking frontend automations pages...');
  
  const pages = [
    'apps/astronote-web/app/app/shopify/automations/page.tsx',
    'apps/astronote-web/app/app/shopify/automations/[id]/page.tsx',
  ];
  
  pages.forEach(pagePath => {
    const fullPath = join(rootDir, pagePath);
    if (!existsSync(fullPath)) {
      warn(`Frontend page not found: ${pagePath}`);
      return;
    }
    
    const content = readFileSync(fullPath, 'utf-8');
    
    // Check for error handling
    if (!content.includes('error') && !content.includes('Error')) {
      warn(`${pagePath} may not have error handling`);
    }
    
    // Check for API client usage
    if (!content.includes('automationsApi') && !content.includes('shopifyApi')) {
      warn(`${pagePath} may not use centralized API client`);
    }
    
    // Check for loading states
    if (!content.includes('isLoading') && !content.includes('loading')) {
      warn(`${pagePath} may not have loading states`);
    }
  });
  
  info('✓ Frontend pages checks completed');
}

/**
 * Check API client usage
 */
function checkApiClient() {
  info('Checking API client usage...');
  
  const apiClientPath = join(rootDir, 'apps/astronote-web/src/lib/shopify/api/automations.ts');
  if (!existsSync(apiClientPath)) {
    warn('Frontend automations API client not found');
    return;
  }
  
  const content = readFileSync(apiClientPath, 'utf-8');
  
  // Check for centralized API client
  if (!content.includes('shopifyApi')) {
    error('Frontend automations API client does not use centralized shopifyApi');
  }
  
  info('✓ API client checks completed');
}

/**
 * Check GraphQL response validation
 */
function checkResponseValidation() {
  info('Checking GraphQL response validation...');
  
  const schemaPath = join(rootDir, 'apps/shopify-api/schemas/graphql-responses.schema.js');
  if (!existsSync(schemaPath)) {
    warn('GraphQL response validation schemas not found');
    return;
  }
  
  const shopifyGraphqlPath = join(rootDir, 'apps/shopify-api/services/shopify-graphql.js');
  if (!existsSync(shopifyGraphqlPath)) {
    return;
  }
  
  const content = readFileSync(shopifyGraphqlPath, 'utf-8');
  
  // Check for zod validation
  if (!content.includes('validateGraphQLResponse') && !content.includes('zod')) {
    warn('GraphQL responses may not be validated with zod');
  } else {
    info('✓ GraphQL response validation found');
  }
}

/**
 * Check retry logic
 */
function checkRetryLogic() {
  info('Checking retry logic...');
  
  const shopifyGraphqlPath = join(rootDir, 'apps/shopify-api/services/shopify-graphql.js');
  if (!existsSync(shopifyGraphqlPath)) {
    return;
  }
  
  const content = readFileSync(shopifyGraphqlPath, 'utf-8');
  
  // Check for retry logic
  if (!content.includes('maxRetries') && !content.includes('retry')) {
    warn('GraphQL client may not have retry logic');
  } else {
    // Check for exponential backoff
    if (!content.includes('exponential') && !content.includes('backoff')) {
      warn('Retry logic may not use exponential backoff');
    }
    
    // Check for 429 handling
    if (!content.includes('429')) {
      warn('GraphQL client may not handle 429 rate limit errors');
    }
    
    info('✓ Retry logic found');
  }
}

/**
 * Main audit function
 */
async function main() {
  console.log('🔍 Shopify Automations GraphQL Audit\n');
  
  checkGraphQLQueries();
  checkPagination();
  checkWebhookDeduplication();
  checkPrismaSchema();
  checkFrontendPages();
  checkApiClient();
  checkResponseValidation();
  checkRetryLogic();
  
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

