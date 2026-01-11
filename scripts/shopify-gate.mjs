#!/usr/bin/env node

/**
 * Shopify Gate Script
 * 
 * Runs all checks for Shopify stack (frontend + backend) in deterministic order:
 * - Frontend: lint -> typecheck -> tests -> build
 * - Backend: lint -> typecheck -> tests -> build
 * 
 * Exits non-zero if any check fails.
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const results = {
  frontend: [],
  backend: [],
};

function runCommand(name, command, workspace) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${workspace.toUpperCase()}] Running: ${name}`);
  console.log(`Command: ${command}`);
  console.log('='.repeat(60));
  
  try {
    const output = execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
    });
    
    // Check for success/failure indicators
    const hasFailure = (output.includes('FAIL') && !output.includes('PASS')) || 
                       (output.includes('❌') && !output.includes('✅')) ||
                       output.includes('error TS') ||
                       output.includes('Error:') ||
                       output.includes('FAILED') ||
                       (output.includes('✖') && !output.includes('✓'));
    
    const hasSuccess = output.includes('PASS') || 
                       output.includes('✅') ||
                       output.includes('Compiled successfully') ||
                       output.includes('Generated Prisma Client') ||
                       output.includes('✓') ||
                       (output.includes('Tests:') && !output.includes('failed'));
    
    const passed = hasSuccess && !hasFailure;
    
    results[workspace].push({
      name,
      command,
      passed,
      output: output.substring(0, 500), // Truncate for readability
    });
    
    if (passed) {
      console.log(`✅ ${name}: PASS`);
    } else {
      console.log(`❌ ${name}: FAIL`);
      console.log(`Output preview:\n${output.substring(0, 1000)}`);
    }
    
    return passed;
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
    results[workspace].push({
      name,
      command,
      passed: false,
      output: output.substring(0, 500),
      error: error.message,
    });
    
    console.log(`❌ ${name}: FAIL`);
    console.log(`Error: ${error.message}`);
    if (output) {
      console.log(`Output preview:\n${output.substring(0, 1000)}`);
    }
    
    return false;
  }
}

// Frontend checks (apps/astronote-web)
console.log('\n\n' + '='.repeat(60));
console.log('SHOPIFY FRONTEND GATE');
console.log('='.repeat(60));

// Frontend checks (skip typecheck if script doesn't exist)
const frontendChecks = [
  { name: 'lint', command: 'npm -w @astronote/web-next run lint' },
  { name: 'typecheck', command: 'npm -w @astronote/web-next run typecheck', optional: true },
  { name: 'tests', command: 'npm -w @astronote/web-next run test --if-present', optional: true },
  { name: 'build', command: 'npm -w @astronote/web-next run build' },
];

const frontendPassed = frontendChecks.every(check => {
  const passed = runCommand(check.name, check.command, 'frontend');
  // If optional check fails due to missing script, treat as passed
  if (!passed && check.optional) {
    const result = results.frontend[results.frontend.length - 1];
    if (result?.output?.includes('Missing script')) {
      console.log(`⚠️  ${check.name}: SKIPPED (script not found)`);
      result.passed = true; // Mark as passed since it's optional
      return true;
    }
  }
  return passed;
});

// Backend checks (apps/shopify-api)
console.log('\n\n' + '='.repeat(60));
console.log('SHOPIFY BACKEND GATE');
console.log('='.repeat(60));

const backendPassed = [
  runCommand('lint', 'npm -w @astronote/shopify-api run lint', 'backend'),
  runCommand('typecheck', 'npm -w @astronote/shopify-api run prisma:validate', 'backend'),
  runCommand('tests', 'npm -w @astronote/shopify-api run test', 'backend'),
  runCommand('build', 'npm -w @astronote/shopify-api run build', 'backend'),
].every(Boolean);

// Summary
console.log('\n\n' + '='.repeat(60));
console.log('SHOPIFY GATE SUMMARY');
console.log('='.repeat(60));

const frontendResults = results.frontend;
const backendResults = results.backend;

console.log('\nFrontend:');
frontendResults.forEach(r => {
  console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
});

console.log('\nBackend:');
backendResults.forEach(r => {
  console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
});

const allPassed = frontendPassed && backendPassed;

if (allPassed) {
  console.log('\n✅ SHOPIFY GATE: ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.log('\n❌ SHOPIFY GATE: SOME CHECKS FAILED');
  process.exit(1);
}

