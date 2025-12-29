// Shopify Worker Entry Point
// This service runs ONLY workers and pollers, NO HTTP server
// Standalone implementation similar to retail-worker

// Load environment first (before any other imports)
// Use simple dotenv loading (like retail-worker)
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from root .env (like retail-worker)
// From src/shopify.worker.js, go up 3 levels to monorepo root
const monorepoRoot = resolve(__dirname, '../../../');
dotenv.config({ path: resolve(monorepoRoot, 'apps/shopify-api/.env') });

// Simple console logger (like retail-worker uses pino)
const logger = {
  info: (msg, meta) => {
    if (meta && Object.keys(meta).length > 0) {
      console.log(`[INFO] ${msg}`, meta);
    } else {
      console.log(`[INFO] ${msg}`);
    }
  },
  warn: (msg, meta) => {
    if (meta && Object.keys(meta).length > 0) {
      console.warn(`[WARN] ${msg}`, meta);
    } else {
      console.warn(`[WARN] ${msg}`);
    }
  },
  error: (msg, meta) => {
    if (meta && Object.keys(meta).length > 0) {
      console.error(`[ERROR] ${msg}`, meta);
    } else {
      console.error(`[ERROR] ${msg}`);
    }
  },
  debug: (msg, meta) => {
    if (process.env.NODE_ENV === 'development') {
      if (meta && Object.keys(meta).length > 0) {
        console.debug(`[DEBUG] ${msg}`, meta);
      } else {
        console.debug(`[DEBUG] ${msg}`);
      }
    }
  },
};

// Check if queue is disabled
if (process.env.QUEUE_DISABLED === '1' || process.env.QUEUE_DISABLED === 'true') {
  logger.warn('Disabled via QUEUE_DISABLED=1');
  process.exit(0);
}

// Import Redis config and check connection
let queueRedis = null;
try {
  // Import Redis config directly (avoid complex loadEnv)
  const IORedis = (await import('ioredis')).default;
  
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisUsername = process.env.REDIS_USERNAME || 'default';
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisTls = process.env.REDIS_TLS === 'true';
  
  queueRedis = new IORedis({
    host: redisHost,
    port: redisPort,
    username: redisUsername,
    password: redisPassword,
    ...(redisTls
      ? {
        tls: {
          rejectUnauthorized: false,
          servername: redisHost,
        },
      }
      : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true, // CRITICAL: Don't connect immediately
    connectTimeout: 10000,
    retryStrategy: times => {
      if (times > 3) {
        logger.warn('Redis connection failed after 3 retries. Make sure Redis is running.');
        logger.warn('Start Redis: brew services start redis');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    },
  });
  
  // Add error handlers to prevent unhandled errors
  queueRedis.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      logger.warn('Redis connection refused. Make sure Redis is running: brew services start redis');
    } else {
      logger.error('Redis error', { error: err.message, code: err.code });
    }
  });
  
  queueRedis.on('close', () => {
    logger.warn('Redis connection closed');
  });
  
  if (!queueRedis) {
    logger.warn('Redis client could not be created, worker disabled');
    process.exit(0);
  }
  
  logger.info('Redis client initialized (will connect on first use)', {
    host: redisHost,
    port: redisPort,
  });
  logger.info('Note: Redis will connect when first job is processed. If Redis is not running, jobs will fail.');
} catch (error) {
  logger.error('Failed to load Redis configuration', { error: error.message });
  process.exit(1);
}

// Start BullMQ workers directly (don't import queue/worker.js - it has complex dependencies)
logger.info('Starting Shopify workers...');

// Note: With lazyConnect: true, Redis will connect on first command
// We don't test the connection here - BullMQ will handle it with retryStrategy
// If Redis is not running, workers will log errors but won't crash immediately

try {
  const { Worker } = await import('bullmq');
  
  // Import job handlers directly
  // Note: These imports may trigger Redis connections via queue/index.js
  // But with lazyConnect: true, they won't connect immediately
  // From src/shopify.worker.js, go up 1 level to apps/shopify-worker, then to shopify-api
  const { handleMittoSend } = await import('../../shopify-api/queue/jobs/mittoSend.js');
  const { handleBulkSMS } = await import('../../shopify-api/queue/jobs/bulkSms.js');
  const { handleCampaignStatusUpdate, handleAllCampaignsStatusUpdate } = await import('../../shopify-api/queue/jobs/deliveryStatusUpdate.js');
  const { handleCampaignSend } = await import('../../shopify-api/queue/jobs/campaignSend.js');
  const {
    handleAbandonedCartTrigger,
    handleOrderConfirmationTrigger,
    handleOrderFulfilledTrigger,
    handleCustomerReengagementTrigger,
    handleBirthdayTrigger,
    handleWelcomeTrigger,
    handleReviewRequestTrigger,
    handleCrossSellTrigger,
  } = await import('../../shopify-api/queue/jobs/automationTriggers.js');
  const { handleReconciliation } = await import('../../shopify-api/queue/jobs/reconciliation.js');
  
  // SMS Worker
  const smsWorker = new Worker(
    'sms-send',
    async job => {
      logger.info(`Processing SMS job ${job.id}`, { jobData: job.data, jobName: job.name });
      
      if (job.name === 'sendBulkSMS') {
        return await handleBulkSMS(job);
      } else if (job.name === 'sendSMS' || !job.name) {
        return await handleMittoSend(job);
      } else {
        logger.warn({ jobId: job.id, jobName: job.name }, 'Unknown SMS job type, skipping');
        return { ok: false, reason: 'Unknown job type' };
      }
    },
    {
      connection: queueRedis,
      concurrency: 200,
      removeOnComplete: 1000,
      removeOnFail: 500,
      limiter: {
        max: 500,
        duration: 1000,
      },
    },
  );
  
  // Campaign Worker
  const campaignWorker = new Worker(
    'campaign-send',
    async job => {
      return await handleCampaignSend(job);
    },
    {
      connection: queueRedis,
      concurrency: 5,
      removeOnComplete: 50,
      removeOnFail: 25,
    },
  );
  
  // Automation Worker
  const automationWorker = new Worker(
    'automation-trigger',
    async job => {
      logger.info(`Processing automation job ${job.id}`, { jobData: job.data, jobName: job.name });
      
      try {
        switch (job.name) {
        case 'order-confirmation':
          return await handleOrderConfirmationTrigger(job);
        case 'order-fulfilled':
          return await handleOrderFulfilledTrigger(job);
        case 'review-request':
          return await handleReviewRequestTrigger(job);
        case 'cross-sell':
          return await handleCrossSellTrigger(job);
        case 'abandoned-cart':
          return await handleAbandonedCartTrigger(job);
        case 'customer-reengagement':
          return await handleCustomerReengagementTrigger(job);
        case 'birthday':
          return await handleBirthdayTrigger(job);
        case 'welcome':
          return await handleWelcomeTrigger(job);
        default:
          logger.warn('Unknown automation job type', { jobId: job.id, jobName: job.name });
          return { success: false, reason: 'Unknown job type' };
        }
      } catch (error) {
        logger.error('Automation job processing failed', {
          jobId: job.id,
          jobName: job.name,
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    },
    {
      connection: queueRedis,
      concurrency: 10,
      removeOnComplete: 200,
      removeOnFail: 100,
    },
  );
  
  // Delivery Status Worker
  const deliveryStatusWorker = new Worker(
    'delivery-status-update',
    async job => {
      logger.info(`Processing delivery status update job ${job.id}`, { jobData: job.data, jobName: job.name });
      if (job.name === 'update-campaign-status') {
        return await handleCampaignStatusUpdate(job);
      } else if (job.name === 'update-all-campaigns-status') {
        return await handleAllCampaignsStatusUpdate(job);
      }
      return await handleCampaignStatusUpdate(job);
    },
    {
      connection: queueRedis,
      concurrency: 5,
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  );
  
  // All Campaigns Status Worker
  const allCampaignsStatusWorker = new Worker(
    'all-campaigns-status-update',
    async job => {
      logger.info(`Processing all campaigns status update job ${job.id}`, { jobData: job.data });
      return await handleAllCampaignsStatusUpdate(job);
    },
    {
      connection: queueRedis,
      concurrency: 1,
      removeOnComplete: 10,
      removeOnFail: 5,
    },
  );
  
  // Reconciliation Worker
  const reconciliationWorker = new Worker(
    'reconciliation',
    async job => {
      logger.info(`Processing reconciliation job ${job.id}`);
      return await handleReconciliation();
    },
    {
      connection: queueRedis,
      concurrency: 1,
      removeOnComplete: 50,
      removeOnFail: 25,
    },
  );
  
  // Event handlers
  smsWorker.on('completed', job => {
    logger.info(`SMS job completed: ${job.id}`);
  });
  
  smsWorker.on('failed', (job, err) => {
    logger.error(`SMS job failed: ${job?.id}`, { error: err.message, attempts: job.attemptsMade });
  });
  
  smsWorker.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      logger.warn('SMS Worker: Redis connection refused. Make sure Redis is running.');
    } else {
      logger.error('SMS Worker error', { error: err.message, code: err.code });
    }
  });
  
  campaignWorker.on('completed', job => {
    logger.info(`Campaign job completed: ${job.id}`);
  });
  
  campaignWorker.on('failed', (job, err) => {
    logger.error(`Campaign job failed: ${job?.id}`, { error: err.message, attempts: job.attemptsMade });
  });
  
  automationWorker.on('completed', job => {
    logger.info(`Automation job completed: ${job.id}`);
  });
  
  automationWorker.on('failed', (job, err) => {
    logger.error(`Automation job failed: ${job?.id}`, { error: err.message, attempts: job.attemptsMade });
  });
  
  logger.info('Workers started successfully');
  logger.info('Workers will connect to Redis when processing their first job.');
  logger.info('If Redis is not running, start it with: brew services start redis');
} catch (error) {
  logger.error('Failed to start workers', { error: error.message, stack: error.stack });
  if (error.code === 'ECONNREFUSED') {
    logger.error('Redis connection refused. Make sure Redis is running: brew services start redis');
  }
  process.exit(1);
}

// Start schedulers and pollers (these queue jobs, workers process them)
logger.info('Starting schedulers and pollers...');

try {
  const {
    startPeriodicStatusUpdates,
    startScheduledCampaignsProcessor,
    startBirthdayAutomationScheduler,
    startReconciliationScheduler,
  } = await import('../../shopify-api/services/scheduler.js');
  const { startEventPoller } = await import('../../shopify-api/workers/event-poller.js');
  
  startPeriodicStatusUpdates();
  startScheduledCampaignsProcessor();
  startEventPoller();
  startBirthdayAutomationScheduler();
  startReconciliationScheduler();
  
  logger.info('Schedulers and pollers started');
} catch (error) {
  logger.error('Failed to start schedulers/pollers', { error: error.message });
  // Don't exit - workers are more important than schedulers
}

logger.info('Shopify worker started successfully', {
  environment: process.env.NODE_ENV || 'development',
  nodeVersion: process.version,
  mode: 'Worker mode (no HTTP server)',
  workersEnabled: true,
});

logger.info('');
logger.info('═══════════════════════════════════════════════════════════');
logger.info('  Shopify Worker is running');
logger.info('  Workers will connect to Redis when processing jobs');
logger.info('  If you see ECONNREFUSED errors, start Redis:');
logger.info('    brew services start redis');
logger.info('═══════════════════════════════════════════════════════════');
logger.info('');

// Graceful shutdown handler (like retail-worker)
const gracefulShutdown = async signal => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    // Close Redis connections
    if (queueRedis) {
      await queueRedis.quit();
    }

    // Close Prisma connection
    const prisma = (await import('../../shopify-api/services/prisma.js')).default;
    await prisma.$disconnect();
    logger.info('Database connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

// Handle shutdown signals (like retail-worker)
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
  // Ignore ECONNREFUSED errors from Redis (they're expected if Redis is not running)
  if (reason && reason.code === 'ECONNREFUSED') {
    logger.warn('Unhandled Redis connection error (Redis may not be running)', {
      code: reason.code,
    });
    return;
  }
  logger.error('Unhandled rejection', { reason, promise });
  gracefulShutdown('unhandledRejection');
});
