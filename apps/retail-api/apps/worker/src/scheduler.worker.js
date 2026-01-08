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
const { Queue, Worker } = require('bullmq');
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
const SWEEP_INTERVAL_MS = Number(process.env.SCHEDULE_SWEEP_INTERVAL_MS || 60000);
const SWEEP_LIMIT = Number(process.env.SCHEDULE_SWEEP_LIMIT || 25);
const CLAIM_STALE_MINUTES = Number(process.env.SEND_CLAIM_STALE_MINUTES || 15);
const STALE_RECOVERY_LIMIT = Number(process.env.STALE_RECOVERY_LIMIT || 200);
const ENQUEUE_LOCK_TTL_SEC = Number(process.env.ENQUEUE_LOCK_TTL_SEC || 600);

const schedulerQueue = new Queue('schedulerQueue', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

schedulerQueue.add(
  'sweepDueCampaigns',
  {},
  {
    repeat: {
      every: SWEEP_INTERVAL_MS,
      immediately: true,
    },
    jobId: 'scheduled-campaign-sweeper',
  },
).then(() => {
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, 'Scheduled campaign sweeper registered');
}).catch((err) => {
  logger.error({ err: err.message, intervalMs: SWEEP_INTERVAL_MS }, 'Failed to register campaign sweeper');
});

const worker = new Worker(
  'schedulerQueue',
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name, jobData: job.data }, 'Processing scheduled job');

    if (job.name === 'sweepDueCampaigns') {
      return sweepDueCampaigns(job);
    }

    logger.warn({ jobId: job.id, jobName: job.name }, 'Unknown or legacy scheduler job, skipping');
    return;
  },
  { connection, concurrency }
);

async function sweepDueCampaigns(job) {
  const now = new Date();
  const dueCampaigns = await prisma.campaign.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: now } },
    select: { id: true, ownerId: true, scheduledAt: true },
    orderBy: { scheduledAt: 'asc' },
    take: SWEEP_LIMIT
  });

  let enqueued = 0;
  const sweepId = job?.id || `sweep:${Date.now().toString(36)}`;
  if (!dueCampaigns.length) {
    logger.debug({ checkedAt: now.toISOString(), sweepId }, 'No scheduled campaigns ready to enqueue');
  } else {
    for (const camp of dueCampaigns) {
      const correlationId = `${sweepId}:${camp.id}`;
      const lockAcquired = await acquireEnqueueLock(camp.id, correlationId);
      if (!lockAcquired) {
        logger.info({ campaignId: camp.id, ownerId: camp.ownerId, sweepId }, 'Enqueue lock held, skipping scheduled campaign');
        continue;
      }
      try {
        const result = await enqueueCampaign(Number(camp.id), { correlationId, source: 'scheduler-sweep' });
        if (result?.ok) {
          enqueued++;
          logger.info({ campaignId: camp.id, ownerId: camp.ownerId, enqueuedJobs: result.enqueuedJobs, sweepId }, 'Scheduled campaign enqueued via sweep');
        } else {
          logger.warn({ campaignId: camp.id, ownerId: camp.ownerId, reason: result?.reason, sweepId }, 'Scheduled sweep enqueue blocked');
        }
      } catch (err) {
        logger.error({ campaignId: camp.id, ownerId: camp.ownerId, err: err.message, sweepId }, 'Error enqueuing scheduled campaign during sweep');
      } finally {
        await releaseEnqueueLock(camp.id, correlationId);
      }
    }
  }

  // Also recover stale processing claims so campaigns don't get stuck
  const recovered = await recoverStaleProcessingClaims();

  return { scanned: dueCampaigns.length, enqueued, recovered };
}

async function acquireEnqueueLock(campaignId, correlationId) {
  const lockKey = `campaign:enqueue:${campaignId}`;
  try {
    const result = await connection.set(lockKey, correlationId, 'NX', 'EX', ENQUEUE_LOCK_TTL_SEC);
    return result === 'OK';
  } catch (err) {
    logger.warn({ campaignId, err: err.message }, 'Failed to acquire enqueue lock, proceeding without lock');
    return true;
  }
}

async function releaseEnqueueLock(campaignId, correlationId) {
  const lockKey = `campaign:enqueue:${campaignId}`;
  try {
    const current = await connection.get(lockKey);
    if (!current || current === correlationId) {
      await connection.del(lockKey);
    }
  } catch (err) {
    logger.warn({ campaignId, err: err.message }, 'Failed to release enqueue lock');
  }
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
