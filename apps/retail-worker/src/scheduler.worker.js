// apps/worker/src/scheduler.worker.js
require('dotenv').config();

const pino = require('pino');
const logger = pino({ name: 'scheduler-worker' });

if (process.env.QUEUE_DISABLED === '1') {
  logger.warn('Disabled via QUEUE_DISABLED=1');
  process.exit(0);
}

// Dependencies are resolved from apps/retail-api/node_modules because worker runs with cwd=apps/retail-api
const { Worker } = require('bullmq');
const { getRedisClient } = require('../../retail-api/src/lib/redis');
const { enqueueCampaign } = require('../../retail-api/src/services/campaignEnqueue.service');

const connection = getRedisClient();

if (!connection) {
  logger.warn('Redis client could not be created, scheduler worker disabled');
  process.exit(0);
}

// With lazyConnect: true, Redis connects on first command
// BullMQ will handle the connection, so we don't need to wait for 'ready' here
logger.info('Starting scheduler worker (Redis will connect on first use)...');

const concurrency = Number(process.env.SCHEDULER_CONCURRENCY || 2);

const worker = new Worker(
  'schedulerQueue',
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name, jobData: job.data }, 'Processing scheduled job');
    
    if (job.name !== 'enqueueCampaign') {
      logger.warn({ jobId: job.id, jobName: job.name }, 'Unknown job name, skipping');
      return;
    }
    
    const { campaignId } = job.data || {};
    if (!campaignId) {
      logger.error({ jobId: job.id, jobData: job.data }, 'Missing campaignId in job data');
      throw new Error('Missing campaignId in job data');
    }

    try {
      // Phase 2 Task 2.2: Validate campaign status before enqueue (defensive check)
      const prisma = require('../../retail-api/src/lib/prisma');
      const campaign = await prisma.campaign.findUnique({
        where: { id: Number(campaignId) },
        select: { id: true, status: true, ownerId: true }
      });
      
      if (!campaign) {
        logger.warn({ campaignId: Number(campaignId), jobId: job.id }, 'Campaign not found, skipping');
        return; // Idempotent: safe to skip
      }
      
      // Phase 2 Task 2.2: Only enqueue if campaign is in valid state
      if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
        logger.info({ 
          campaignId: Number(campaignId), 
          jobId: job.id, 
          status: campaign.status 
        }, 'Campaign not in enqueueable state, skipping (idempotent)');
        return; // Idempotent: safe to skip
      }
      
      // Phase 1 Task 1.2: Check if messages already exist before calling enqueueCampaign (idempotency)
      const existingMessageCount = await prisma.campaignMessage.count({
        where: { campaignId: Number(campaignId) }
      });
      
      if (existingMessageCount > 0) {
        logger.info({ 
          campaignId: Number(campaignId), 
          jobId: job.id, 
          existingMessageCount 
        }, 'Campaign already has messages, skipping enqueue (idempotent)');
        return; // Idempotent: safe to skip
      }
      
      logger.info({ campaignId, jobId: job.id }, 'Calling enqueueCampaign');
      // Phase 4 Task 4.2: Pass job context to enqueueCampaign for audit logging
      const result = await enqueueCampaign(Number(campaignId), {
        triggeredBy: 'scheduler',
        jobId: job.id,
        requestId: null,
        userId: null,
        ipAddress: null,
        userAgent: null
      });
      
      if (!result.ok) {
        logger.error({ 
          campaignId, 
          jobId: job.id,
          reason: result.reason,
          result 
        }, 'enqueueCampaign failed');
        throw new Error(`enqueueCampaign failed: ${result.reason || 'unknown error'}`);
      } else {
        logger.info({ 
          campaignId, 
          jobId: job.id,
          enqueuedJobs: result.enqueuedJobs 
        }, 'Campaign enqueued successfully');
      }
    } catch (err) {
      logger.error({ 
        campaignId, 
        jobId: job.id,
        error: err.message,
        stack: err.stack 
      }, 'Error processing scheduled campaign job');
      throw err; // Re-throw to mark job as failed
    }
  },
  { connection, concurrency }
);

worker.on('active', (job) => logger.info({ jobId: job.id }, `Processing ${job.name}`));
worker.on('completed', (job) => logger.info({ jobId: job.id }, `Completed ${job.name}`));
worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err?.message }, `Failed ${job?.name}`));
