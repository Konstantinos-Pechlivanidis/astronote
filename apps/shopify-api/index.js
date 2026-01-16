// Load environment first (before any other imports)
import loadEnv from './config/loadEnv.js';
loadEnv();

import app from './app.js';
import { logger } from './utils/logger.js';
import { validateAndLogEnvironment } from './config/env-validation.js';
import { closeRedisConnections } from './config/redis.js';
import { getWorkerMode } from './config/worker-mode.js';
import { startWorkers, stopWorkers } from './queue/start-workers.js';
import prisma from './services/prisma.js';

// Validate environment variables on startup
try {
  await validateAndLogEnvironment();
} catch (error) {
  logger.error('Environment validation failed', {
    error: error.message,
  });
  process.exit(1);
}

// Validate worker mode early (fail fast)
let workerMode;
try {
  workerMode = await getWorkerMode();
  logger.info('Worker mode resolved', { mode: workerMode });
} catch (error) {
  logger.error('Worker mode validation failed', {
    error: error.message,
  });
  process.exit(1);
}

// Boot diagnostics (safe, no secrets) — helps verify Render setup quickly.
logger.info('Boot config', {
  workerMode,
  runScheduler: process.env.RUN_SCHEDULER || 'true (default)',
  eventPollingEnabled: process.env.EVENT_POLLING_ENABLED || 'true (default)',
  nodeEnv: process.env.NODE_ENV || 'development',
  hasRedisHost: !!process.env.REDIS_HOST,
  hasRedisPassword: !!process.env.REDIS_PASSWORD,
  redisTls: process.env.REDIS_TLS === 'true',
});

// Import schedulers (they queue jobs, workers process them)
import {
  startPeriodicStatusUpdates,
  startScheduledCampaignsProcessor,
  startBirthdayAutomationScheduler,
  startReconciliationScheduler,
} from './services/scheduler.js';
import { startEventPoller } from './workers/event-poller.js';

const PORT = process.env.PORT || 8080;

// ========= BOOT SEQUENCE =========
// A) Load env (done)
// B) Validate env (done)
// C) Connect Prisma + ping (lazy, on first query)
// D) Connect Redis + ping (lazy, on first command)
// E) Start HTTP server
// F) Start workers (if WORKER_MODE=embedded)

const server = app.listen(PORT, async () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    workerMode,
    mode: workerMode === 'embedded' ? 'API + Workers (embedded)' : workerMode === 'separate' ? 'API only (workers separate)' : 'API only (workers off)',
  });

  // F) Start workers (if WORKER_MODE=embedded)
  if (workerMode === 'embedded') {
    try {
      const result = await startWorkers();
      if (result?.started) {
        logger.info('Workers started successfully (embedded mode)', result);
      } else {
        logger.warn(
          { ...result },
          'Workers not started on this instance (embedded mode) — API will continue; check worker lock / deployment topology',
        );
      }
    } catch (error) {
      logger.error('Failed to start workers', {
        error: error.message,
        stack: error.stack,
      });
      // In production, log error but continue - API can run without workers
      // Workers may be running in another instance or will start on next deploy
      logger.warn('Workers failed to start - API will continue without workers. Check logs for details.');
      // Don't exit - allow API to serve requests even if workers don't start
    }
  } else {
    logger.info(`Workers not started (WORKER_MODE=${workerMode})`);
  }

  // Start schedulers/pollers (they queue jobs, workers process them)
  // Only start if workers are enabled (embedded) or separate (workers will process)
  if (workerMode === 'embedded' || workerMode === 'separate') {
    // Start periodic delivery status updates
    startPeriodicStatusUpdates();

    // Start scheduled campaigns processor
    startScheduledCampaignsProcessor();

    // Start event poller for automation triggers
    startEventPoller();

    // Start birthday automation scheduler (runs daily at midnight UTC)
    startBirthdayAutomationScheduler();

    // Start reconciliation scheduler (runs every 10 minutes)
    startReconciliationScheduler();

    logger.info('Schedulers and pollers started');
  } else {
    logger.info('Schedulers and pollers disabled (WORKER_MODE=off)');
  }
});

// Graceful shutdown handler
const gracefulShutdown = async signal => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop workers first (if embedded mode)
  if (workerMode === 'embedded') {
    try {
      await stopWorkers();
      logger.info('Workers stopped');
    } catch (error) {
      logger.error('Error stopping workers', { error: error.message });
    }
  }

  // Stop accepting new requests
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close Redis connections
      await closeRedisConnections();

      // Close Prisma connection
      await prisma.$disconnect();
      logger.info('Database connection closed');

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  gracefulShutdown('unhandledRejection');
});
