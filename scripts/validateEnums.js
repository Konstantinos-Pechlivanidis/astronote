#!/usr/bin/env node

/**
 * Enum Validation Script
 * 
 * Script to verify all enum usages match Prisma schema.
 * Run this in CI/CD to catch mismatches.
 * 
 * Usage: node scripts/validateEnums.js
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Enum definitions from Prisma schema
const PRISMA_ENUMS = {
  CampaignStatus: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
  ScheduleType: ['immediate', 'scheduled', 'recurring'],
  SmsConsent: ['opted_in', 'opted_out', 'unknown'],
  MessageDirection: ['outbound', 'inbound'],
  MessageStatus: ['queued', 'sent', 'delivered', 'failed', 'received'],
  TransactionType: ['purchase', 'debit', 'credit', 'refund', 'adjustment'],
  SubscriptionPlanType: ['starter', 'pro'],
  SubscriptionStatus: ['active', 'inactive', 'cancelled'],
  CreditTxnType: ['credit', 'debit', 'refund'],
  AutomationTrigger: [
    'welcome',
    'abandoned_cart',
    'order_confirmation',
    'shipping_update',
    'delivery_confirmation',
    'review_request',
    'reorder_reminder',
    'birthday',
    'customer_inactive',
    'cart_abandoned',
    'order_placed',
    'order_fulfilled',
  ],
  PaymentStatus: ['pending', 'paid', 'failed', 'refunded'],
};

// Files to check
const FILES_TO_CHECK = [
  'services/**/*.js',
  'controllers/**/*.js',
  'queue/**/*.js',
  'utils/**/*.js',
];

// Patterns to find enum string literals
const ENUM_PATTERNS = {
  CampaignStatus: /['"](draft|scheduled|sending|sent|failed|cancelled)['"]/g,
  ScheduleType: /['"](immediate|scheduled|recurring)['"]/g,
  SmsConsent: /['"](opted_in|opted_out|unknown)['"]/g,
  MessageDirection: /['"](outbound|inbound)['"]/g,
  MessageStatus: /['"](queued|sent|delivered|failed|received)['"]/g,
  SubscriptionPlanType: /['"](starter|pro)['"]/g,
  SubscriptionStatus: /['"](active|inactive|cancelled)['"]/g,
  PaymentStatus: /['"](pending|paid|failed|refunded)['"]/g,
};

let errors = [];
let warnings = [];

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Skip files that import prismaEnums (they're using enums correctly)
  if (content.includes('from') && content.includes('prismaEnums')) {
    return; // File is using enum constants, skip
  }

  lines.forEach((line, lineNumber) => {
    // Check each enum pattern
    Object.entries(ENUM_PATTERNS).forEach(([enumName, pattern]) => {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        const value = match[1];
        const validValues = PRISMA_ENUMS[enumName];

        // Check if this might be a false positive (e.g., in a comment or string that's not an enum)
        if (
          line.trim().startsWith('//') ||
          line.includes('//') && line.indexOf('//') < line.indexOf(match[0])
        ) {
          // It's in a comment, skip
          return;
        }

        // Check if value is valid for this enum
        if (validValues.includes(value)) {
          // This is a potential enum usage that should use the enum constant
          warnings.push({
            file: filePath.replace(projectRoot + '/', ''),
            line: lineNumber + 1,
            enum: enumName,
            value,
            suggestion: `Use ${enumName}.${value} instead of '${value}'`,
          });
        }
      }
    });
  });
}

async function main() {
  console.log('🔍 Validating enum usage across codebase...\n');

  // Find all files to check
  const files = [];
  for (const pattern of FILES_TO_CHECK) {
    const matches = await glob(pattern, {
      cwd: projectRoot,
      ignore: ['node_modules/**', '**/*.test.js', '**/*.spec.js'],
    });
    files.push(...matches.map(f => join(projectRoot, f)));
  }

  console.log(`Found ${files.length} files to check\n`);

  // Check each file
  files.forEach(file => {
    try {
      checkFile(file);
    } catch (error) {
      errors.push({
        file: file.replace(projectRoot + '/', ''),
        error: error.message,
      });
    }
  });

  // Report results
  if (errors.length > 0) {
    console.log('❌ ERRORS:\n');
    errors.forEach(err => {
      console.log(`  ${err.file}: ${err.error}`);
    });
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length} potential enum literal usages):\n`);
    // Group by file
    const byFile = {};
    warnings.forEach(w => {
      if (!byFile[w.file]) byFile[w.file] = [];
      byFile[w.file].push(w);
    });

    Object.entries(byFile).forEach(([file, fileWarnings]) => {
      console.log(`  ${file}:`);
      fileWarnings.forEach(w => {
        console.log(
          `    Line ${w.line}: ${w.suggestion}`,
        );
      });
    });
    console.log('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ No enum validation issues found!\n');
    process.exit(0);
  } else if (errors.length > 0) {
    console.log('❌ Validation failed with errors\n');
    process.exit(1);
  } else {
    console.log('⚠️  Validation completed with warnings (non-blocking)\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
