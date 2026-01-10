#!/usr/bin/env node

/**
 * Release Gate Aggregator Script
 * 
 * Discovers and runs all audit scripts, then runs all builds.
 * Reports PASS/FAIL summary and exits non-zero if any check fails.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Audit execution order (priority-based)
const AUDIT_ORDER = [
  // 1) Tenant/Auth/Headers
  { name: 'shopify:headers', command: 'npm run audit:shopify:headers' },
  
  // 2) Frontend API Usage
  { name: 'shopify:frontend-api', command: 'npm run audit:shopify:frontend-api' },
  { name: 'shopify:frontend-requirements', command: 'npm run audit:shopify:frontend-requirements' },
  
  // 3) Prisma Alignment
  { name: 'deploy:prisma', command: 'npm run audit:deploy:prisma' },
  { name: 'shopify:prisma', command: 'npm run audit:shopify:prisma' },
  
  // 4) Campaigns/Mitto
  { name: 'shopify:campaigns', command: 'npm run audit:shopify:campaigns' },
  { name: 'shopify:mitto:campaigns', command: 'npm run audit:shopify:mitto:campaigns' },
  { name: 'shopify:mitto:statuses', command: 'npm run audit:shopify:mitto:statuses' },
  { name: 'shopify:mitto:webhooks', command: 'npm run audit:shopify:mitto:webhooks' },
  
  // 5) Unsubscribe/Shortlinks
  { name: 'shopify:unsubscribe', command: 'npm run audit:shopify:unsubscribe' },
  
  // 6) Billing/Subscription
  { name: 'billing', command: 'npm run audit:billing' },
  { name: 'retail:billing:contract', command: 'npm run audit:retail:billing:contract' },
  { name: 'retail:billing:frontend', command: 'npm run audit:retail:billing:frontend' },
  { name: 'shopify:billing', command: 'npm run audit:shopify:billing' },
  { name: 'shopify:subscription-gating', command: 'npm run audit:shopify:subscription-gating' },
  { name: 'shopify:billing-completion', command: 'node scripts/audit-shopify-billing-completion.mjs' },
  
  // 7) UI/UX
  { name: 'shopify:ui', command: 'npm run audit:shopify:ui' },
  { name: 'shopify:campaigns-ui', command: 'npm run audit:shopify:campaigns-ui' },
  { name: 'shopify:campaigns-ui:confirm', command: 'npm run audit:shopify:campaigns-ui:confirm' },
  
  // 8) Deploy Readiness
  { name: 'deploy:shopify-frontend', command: 'npm run audit:deploy:shopify-frontend' },
  
  // 9) E2E/Feature Audits
  { name: 'shopify:e2e', command: 'npm run audit:shopify:e2e' },
  { name: 'shopify:sms', command: 'npm run audit:shopify:sms' },
  { name: 'shopify:contacts', command: 'npm run audit:shopify:contacts' },
  { name: 'shopify:templates', command: 'npm run audit:shopify:templates' },
  { name: 'shopify:settings', command: 'npm run audit:shopify:settings' },
  { name: 'shopify:automations', command: 'npm run audit:shopify:automations' },
];

// Build execution order
const BUILD_ORDER = [
  { name: 'shopify-api', command: 'cd apps/shopify-api && npm run build' },
  { name: 'retail-api', command: 'cd apps/retail-api/apps/api && npm run build' },
  { name: 'astronote-web', command: 'cd apps/astronote-web && npm run build' },
];

const results = {
  audits: [],
  builds: [],
};

function runCommand(name, command, type = 'audit') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${type}: ${name}`);
  console.log(`Command: ${command}`);
  console.log('='.repeat(60));
  
  try {
    const output = execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    
    // More flexible detection: check for success indicators and absence of failure indicators
    // Check for explicit failure patterns (but ignore if they're part of a success message)
    const hasExplicitFailure = (output.includes('FAIL') && !output.includes('PASS')) || 
                                (output.includes('❌') && !output.includes('✅')) ||
                                output.includes('Audit failed') ||
                                output.includes('NOT DONE') ||
                                (output.includes('ERROR') && !output.includes('✅') && !output.includes('PASS'));
    
    // Check for success patterns
    const hasExplicitSuccess = output.includes('PASS') || 
                                output.includes('✅') || 
                                output.includes('passed') || 
                                output.includes('All checks passed') ||
                                output.includes('Compiled successfully') || 
                                output.includes('Generated Prisma Client') ||
                                output.includes('PASS:');
    
    // For builds: success indicator OR no failure with meaningful output OR exit code 0 with any output
    // For audits: must have explicit success AND no explicit failure
    const passed = type === 'build' 
      ? (hasExplicitSuccess || (!hasExplicitFailure && output.length > 0))
      : (hasExplicitSuccess && !hasExplicitFailure);
    
    return {
      name,
      command,
      status: passed ? 'PASS' : 'FAIL',
      output: output.substring(0, 500), // First 500 chars
    };
  } catch (error) {
    return {
      name,
      command,
      status: 'FAIL',
      output: error.stdout?.substring(0, 500) || error.message,
      error: error.message,
    };
  }
}

console.log('🚀 Release Gate: Starting audit and build verification\n');

// Run audits
console.log('\n📋 PHASE 1: Running Audits\n');
for (const audit of AUDIT_ORDER) {
  const result = runCommand(audit.name, audit.command, 'audit');
  results.audits.push(result);
  
  if (result.status === 'FAIL') {
    console.log(`❌ ${audit.name}: FAILED`);
  } else {
    console.log(`✅ ${audit.name}: PASSED`);
  }
}

// Run builds
console.log('\n\n📦 PHASE 2: Running Builds\n');
for (const build of BUILD_ORDER) {
  const result = runCommand(build.name, build.command, 'build');
  results.builds.push(result);
  
  if (result.status === 'FAIL') {
    console.log(`❌ ${build.name}: FAILED`);
  } else {
    console.log(`✅ ${build.name}: PASSED`);
  }
}

// Summary
console.log('\n\n' + '='.repeat(60));
console.log('📊 RELEASE GATE SUMMARY');
console.log('='.repeat(60));

const auditPassed = results.audits.filter(r => r.status === 'PASS').length;
const auditFailed = results.audits.filter(r => r.status === 'FAIL').length;
const buildPassed = results.builds.filter(r => r.status === 'PASS').length;
const buildFailed = results.builds.filter(r => r.status === 'FAIL').length;

console.log(`\nAudits: ${auditPassed}/${results.audits.length} passed, ${auditFailed} failed`);
console.log(`Builds: ${buildPassed}/${results.builds.length} passed, ${buildFailed} failed`);

if (auditFailed > 0) {
  console.log('\n❌ Failed Audits:');
  results.audits.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.name}`);
  });
}

if (buildFailed > 0) {
  console.log('\n❌ Failed Builds:');
  results.builds.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.name}`);
  });
}

const allPassed = auditFailed === 0 && buildFailed === 0;

if (allPassed) {
  console.log('\n✅ RELEASE GATE: ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.log('\n❌ RELEASE GATE: SOME CHECKS FAILED');
  process.exit(1);
}

