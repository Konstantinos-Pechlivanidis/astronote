// apps/worker/src/watchdog.worker.js
// Watchdog for stuck messages (prevent "sending forever")

require('dotenv').config();

const pino = require('pino');
const logger = pino({ name: 'watchdog-worker' });

if (process.env.QUEUE_DISABLED === '1') {
  logger.warn('Disabled via QUEUE_DISABLED=1');
  process.exit(0);
}

const { Worker } = require('bullmq');
const { getRedisClient } = require('../../retail-api/src/lib/redis');
const prisma = require('../../retail-api/src/lib/prisma');

const connection = getRedisClient();

if (!connection) {
  logger.warn('Redis client could not be created, watchdog disabled');
  process.exit(0);
}

logger.info('Starting watchdog worker (Redis will connect on first use)...');

const concurrency = Number(process.env.WATCHDOG_CONCURRENCY || 1);

// Stuck message thresholds
const STUCK_SENDING_MINUTES = Number(process.env.STUCK_SENDING_MINUTES || 10);
const STUCK_LOCKED_MINUTES = Number(process.env.STUCK_LOCKED_MINUTES || 5);

const worker = new Worker(
  'watchdogQueue',
  async (job) => {
    if (job.name !== 'checkStuckMessages') {
      logger.warn({ jobId: job.id, jobName: job.name }, 'Unknown job name, skipping');
      return;
    }

    const { limit = 100 } = job.data || {};
    
    logger.info({ 
      jobId: job.id, 
      limit 
    }, 'Checking for stuck messages');

    try {
      const now = new Date();
      const stuckSendingThreshold = new Date(now.getTime() - STUCK_SENDING_MINUTES * 60 * 1000);
      const stuckLockedThreshold = new Date(now.getTime() - STUCK_LOCKED_MINUTES * 60 * 1000);

      // Find messages stuck in 'sending' status
      const stuckSending = await prisma.campaignMessage.findMany({
        where: {
          status: 'sending',
          OR: [
            { lockedAt: { lte: stuckLockedThreshold } },
            { lockedAt: null } // Messages in 'sending' without lock (shouldn't happen, but handle it)
          ]
        },
        take: limit,
        orderBy: { lockedAt: 'asc' },
        select: {
          id: true,
          campaignId: true,
          ownerId: true,
          providerMessageId: true,
          lockedAt: true,
          lockedBy: true,
          submittedAt: true
        }
      });

      // Find messages stuck in 'sending' with providerMessageId (should be 'submitted')
      const stuckWithProviderId = await prisma.campaignMessage.findMany({
        where: {
          status: 'sending',
          providerMessageId: { not: null },
          lockedAt: { lte: stuckLockedThreshold }
        },
        take: limit,
        orderBy: { lockedAt: 'asc' },
        select: {
          id: true,
          campaignId: true,
          ownerId: true,
          providerMessageId: true,
          lockedAt: true,
          lockedBy: true,
          submittedAt: true
        }
      });

      let fixed = 0;
      const affectedCampaigns = new Set();

      // Fix messages stuck in 'sending' with providerMessageId
      // These should be 'submitted' (were sent to Mitto but status wasn't updated)
      for (const msg of stuckWithProviderId) {
        try {
          await prisma.campaignMessage.updateMany({
            where: {
              id: msg.id,
              campaignId: msg.campaignId,
              ownerId: msg.ownerId,
              status: 'sending',
              providerMessageId: { not: null }
            },
            data: {
              status: 'submitted',
              submittedAt: msg.submittedAt || msg.lockedAt || new Date(),
              lockedAt: null,
              lockedBy: null,
              updatedAt: new Date()
            }
          });
          fixed++;
          affectedCampaigns.add(`${msg.campaignId}:${msg.ownerId}`);
          
          logger.warn({ 
            messageId: msg.id, 
            providerMessageId: msg.providerMessageId,
            lockedBy: msg.lockedBy,
            stuckForMinutes: Math.round((now.getTime() - (msg.lockedAt?.getTime() || now.getTime())) / 60000)
          }, 'Fixed stuck message: sending -> submitted (had providerMessageId)');
        } catch (err) {
          logger.error({ messageId: msg.id, err: err.message }, 'Failed to fix stuck message with providerMessageId');
        }
      }

      // Fix messages stuck in 'sending' without providerMessageId
      // These are likely stuck due to worker crash/timeout before Mitto send
      for (const msg of stuckSending.filter(m => !m.providerMessageId)) {
        try {
          await prisma.campaignMessage.updateMany({
            where: {
              id: msg.id,
              campaignId: msg.campaignId,
              ownerId: msg.ownerId,
              status: 'sending',
              providerMessageId: null
            },
            data: {
              status: 'unknown', // Mark as unknown (do NOT auto-resend)
              error: `Stuck in sending for >${STUCK_SENDING_MINUTES} minutes. Locked by: ${msg.lockedBy || 'unknown'}`,
              lockedAt: null,
              lockedBy: null,
              updatedAt: new Date()
            }
          });
          fixed++;
          affectedCampaigns.add(`${msg.campaignId}:${msg.ownerId}`);
          
          logger.error({ 
            messageId: msg.id, 
            lockedBy: msg.lockedBy,
            stuckForMinutes: Math.round((now.getTime() - (msg.lockedAt?.getTime() || now.getTime())) / 60000)
          }, 'Fixed stuck message: sending -> unknown (no providerMessageId, do NOT auto-resend)');
        } catch (err) {
          logger.error({ messageId: msg.id, err: err.message }, 'Failed to fix stuck message without providerMessageId');
        }
      }

      // Update campaign aggregates for affected campaigns
      if (affectedCampaigns.size > 0) {
        const { updateCampaignAggregates } = require('../../retail-api/src/services/campaignAggregates.service');
        const updatePromises = Array.from(affectedCampaigns).map(key => {
          const [campaignId, ownerId] = key.split(':').map(Number);
          return updateCampaignAggregates(campaignId, ownerId).catch(err => {
            logger.warn({ campaignId, ownerId, err: err.message }, 'Failed to update campaign aggregates from watchdog');
          });
        });
        await Promise.all(updatePromises);
      }

      logger.info({ 
        jobId: job.id, 
        stuckSendingCount: stuckSending.length,
        stuckWithProviderIdCount: stuckWithProviderId.length,
        fixed 
      }, 'Watchdog check completed');

    } catch (err) {
      logger.error({ 
        jobId: job.id, 
        err: err.message 
      }, 'Watchdog job failed');
      throw err;
    }
  },
  { connection, concurrency }
);

worker.on('ready', () => {
  logger.info('Ready and listening for watchdog jobs');
});

worker.on('active', (job) => {
  logger.info({ jobId: job.id }, `Processing ${job.name}`);
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, `Completed ${job.name}`);
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err?.message }, `Failed ${job?.name}`);
});

worker.on('error', (err) => {
  logger.error({ err: err.message }, 'Worker error');
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

