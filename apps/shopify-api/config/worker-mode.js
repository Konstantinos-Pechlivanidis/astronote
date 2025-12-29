// Worker Mode Contract
// Strict validation and mode resolution for embedded/separate/off worker deployment

import { logger } from '../utils/logger.js';

/**
 * WORKER_MODE values:
 * - "embedded": Start workers in API process (unified deployment)
 * - "separate": API does NOT start workers; worker service starts them
 * - "off": No workers (testing/development)
 * 
 * Precedence:
 * 1. WORKER_MODE (if set, takes precedence)
 * 2. START_WORKER (backward compatibility)
 * 3. Default based on NODE_ENV
 */
export function resolveWorkerMode() {
  // Priority 1: WORKER_MODE (explicit)
  if (process.env.WORKER_MODE) {
    const mode = process.env.WORKER_MODE.toLowerCase().trim();
    if (!['embedded', 'separate', 'off'].includes(mode)) {
      throw new Error(
        `Invalid WORKER_MODE="${process.env.WORKER_MODE}". ` +
        `Must be one of: embedded, separate, off`
      );
    }
    return mode;
  }

  // Priority 2: START_WORKER (backward compatibility)
  if (process.env.START_WORKER !== undefined) {
    const startWorker = process.env.START_WORKER !== 'false' && 
                       process.env.START_WORKER !== '0';
    return startWorker ? 'embedded' : 'separate';
  }

  // Priority 3: Default based on NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'development';
  return nodeEnv === 'production' ? 'separate' : 'embedded';
}

/**
 * Validate worker mode requirements
 * @param {string} mode - Worker mode
 * @throws {Error} If requirements not met
 */
export async function validateWorkerMode(mode) {
  if (mode === 'embedded') {
    // Embedded mode requires Redis configuration (not necessarily connected yet)
    // Check if Redis is configured (has env vars or REDIS_URL, and not explicitly disabled)
    const isRedisDisabled = process.env.REDIS_URL === 'disabled';
    const hasRedisConfig = 
      !isRedisDisabled && (
        process.env.REDIS_HOST || 
        process.env.REDIS_PORT || 
        process.env.REDIS_URL ||
        (process.env.REDIS_USERNAME && process.env.REDIS_PASSWORD)
      );
    
    if (!hasRedisConfig) {
      throw new Error(
        'WORKER_MODE=embedded requires Redis configuration. ' +
        'Set REDIS_HOST, REDIS_PORT, etc., or set WORKER_MODE=separate/off'
      );
    }

    // Embedded mode requires database
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'WORKER_MODE=embedded requires DATABASE_URL. ' +
        'Workers need database access for job processing.'
      );
    }
  }
}

/**
 * Get resolved worker mode with validation
 */
export async function getWorkerMode() {
  const mode = resolveWorkerMode();
  await validateWorkerMode(mode);
  return mode;
}

/**
 * Check if workers should be started in this process
 */
export async function shouldStartWorkers() {
  const mode = await getWorkerMode();
  return mode === 'embedded';
}

