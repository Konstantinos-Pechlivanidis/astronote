// apps/worker/src/scheduler.worker.js
const loadEnv = require('../../api/src/config/loadEnv');
loadEnv();

const pino = require('pino');
const logger = pino({ name: 'scheduler-worker' });

if (process.env.QUEUE_DISABLED === '1') {
  logger.warn('Disabled via QUEUE_DISABLED=1');
  process.exit(0);
}

// Dependencies are resolved from apps/api/node_modules because worker runs with cwd=apps/api
const { Worker } = require('bullmq');
const { getRedisClient } = require('../../api/src/lib/redis');
const { enqueueCampaign } = require('../../api/src/services/campaignEnqueue.service');
const prisma = require('../../api/src/lib/prisma');
const { updateCampaignAggregates } = require('../../api/src/services/campaignAggregates.service');

function formatRedisInfo(connection) {
  if (!connection) return {};
  const opts = connection.options || connection.opts || connection.connector?.options || {};
  const host =
    opts.host ||
    opts.hostname ||
    (Array.isArray(opts.servers) ? opts.servers[0]?.host : undefined) ||
    opts.path ||
    'unknown';
  const port = opts.port || (Array.isArray(opts.servers) ? opts.servers[0]?.port : undefined);
  const db = typeof opts.db === 'number' ? opts.db : undefined;
  const tls = Boolean(opts.tls);
  return { host, port, db, tls };
}

const connection = getRedisClient();

if (!connection) {
  logger.warn('Redis client could not be created, scheduler worker disabled');
  process.exit(0);
}

// With lazyConnect: true, Redis connects on first command
// BullMQ will handle the connection, so we don't need to wait for 'ready' here
logger.info({ queue: 'schedulerQueue', redis: formatRedisInfo(connection) }, 'Starting scheduler worker (Redis will connect on first use)...');

const concurrency = Number(process.env.SCHEDULER_CONCURRENCY || 2);
const SWEEP_LIMIT = Number(process.env.SCHEDULE_SWEEP_LIMIT || 25);
const CLAIM_STALE_MINUTES = Number(process.env.SEND_CLAIM_STALE_MINUTES || 15);
const STALE_RECOVERY_LIMIT = Number(process.env.STALE_RECOVERY_LIMIT || 200);

const worker = new Worker(
  'schedulerQueue',
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name, jobData: job.data }, 'Processing scheduled job');

    if (job.name === 'sweepDueCampaigns') {
      return sweepDueCampaigns();
    }
    
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
      logger.info({ campaignId, jobId: job.id }, 'Calling enqueueCampaign');
      const result = await enqueueCampaign(Number(campaignId));
      
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

async function sweepDueCampaigns() {
  const now = new Date();
  const dueCampaigns = await prisma.campaign.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: now } },
    select: { id: true, ownerId: true, scheduledAt: true },
    orderBy: { scheduledAt: 'asc' },
    take: SWEEP_LIMIT
  });

  let enqueued = 0;
  if (!dueCampaigns.length) {
    logger.debug({ checkedAt: now.toISOString() }, 'No scheduled campaigns ready to enqueue');
  } else {
    for (const camp of dueCampaigns) {
      try {
        const result = await enqueueCampaign(Number(camp.id));
        if (result?.ok) {
          enqueued++;
          logger.info({ campaignId: camp.id, ownerId: camp.ownerId, enqueuedJobs: result.enqueuedJobs }, 'Scheduled campaign enqueued via sweep');
        } else {
          logger.warn({ campaignId: camp.id, ownerId: camp.ownerId, reason: result?.reason }, 'Scheduled sweep enqueue blocked');
        }
      } catch (err) {
        logger.error({ campaignId: camp.id, ownerId: camp.ownerId, err: err.message }, 'Error enqueuing scheduled campaign during sweep');
      }
    }
  }

  // Also recover stale processing claims so campaigns don't get stuck
  const recovered = await recoverStaleProcessingClaims();

  return { scanned: dueCampaigns.length, enqueued, recovered };
}

async function recoverStaleProcessingClaims() {
  const threshold = new Date(Date.now() - CLAIM_STALE_MINUTES * 60 * 1000);
  const staleMessages = await prisma.campaignMessage.findMany({
    where: {
      status: 'processing',
      providerMessageId: null,
      sendClaimedAt: { lt: threshold }
    },
    select: { id: true, campaignId: true, ownerId: true },
    take: STALE_RECOVERY_LIMIT
  });

  if (!staleMessages.length) {
    logger.debug({ threshold: threshold.toISOString() }, 'No stale processing messages found');
    return { reset: 0, campaignsUpdated: 0 };
  }

  const staleIds = staleMessages.map((m) => m.id);
  await prisma.campaignMessage.updateMany({
    where: { id: { in: staleIds } },
    data: {
      status: 'queued',
      sendClaimedAt: null,
      sendClaimToken: null,
      error: 'stale_claim_recovered'
    }
  });

  const affected = new Map();
  staleMessages.forEach((m) => {
    affected.set(`${m.campaignId}:${m.ownerId}`, { campaignId: m.campaignId, ownerId: m.ownerId });
  });

  for (const item of affected.values()) {
    try {
      await updateCampaignAggregates(item.campaignId, item.ownerId);
    } catch (err) {
      logger.warn({ campaignId: item.campaignId, ownerId: item.ownerId, err: err.message }, 'Failed to update aggregates after stale recovery');
    }
  }

  logger.info({
    reset: staleIds.length,
    campaignsUpdated: affected.size,
    threshold: threshold.toISOString()
  }, 'Recovered stale processing claims');

  return { reset: staleIds.length, campaignsUpdated: affected.size };
}

worker.on('active', (job) => logger.info({ jobId: job.id }, `Processing ${job.name}`));
worker.on('completed', (job) => logger.info({ jobId: job.id }, `Completed ${job.name}`));
worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err?.message }, `Failed ${job?.name}`));
