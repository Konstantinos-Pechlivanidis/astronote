// Worker Bootstrap Module (Shopify API)
// Idempotent worker startup for embedded mode

import { shouldStartWorkers, getWorkerMode } from '../config/worker-mode.js';
import { acquireWorkerLock, releaseWorkerLock } from '../config/worker-lock.js';
import { queueRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

let workersStarted = false;
let startWorkersPromise = null;
let workerInstances = [];

/**
 * Start embedded workers (idempotent)
 * @returns {Promise<void>}
 */
export async function startWorkers() {
  // Idempotency: return existing promise if already starting
  if (startWorkersPromise) {
    return startWorkersPromise;
  }

  // Idempotency: return immediately if already started
  if (workersStarted) {
    return;
  }

  startWorkersPromise = (async () => {
    try {
      // Check if workers should be started
      if (!(await shouldStartWorkers())) {
        logger.info('Workers not started (WORKER_MODE != embedded)');
        return;
      }

      const mode = await getWorkerMode();
      logger.info(`Starting workers in ${mode} mode...`);

      // Validate prerequisites
      if (!queueRedis) {
        throw new Error('Redis not available - workers require Redis');
      }

      // Acquire distributed lock to prevent double execution
      const lockAcquired = await acquireWorkerLock('shopify-api');
      if (!lockAcquired) {
        // In production, log warning but don't crash - allow API to start without workers
        // This handles cases where lock is stale or another instance is starting
        logger.warn(
          'Worker lock already held by another process. ' +
          'Workers will not start in this instance. ' +
          'If this is unexpected, check for duplicate services or stale locks in Redis.'
        );
        // Don't throw - allow API to start without workers
        return;
      }

      // Import worker module (this creates Worker instances)
      const workerModule = await import('./worker.js');
      
      // Extract worker instances from module
      // The worker.js exports workers, we need to track them
      const {
        smsWorker,
        campaignWorker,
        automationWorker,
        deliveryStatusWorker,
        allCampaignsStatusWorker,
        reconciliationWorker,
      } = workerModule;

      // Track worker instances for graceful shutdown
      // Filter out MockWorker instances (created when skipWorkers=true)
      const isRealWorker = (worker) => worker && typeof worker.close === 'function' && !worker.isMock;
      
      if (isRealWorker(smsWorker)) workerInstances.push(smsWorker);
      if (isRealWorker(campaignWorker)) workerInstances.push(campaignWorker);
      if (isRealWorker(automationWorker)) workerInstances.push(automationWorker);
      if (isRealWorker(deliveryStatusWorker)) workerInstances.push(deliveryStatusWorker);
      if (isRealWorker(allCampaignsStatusWorker)) workerInstances.push(allCampaignsStatusWorker);
      if (isRealWorker(reconciliationWorker)) workerInstances.push(reconciliationWorker);

      logger.info('Workers started successfully (embedded mode)', {
        mode,
        queues: ['sms-send', 'campaign-send', 'automation-trigger', 'delivery-status-update', 'all-campaigns-status-update', 'reconciliation'],
        workerCount: workerInstances.length,
      });
      
      workersStarted = true;
    } catch (error) {
      logger.error('Failed to start workers', {
        error: error.message,
        stack: error.stack,
      });
      // Release lock on error
      await releaseWorkerLock('shopify-api').catch(() => {});
      throw error;
    }
  })();

  return startWorkersPromise;
}

/**
 * Stop workers gracefully
 */
export async function stopWorkers() {
  if (!workersStarted) {
    return;
  }

  logger.info('Stopping workers...');

  // Close all worker instances
  for (const worker of workerInstances) {
    try {
      if (worker && typeof worker.close === 'function') {
        await worker.close();
      }
    } catch (error) {
      logger.error('Error closing worker', { error: error.message });
    }
  }

  workerInstances = [];
  workersStarted = false;
  startWorkersPromise = null;

  // Release lock
  await releaseWorkerLock('shopify-api');

  logger.info('Workers stopped');
}

/**
 * Check if workers are started
 */
export function areWorkersStarted() {
  return workersStarted;
}

