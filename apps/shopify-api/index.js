// Load environment first (before any other imports)
import loadEnv from './config/loadEnv.js';
loadEnv();

import app from './app.js';
import { logger } from './utils/logger.js';
import { validateAndLogEnvironment } from './config/env-validation.js';
import { closeRedisConnections } from './config/redis.js';

// START_WORKER toggle: defaults to true (backward compatible for dev)
// Set START_WORKER=false or START_WORKER=0 in production to disable workers
const startWorker =
  process.env.START_WORKER !== 'false' && process.env.START_WORKER !== '0';

// Conditionally start workers (only if START_WORKER is enabled)
// Using top-level await (ESM module with "type": "module")
if (startWorker) {
  // Dynamic import to avoid loading worker code if disabled
  await import('./queue/worker.js'); // starts BullMQ worker
  logger.info('Workers enabled (START_WORKER=true)');
} else {
  logger.info('Workers disabled (START_WORKER=false) - API mode only');
}

import {
  startPeriodicStatusUpdates,
  startScheduledCampaignsProcessor,
  startBirthdayAutomationScheduler,
  startReconciliationScheduler,
} from './services/scheduler.js';
import { startEventPoller } from './workers/event-poller.js';

// Validate environment variables on startup
try {
  validateAndLogEnvironment();
} catch (error) {
  logger.error('Environment validation failed', {
    error: error.message,
  });
  process.exit(1);
}

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    workersEnabled: startWorker,
    mode: startWorker ? 'API + Workers' : 'API only (workers disabled)',
  });

  // Only start schedulers/pollers if workers are enabled
  // (These are lightweight schedulers that queue jobs, not the workers themselves)
  if (startWorker) {
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
  } else {
    logger.info('Schedulers and pollers disabled (START_WORKER=false)');
  }
});

// Graceful shutdown handler
const gracefulShutdown = async signal => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new requests
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close Redis connections
      await closeRedisConnections();

      // Close Prisma connection
      const prisma = (await import('./services/prisma.js')).default;
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
