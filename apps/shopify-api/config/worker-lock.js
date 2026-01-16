// Distributed Lock for Worker Execution
// Prevents double worker execution when WORKER_MODE=embedded

import { queueRedis } from './redis.js';
import { randomBytes } from 'crypto';

const LOCK_KEY_PREFIX = 'locks:workers';
const LOCK_TTL_MS = 60000; // 60 seconds
const LOCK_REFRESH_INTERVAL_MS = 30000; // Refresh every 30 seconds

let lockToken = null;
let lockRefreshInterval = null;
let lockAcquired = false;

/**
 * Generate unique lock token for this process
 */
function generateLockToken() {
  return randomBytes(16).toString('hex');
}

/**
 * Acquire distributed lock for worker execution
 * @param {string} serviceName - Service name (e.g., 'shopify-api')
 * @returns {Promise<boolean>} True if lock acquired, false if already held
 */
export async function acquireWorkerLock(serviceName) {
  if (!queueRedis) {
    throw new Error('Redis not available - cannot acquire worker lock');
  }

  const lockKey = `${LOCK_KEY_PREFIX}:${serviceName}:${process.env.NODE_ENV || 'development'}`;
  lockToken = generateLockToken();

  try {
    // Try to acquire lock with SET NX EX (set if not exists, with expiration)
    const result = await queueRedis.set(
      lockKey,
      lockToken,
      'PX', // milliseconds
      LOCK_TTL_MS,
      'NX',  // only set if not exists
    );

    if (result === 'OK') {
      lockAcquired = true;

      // Start refresh interval to keep lock alive
      lockRefreshInterval = setInterval(async () => {
        try {
          // Refresh lock only if we still own it (check token)
          const currentToken = await queueRedis.get(lockKey);
          if (currentToken === lockToken) {
            await queueRedis.pexpire(lockKey, LOCK_TTL_MS);
          } else {
            // Lock was stolen, stop refreshing
            clearInterval(lockRefreshInterval);
            lockAcquired = false;
          }
        } catch (err) {
          console.error('[Worker Lock] Failed to refresh lock:', err.message);
        }
      }, LOCK_REFRESH_INTERVAL_MS);

      return true;
    } else {
      // Lock already held by another process
      const currentToken = await queueRedis.get(lockKey);
      console.error(
        '[Worker Lock] Lock already held by another process. ' +
        `Lock key: ${lockKey}, Current token: ${currentToken}`,
      );
      return false;
    }
  } catch (error) {
    console.error('[Worker Lock] Failed to acquire lock:', error.message);
    throw error;
  }
}

/**
 * Release distributed lock
 * @param {string} serviceName - Service name
 */
export async function releaseWorkerLock(serviceName) {
  if (!lockAcquired || !queueRedis) {
    return;
  }

  const lockKey = `${LOCK_KEY_PREFIX}:${serviceName}:${process.env.NODE_ENV || 'development'}`;

  try {
    // Stop refresh interval
    if (lockRefreshInterval) {
      clearInterval(lockRefreshInterval);
      lockRefreshInterval = null;
    }

    // Release lock only if we own it (check token)
    const currentToken = await queueRedis.get(lockKey);
    if (currentToken === lockToken) {
      await queueRedis.del(lockKey);
      lockAcquired = false;
      console.log(`[Worker Lock] Released lock: ${lockKey}`);
    } else {
      console.warn('[Worker Lock] Lock token mismatch - lock may have been stolen');
    }
  } catch (error) {
    console.error('[Worker Lock] Failed to release lock:', error.message);
  }
}

/**
 * Check if lock is currently held
 */
export function isLockAcquired() {
  return lockAcquired;
}

/**
 * Get worker lock status for observability/debugging.
 * Safe: does not return lock token, only presence + TTL.
 * @param {string} serviceName
 */
export async function getWorkerLockStatus(serviceName) {
  const lockKey = `${LOCK_KEY_PREFIX}:${serviceName}:${process.env.NODE_ENV || 'development'}`;
  if (!queueRedis) {
    return { lockKey, ok: false, error: 'Redis not available' };
  }
  try {
    const [pttl, currentToken] = await Promise.all([
      queueRedis.pttl(lockKey),
      queueRedis.get(lockKey),
    ]);
    return {
      lockKey,
      ok: true,
      exists: Boolean(currentToken),
      ttlMs: typeof pttl === 'number' ? pttl : null,
      ownedByThisProcess: lockAcquired && Boolean(currentToken) && currentToken === lockToken,
    };
  } catch (e) {
    return { lockKey, ok: false, error: e?.message || String(e) };
  }
}
