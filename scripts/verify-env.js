#!/usr/bin/env node
/**
 * Environment Variable Verification Script
 * Checks that required environment variables are set per service
 * Does NOT print secret values
 */

const fs = require('fs');
const path = require('path');

// Standard keys per service (from docs/env/standard-keys.md)
const REQUIRED_KEYS = {
  'retail-api': [
    'DATABASE_URL',
    'JWT_SECRET',
    'MITTO_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ],
  'retail-worker': [
    'DATABASE_URL',
    'JWT_SECRET',
    'MITTO_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ],
  'shopify-api': [
    'DATABASE_URL',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'STRIPE_SECRET_KEY',
  ],
  'web': [
    'VITE_SHOPIFY_API_BASE_URL',
    'VITE_RETAIL_API_BASE_URL',
  ],
};

const OPTIONAL_KEYS = {
  'retail-api': [
    'DIRECT_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'FRONTEND_URL',
    'CORS_ALLOWLIST',
  ],
  'retail-worker': [
    'DIRECT_URL',
    'REDIS_HOST',
    'REDIS_PORT',
  ],
  'shopify-api': [
    'DIRECT_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'FRONTEND_URL',
    'CORS_ALLOWLIST',
    'HOST',
  ],
  'web': [
    'VITE_APP_URL',
  ],
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  content.split('\n').forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        env[key] = value;
      }
    }
  });

  return env;
}

function checkService(serviceName, env) {
  const required = REQUIRED_KEYS[serviceName] || [];
  const optional = OPTIONAL_KEYS[serviceName] || [];

  const missing = [];
  const present = [];
  const optionalPresent = [];

  // Check required keys
  for (const key of required) {
    if (env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  // Check optional keys
  for (const key of optional) {
    if (env[key]) {
      optionalPresent.push(key);
    }
  }

  return { missing, present, optionalPresent };
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const services = ['retail-api', 'retail-worker', 'shopify-api', 'web'];

  console.log('🔍 Environment Variable Verification\n');
  console.log('='.repeat(60));

  let allPass = true;

  for (const service of services) {
    const servicePath = path.join(repoRoot, 'apps', service);
    const envPath = path.join(servicePath, '.env');
    const envLocalPath = path.join(servicePath, '.env.local');
    const rootEnvPath = path.join(repoRoot, '.env');

    // Load env files (priority: .env.local > .env > root .env)
    const rootEnv = loadEnvFile(rootEnvPath);
    const serviceEnv = loadEnvFile(envPath);
    const serviceEnvLocal = loadEnvFile(envLocalPath);

    // Merge (local overrides service, service overrides root)
    const env = { ...rootEnv, ...serviceEnv, ...serviceEnvLocal };

    const result = checkService(service, env);

    console.log(`\n📦 ${service.toUpperCase()}`);
    console.log('-'.repeat(60));

    if (result.missing.length === 0) {
      console.log('✅ Required keys: ALL PRESENT');
      result.present.forEach((key) => {
        console.log(`   ✓ ${key}`);
      });
    } else {
      allPass = false;
      console.log('❌ Required keys: MISSING');
      result.present.forEach((key) => {
        console.log(`   ✓ ${key}`);
      });
      result.missing.forEach((key) => {
        console.log(`   ✗ ${key} (MISSING)`);
      });
    }

    if (result.optionalPresent.length > 0) {
      console.log('\n📋 Optional keys present:');
      result.optionalPresent.forEach((key) => {
        console.log(`   • ${key}`);
      });
    }

    // Check for env file existence
    const hasEnv = fs.existsSync(envPath);
    const hasEnvLocal = fs.existsSync(envLocalPath);
    const hasRootEnv = fs.existsSync(rootEnvPath);

    console.log('\n📁 Env files:');
    if (hasRootEnv) console.log('   • Root .env exists');
    if (hasEnv) console.log(`   • ${service}/.env exists`);
    if (hasEnvLocal) console.log(`   • ${service}/.env.local exists`);
    if (!hasEnv && !hasEnvLocal && !hasRootEnv) {
      console.log('   ⚠️  No .env files found');
    }
  }

  console.log('\n' + '='.repeat(60));
  if (allPass) {
    console.log('\n✅ All required environment variables are present!');
    process.exit(0);
  } else {
    console.log('\n❌ Some required environment variables are missing.');
    console.log('   See docs/env/standard-keys.md for full key reference.');
    console.log('   See apps/{service}/.env.example for example values.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkService, loadEnvFile };

