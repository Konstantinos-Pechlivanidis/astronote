// apps/retail-api/apps/api/src/config/loadEnv.js
// Load environment variables for monorepo setup
// Priority order:
// 1. Root monorepo .env (shared vars)
// 2. apps/retail-api/.env (retail-api specific)
// 3. apps/retail-api/.env.local (local overrides, gitignored)

const dotenv = require('dotenv');
const path = require('path');

/**
 * Load environment variables for monorepo setup
 * Priority order:
 * 1. Root monorepo .env (shared vars) - 3 levels up from apps/api/src/config
 * 2. apps/retail-api/.env (retail-api specific) - 2 levels up
 * 3. apps/retail-api/.env.local (local overrides, gitignored) - 2 levels up
 */
function loadEnv() {
  // Determine paths
  // From apps/retail-api/apps/api/src/config/loadEnv.js
  // To root: ../../../../ (4 levels up)
  // To apps/retail-api: ../../.. (3 levels up)
  const monorepoRoot = path.resolve(__dirname, '../../../../');
  const retailApiRoot = path.resolve(__dirname, '../../..');

  // Load in priority order (later overrides earlier)
  // 1. Root .env (shared)
  dotenv.config({ path: path.resolve(monorepoRoot, '.env') });

  // 2. Retail API .env (app-specific)
  dotenv.config({ path: path.resolve(retailApiRoot, '.env') });

  // 3. Retail API .env.local (local overrides, gitignored)
  dotenv.config({
    path: path.resolve(retailApiRoot, '.env.local'),
    override: true,
  });

  // Log what was loaded (for debugging)
  if (process.env.NODE_ENV === 'development') {
    console.log('Environment loaded:', {
      nodeEnv: process.env.NODE_ENV,
      hasDatabase: !!process.env.DATABASE_URL,
      hasRedis: !!process.env.REDIS_HOST || !!process.env.REDIS_URL,
      retailApiRoot,
      monorepoRoot,
    });
  }
}

module.exports = loadEnv;

