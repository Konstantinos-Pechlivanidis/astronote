import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load environment variables for monorepo setup
 * Priority order:
 * 1. Root .env (shared vars)
 * 2. App .env (app-specific vars)
 * 3. App .env.local (local overrides, gitignored)
 */
function loadEnv() {
  // Determine paths
  const monorepoRoot = resolve(__dirname, '../../../');
  const appRoot = resolve(__dirname, '../');

  // Load in priority order (later overrides earlier)
  // 1. Root .env (shared)
  dotenv.config({ path: resolve(monorepoRoot, '.env') });

  // 2. App .env (app-specific)
  dotenv.config({ path: resolve(appRoot, '.env') });

  // 3. App .env.local (local overrides, gitignored)
  dotenv.config({
    path: resolve(appRoot, '.env.local'),
    override: true,
  });

  // Log what was loaded (for debugging)
  if (process.env.NODE_ENV === 'development') {
    console.log('Environment loaded:', {
      nodeEnv: process.env.NODE_ENV,
      hasDatabase: !!process.env.DATABASE_URL,
      hasRedis: !!process.env.REDIS_HOST || !!process.env.REDIS_URL,
      appRoot,
      monorepoRoot,
    });
  }
}

export default loadEnv;

