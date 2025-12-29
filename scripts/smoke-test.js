#!/usr/bin/env node
/**
 * Smoke test script for API health checks
 * Usage: npm run smoke:api
 * Requires: apps/shopify-api running on PORT (default 3001)
 */

import axios from 'axios';

/**
 * Environment:
 * - API_BASE_URL: API base URL (default: http://localhost:3001)
 */
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TIMEOUT = 5000;

async function smokeTest() {
  console.log(`🔍 Running smoke tests against ${API_BASE_URL}\n`);

  const results = [];

  // Test 1: Health check
  try {
    console.log('1. Testing GET /health/full...');
    const healthRes = await axios.get(`${API_BASE_URL}/health/full`, { timeout: TIMEOUT });
    if (healthRes.status === 200) {
      console.log('   ✅ Health check passed');
      results.push({ test: 'health', status: 'pass', data: healthRes.data });
    } else {
      console.log(`   ❌ Health check failed: ${healthRes.status}`);
      results.push({ test: 'health', status: 'fail', error: `Status ${healthRes.status}` });
    }
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
    results.push({ test: 'health', status: 'fail', error: error.message });
  }

  // Test 2: Health endpoint (simpler)
  try {
    console.log('2. Testing GET /health...');
    const simpleHealthRes = await axios.get(`${API_BASE_URL}/health`, { timeout: TIMEOUT });
    if (simpleHealthRes.status === 200) {
      console.log('   ✅ Simple health check passed');
      results.push({ test: 'health-simple', status: 'pass' });
    }
  } catch (error) {
    console.log(`   ⚠️  Simple health check failed: ${error.message}`);
    results.push({ test: 'health-simple', status: 'warn', error: error.message });
  }

  // Summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warnings = results.filter((r) => r.status === 'warn').length;

  console.log(`   ✅ Passed: ${passed}`);
  if (warnings > 0) console.log(`   ⚠️  Warnings: ${warnings}`);
  if (failed > 0) console.log(`   ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Smoke tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All smoke tests passed');
    process.exit(0);
  }
}

smokeTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

