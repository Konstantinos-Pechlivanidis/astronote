/**
 * Campaign Reconciliation Job (P1)
 * Detects and fixes stuck campaigns, expired reservations
 * Runs every 5-10 minutes as a repeatable BullMQ job
 */

import prisma from '../../services/prisma.js';
import { logger } from '../../utils/logger.js';
import { CampaignStatus } from '../../utils/prismaEnums.js';
import { releaseCredits } from '../../services/wallet.js';
import { smsQueue } from '../index.js';
import { createHash } from 'crypto';
import { cacheRedis } from '../../config/redis.js';
import { redisSetExBestEffort } from '../../utils/redisSafe.js';

/**
 * Generate deterministic job ID for idempotency
 * @param {string} campaignId - Campaign ID
 * @param {Array<string>} recipientIds - Recipient IDs
 * @returns {string} Job ID
 */
function generateJobId(campaignId, recipientIds) {
  const hash = createHash('sha256')
    .update(`${campaignId}:${recipientIds.sort().join(',')}`)
    .digest('hex')
    .substring(0, 16);
  return `campaign:${campaignId}:batch:${hash}`;
}

/**
 * Find campaigns stuck in "sending" status
 * @param {number} staleMinutes - Minutes since last activity to consider "stuck"
 * @returns {Promise<Array>} Stuck campaigns
 */
async function findStuckCampaigns(staleMinutes = 15) {
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000);

  const stuckCampaigns = await prisma.campaign.findMany({
    where: {
      status: CampaignStatus.sending,
      updatedAt: {
        lt: staleThreshold,
      },
    },
    include: {
      recipients: {
        select: {
          id: true,
          status: true,
          mittoMessageId: true,
        },
      },
    },
  });

  return stuckCampaigns;
}

/**
 * Recompute campaign progress from recipient statuses
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} Progress summary
 */
async function recomputeCampaignProgress(campaignId) {
  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId },
    select: {
      status: true,
      mittoMessageId: true,
    },
  });

  const total = recipients.length;
  const sent = recipients.filter(r => r.status === 'sent' && r.mittoMessageId).length;
  const failed = recipients.filter(r => r.status === 'failed').length;
  const pending = recipients.filter(r => r.status === 'pending' && !r.mittoMessageId).length;

  return { total, sent, failed, pending };
}

/**
 * Check if campaign has active jobs in queue
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<boolean>} True if jobs exist
 */
async function hasActiveJobs(campaignId) {
  // Check waiting/active jobs for this campaign
  const waiting = await smsQueue.getWaiting();
  const active = await smsQueue.getActive();
  const delayed = await smsQueue.getDelayed();
  const allJobs = [...waiting, ...active, ...delayed];
  const campaignJobs = allJobs.filter(job =>
    job.data?.campaignId === campaignId,
  );

  return campaignJobs.length > 0;
}

/**
 * Re-enqueue missing batches for a campaign
 * @param {string} shopId - Shop ID
 * @param {string} campaignId - Campaign ID
 * @param {Array<string>} pendingRecipientIds - Recipient IDs to enqueue
 * @returns {Promise<number>} Number of jobs enqueued
 */
async function reEnqueueMissingBatches(shopId, campaignId, pendingRecipientIds) {
  if (pendingRecipientIds.length === 0) return 0;

  const SMS_BATCH_SIZE = 100;
  const batches = [];
  for (let i = 0; i < pendingRecipientIds.length; i += SMS_BATCH_SIZE) {
    batches.push(pendingRecipientIds.slice(i, i + SMS_BATCH_SIZE));
  }

  let enqueued = 0;
  for (const recipientIds of batches) {
    // Generate deterministic jobId for idempotency
    const jobId = generateJobId(campaignId, recipientIds);
    // Check if job already exists
    const existingJob = await smsQueue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (['waiting', 'active', 'delayed', 'completed'].includes(state)) {
        continue; // Job already exists
      }
    }

    try {
      await smsQueue.add(
        'sendBulkSMS',
        {
          campaignId,
          shopId,
          recipientIds,
        },
        {
          jobId, // Idempotent job ID
          attempts: 5,
          backoff: { type: 'exponential', delay: 3000 },
        },
      );
      enqueued++;
    } catch (err) {
      if (err.message?.includes('already exists')) {
        // Job already exists, skip
        continue;
      }
      logger.error('Failed to re-enqueue batch', {
        campaignId,
        shopId,
        error: err.message,
      });
    }
  }

  return enqueued;
}

/**
 * Expire old credit reservations
 * @param {number} maxAgeHours - Maximum age in hours (default: 48)
 * @returns {Promise<number>} Number of reservations expired
 */
async function expireOldReservations(maxAgeHours = 48) {
  const expirationThreshold = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const oldReservations = await prisma.creditReservation.findMany({
    where: {
      status: 'active',
      createdAt: {
        lt: expirationThreshold,
      },
    },
  });

  let expired = 0;
  for (const reservation of oldReservations) {
    try {
      await releaseCredits(reservation.id, {
        reason: 'expired_reconciliation',
      });
      expired++;
    } catch (err) {
      logger.error('Failed to expire reservation', {
        reservationId: reservation.id,
        shopId: reservation.shopId,
        error: err.message,
      });
    }
  }

  return expired;
}

async function isOnCooldown(campaignId) {
  const cooldownSeconds = Number(process.env.RECONCILE_COOLDOWN_SECONDS || 180);
  if (!cacheRedis || cooldownSeconds <= 0) return false;
  const key = `campaign:reconcile:cooldown:${campaignId}`;
  try {
    const [cooldownFlag, rateLimitFlag] = await Promise.all([
      cacheRedis.get(key),
      cacheRedis.get(`sms:ratelimit:campaign:${campaignId}`),
    ]);
    return Boolean(cooldownFlag || rateLimitFlag);
  } catch {
    return false;
  }
}

async function markCooldown(campaignId) {
  const cooldownSeconds = Number(process.env.RECONCILE_COOLDOWN_SECONDS || 180);
  if (!cacheRedis || cooldownSeconds <= 0) return;
  const key = `campaign:reconcile:cooldown:${campaignId}`;
  await redisSetExBestEffort(cacheRedis, key, cooldownSeconds, '1');
}

/**
 * Main reconciliation job handler
 */
export async function handleReconciliation() {
  const startTime = Date.now();
  logger.info('Starting campaign reconciliation job');

  try {
    // 1. Find stuck campaigns
    const stuckCampaigns = await findStuckCampaigns(15); // 15 minutes stale

    logger.info('Found stuck campaigns', {
      count: stuckCampaigns.length,
    });

    let fixed = 0;
    let reEnqueued = 0;

    for (const campaign of stuckCampaigns) {
      try {
        // 2. Recompute progress
        const progress = await recomputeCampaignProgress(campaign.id);

        logger.info('Campaign progress recomputed', {
          campaignId: campaign.id,
          shopId: campaign.shopId,
          progress,
        });

        // 3. Check if all recipients are terminal
        if (progress.pending === 0) {
          // All recipients are terminal (sent or failed)
          // Aligned with Retail: use 'completed' instead of 'sent'
          const finalStatus = progress.failed === progress.total
            ? CampaignStatus.failed
            : CampaignStatus.completed;

          await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              status: finalStatus,
              finishedAt: new Date(), // Aligned with Retail: track when campaign finished
              updatedAt: new Date(),
            },
          });

          // Release credit reservation
          const reservation = await prisma.creditReservation.findFirst({
            where: {
              campaignId: campaign.id,
              shopId: campaign.shopId,
              status: 'active',
            },
          });

          if (reservation) {
            await releaseCredits(reservation.id, {
              reason: 'campaign_completed_reconciliation',
            });
          }

          logger.info('Campaign marked as completed by reconciliation', {
            campaignId: campaign.id,
            shopId: campaign.shopId,
            finalStatus,
          });

          fixed++;
        } else {
          // 4. Check if there are active jobs
          const hasJobs = await hasActiveJobs(campaign.id);
          const cooldownActive = await isOnCooldown(campaign.id);

          if (!hasJobs && !cooldownActive && progress.pending > 0) {
            // No jobs exist but there are pending recipients - re-enqueue
            const pendingRecipients = await prisma.campaignRecipient.findMany({
              where: {
                campaignId: campaign.id,
                status: 'pending',
                mittoMessageId: null,
              },
              select: { id: true },
            });

            const pendingIds = pendingRecipients.map(r => r.id);
            const jobsEnqueued = await reEnqueueMissingBatches(
              campaign.shopId,
              campaign.id,
              pendingIds,
            );
            await markCooldown(campaign.id);

            logger.info('Re-enqueued missing batches', {
              campaignId: campaign.id,
              shopId: campaign.shopId,
              pendingCount: pendingIds.length,
              jobsEnqueued,
              activeJobsFound: hasJobs,
              decision: 're_enqueued',
            });

            reEnqueued += jobsEnqueued;
          } else {
            logger.info('Reconciliation decision (no re-enqueue)', {
              campaignId: campaign.id,
              shopId: campaign.shopId,
              pendingCount: progress.pending,
              activeJobsFound: hasJobs,
              cooldownActive,
              decision: cooldownActive
                ? 'cooldown_skip'
                : hasJobs
                  ? 'active_jobs_skip'
                  : 'noop',
            });
          }
        }
      } catch (err) {
        logger.error('Error reconciling campaign', {
          campaignId: campaign.id,
          shopId: campaign.shopId,
          error: err.message,
        });
      }
    }

    // 5. Expire old credit reservations
    const expiredReservations = await expireOldReservations(48);

    const duration = Date.now() - startTime;
    logger.info('Campaign reconciliation job completed', {
      stuckCampaigns: stuckCampaigns.length,
      fixed,
      reEnqueued,
      expiredReservations,
      duration: `${duration}ms`,
    });

    return {
      stuckCampaigns: stuckCampaigns.length,
      fixed,
      reEnqueued,
      expiredReservations,
    };
  } catch (error) {
    logger.error('Campaign reconciliation job failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export default {
  handleReconciliation,
};
