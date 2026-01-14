#!/usr/bin/env node

/**
 * Retail Gate Script
 * 
 * Runs all checks for Retail stack (backend) in deterministic order:
 * - Backend: lint -> prisma validate -> tests -> build
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

    // If the process exits successfully, treat as PASS.
    // Output heuristics are unreliable for tools like `node --test`.
    const passed = true;
    
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

// Backend checks (apps/retail-api)
console.log('\n\n' + '='.repeat(60));
console.log('RETAIL BACKEND GATE');
console.log('='.repeat(60));

const backendPassed = [
  runCommand('lint', 'npm -w @astronote/retail-api run lint', 'backend'),
  runCommand('prisma validate', 'npm -w @astronote/retail-api run prisma:check', 'backend'),
  runCommand('tests', 'npm -w @astronote/retail-api run test', 'backend'),
  runCommand('build', 'npm -w @astronote/retail-api run build', 'backend'),
].every(Boolean);

// Summary
console.log('\n\n' + '='.repeat(60));
console.log('RETAIL GATE SUMMARY');
console.log('='.repeat(60));

const backendResults = results.backend;

console.log('\nBackend:');
backendResults.forEach(r => {
  console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
});

const allPassed = backendPassed;

if (allPassed) {
  console.log('\n✅ RETAIL GATE: ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.log('\n❌ RETAIL GATE: SOME CHECKS FAILED');
  process.exit(1);
}

