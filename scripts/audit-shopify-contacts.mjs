#!/usr/bin/env node

/**
 * Shopify Contacts Parity Audit Script
 * Performs static checks for:
 * - Required Prisma Contact fields/models exist
 * - Required backend endpoints exist and are tenant-scoped
 * - Shopify contacts UI pages exist and call correct endpoints
 * - Field name alignment (phoneE164/phone, birthDate/birthday, etc.)
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, '..');
const SHOPIFY_API = join(ROOT, 'apps/shopify-api');
const SHOPIFY_FRONTEND = join(ROOT, 'apps/astronote-web/app/app/shopify');
const PRISMA_SCHEMA = join(SHOPIFY_API, 'prisma/schema.prisma');

let errors = [];
let warnings = [];

function logError(message) {
  console.error(`❌ ERROR: ${message}`);
  errors.push(message);
}

function logWarning(message) {
  console.warn(`⚠️  WARNING: ${message}`);
  warnings.push(message);
}

function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

/**
 * Check 1: Prisma Contact model fields
 */
function checkPrismaSchema() {
  console.log('\n📋 Checking Prisma Schema...');
  
  const schema = readFile(PRISMA_SCHEMA);
  if (!schema) {
    logError('Prisma schema not found');
    return;
  }

  // Required fields for Retail alignment
  const requiredFields = [
    'phoneE164',
    'smsConsent',
    'smsConsentStatus', // Retail-aligned field
    'smsConsentAt', // Retail-aligned field
    'isSubscribed', // Retail-aligned field
    'unsubscribeTokenHash', // Retail-aligned field
    'unsubscribedAt', // Retail-aligned field
  ];

  const missingFields = [];
  for (const field of requiredFields) {
    if (!schema.includes(` ${field} `) && !schema.includes(` ${field}\n`) && !schema.includes(` ${field}\r`)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    logError(`Missing Prisma Contact fields: ${missingFields.join(', ')}`);
  } else {
    console.log('✅ Prisma Contact model has all required fields');
  }

  // Check for unique constraint on (shopId, phoneE164)
  if (!schema.includes('@@unique([shopId, phoneE164])')) {
    logWarning('Contact model may be missing unique constraint on (shopId, phoneE164)');
  } else {
    console.log('✅ Contact model has unique constraint on (shopId, phoneE164)');
  }

  // Check for indexes
  const requiredIndexes = [
    'shopId',
    'smsConsentStatus',
    'isSubscribed',
    'unsubscribeTokenHash',
  ];

  for (const indexField of requiredIndexes) {
    if (!schema.includes(`@@index([shopId, ${indexField}])`) && !schema.includes(`@@index([${indexField}])`)) {
      logWarning(`Contact model may be missing index on ${indexField}`);
    }
  }
}

/**
 * Check 2: Backend routes exist and are tenant-scoped
 */
function checkBackendRoutes() {
  console.log('\n🔍 Checking Backend Routes...');

  const routesDir = join(SHOPIFY_API, 'routes');
  if (!existsSync(routesDir)) {
    logError('Backend routes directory not found');
    return;
  }

  // Check for contacts routes file (could be contacts.js or contacts-enhanced.js)
  let contactsRoutesFile = join(routesDir, 'contacts-enhanced.js');
  let contactsRoutes = readFile(contactsRoutesFile);
  if (!contactsRoutes) {
    contactsRoutesFile = join(routesDir, 'contacts.js');
    contactsRoutes = readFile(contactsRoutesFile);
  }
  if (!contactsRoutes) {
    logError('Contacts routes file not found: routes/contacts.js or routes/contacts-enhanced.js');
    return;
  }

  // Check for required routes
  const requiredRoutes = [
    { method: 'GET', path: '/contacts' },
    { method: 'POST', path: '/contacts' },
    { method: 'GET', path: '/contacts/:id' },
    { method: 'PUT', path: '/contacts/:id' },
    { method: 'DELETE', path: '/contacts/:id' },
    { method: 'POST', path: '/contacts/import' },
  ];

  for (const route of requiredRoutes) {
    const methodPattern = route.method === 'GET' ? 'router\\.get' : 
                         route.method === 'POST' ? 'router\\.post' :
                         route.method === 'PUT' ? 'router\\.put' :
                         route.method === 'DELETE' ? 'router\\.delete' : null;
    
    if (methodPattern) {
      const pathPattern = route.path.replace(':', '\\w+');
      const regex = new RegExp(`${methodPattern}\\(['"]${pathPattern}['"]`, 'i');
      if (!regex.test(contactsRoutes)) {
        logWarning(`${route.method} ${route.path} may not be registered`);
      } else {
        console.log(`✅ Route ${route.method} ${route.path} found`);
      }
    }
  }

  // Check for tenant resolver middleware usage
  if (!contactsRoutes.includes('resolveStore') && !contactsRoutes.includes('store-resolution')) {
    logWarning('Contacts routes may not use tenant resolver middleware');
  } else {
    console.log('✅ Contacts routes appear to use tenant resolver');
  }
}

/**
 * Check 3: Frontend pages and API usage
 */
function checkFrontendPages() {
  console.log('\n🎨 Checking Frontend Pages...');

  const contactsPage = join(SHOPIFY_FRONTEND, 'contacts/page.tsx');
  if (!existsSync(contactsPage)) {
    logError('Contacts list page not found: app/app/shopify/contacts/page.tsx');
  } else {
    console.log('✅ Contacts list page exists');
  }

  const newContactPage = join(SHOPIFY_FRONTEND, 'contacts/new/page.tsx');
  if (!existsSync(newContactPage)) {
    logError('New contact page not found: app/app/shopify/contacts/new/page.tsx');
  } else {
    console.log('✅ New contact page exists');
  }

  const importPage = join(SHOPIFY_FRONTEND, 'contacts/import/page.tsx');
  if (!existsSync(importPage)) {
    logWarning('Contacts import page not found: app/app/shopify/contacts/import/page.tsx');
  } else {
    console.log('✅ Contacts import page exists');
  }

  const detailPage = join(SHOPIFY_FRONTEND, 'contacts/[id]/page.tsx');
  if (!existsSync(detailPage)) {
    logError('Contact detail page not found: app/app/shopify/contacts/[id]/page.tsx');
  } else {
    console.log('✅ Contact detail page exists');
  }

  // Check API client usage
  const apiClientFile = join(ROOT, 'apps/astronote-web/src/lib/shopify/api/contacts.ts');
  const apiClient = readFile(apiClientFile);
  if (!apiClient) {
    logError('Contacts API client not found');
  } else {
    // Check for Retail-aligned field support
    if (apiClient.includes('phone?:') && apiClient.includes('phoneE164')) {
      console.log('✅ API client supports both phone and phoneE164 fields');
    } else {
      logWarning('API client may not support Retail-aligned field names');
    }

    if (apiClient.includes('birthday?:') || apiClient.includes('birthday?:')) {
      console.log('✅ API client supports birthday field');
    }

    if (apiClient.includes('isSubscribed?:')) {
      console.log('✅ API client supports isSubscribed field');
    }

    if (apiClient.includes('items?:') || apiClient.includes('items?:')) {
      console.log('✅ API client supports Retail-aligned items field');
    }
  }
}

/**
 * Check 4: Service layer field mapping
 */
function checkServiceLayer() {
  console.log('\n⚙️  Checking Service Layer...');

  const contactsService = join(SHOPIFY_API, 'services/contacts.js');
  const serviceCode = readFile(contactsService);
  if (!serviceCode) {
    logError('Contacts service not found');
    return;
  }

  // Check for Retail-aligned field mapping
  if (serviceCode.includes('phone: contact.phoneE164') || serviceCode.includes('phone: contact.phoneE164')) {
    console.log('✅ Service maps phoneE164 to phone field');
  } else {
    logWarning('Service may not map phoneE164 to phone field');
  }

  if (serviceCode.includes('birthday: contact.birthDate') || serviceCode.includes('birthday: contact.birthDate')) {
    console.log('✅ Service maps birthDate to birthday field');
  } else {
    logWarning('Service may not map birthDate to birthday field');
  }

  // Check for libphonenumber-js usage
  if (serviceCode.includes('libphonenumber-js') || serviceCode.includes('normalizePhoneToE164')) {
    console.log('✅ Service uses libphonenumber-js for phone normalization');
  } else {
    logWarning('Service may not use libphonenumber-js for phone normalization');
  }

  // Check for unsubscribe token hash generation
  if (serviceCode.includes('unsubscribeTokenHash') || serviceCode.includes('unsubTokenHash')) {
    console.log('✅ Service generates unsubscribe token hash');
  } else {
    logWarning('Service may not generate unsubscribe token hash');
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Shopify Contacts Parity Audit\n');
  console.log('='.repeat(60));

  checkPrismaSchema();
  checkBackendRoutes();
  checkFrontendPages();
  checkServiceLayer();

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Audit FAILED - Please fix the errors above');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('\n⚠️  Audit PASSED with warnings - Review warnings above');
    process.exit(0);
  } else {
    console.log('\n✅ Audit PASSED - All checks successful');
    process.exit(0);
  }
}

main();

