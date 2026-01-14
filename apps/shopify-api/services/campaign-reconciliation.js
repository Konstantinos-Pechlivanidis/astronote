import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { CampaignStatus } from '../utils/prismaEnums.js';
import { smsQueue } from '../queue/index.js';
import { createHash } from 'crypto';
import { releaseCredits } from './wallet.js';
import { getCanonicalMetricsForCampaignIds } from './campaign-metrics-batch.js';

function generateJobId(campaignId, recipientIds) {
  const hash = createHash('sha256')
    .update(`${campaignId}:${recipientIds.slice().sort().join(',')}`)
    .digest('hex')
    .substring(0, 16);
  return `campaign:${campaignId}:batch:${hash}`;
}

async function hasActiveJobs(campaignId) {
  const [waiting, active, delayed] = await Promise.all([
    smsQueue.getWaiting(),
    smsQueue.getActive(),
    smsQueue.getDelayed(),
  ]);
  const jobs = [...waiting, ...active, ...delayed];
  return jobs.some(j => j?.data?.campaignId === campaignId);
}

async function enqueueMissingBatches({ campaignId, shopId, pendingRecipientIds }) {
  if (!pendingRecipientIds.length) return 0;
  const SMS_BATCH_SIZE = Number(process.env.SMS_BATCH_SIZE || 500);
  const batches = [];
  for (let i = 0; i < pendingRecipientIds.length; i += SMS_BATCH_SIZE) {
    batches.push(pendingRecipientIds.slice(i, i + SMS_BATCH_SIZE));
  }

  let enqueued = 0;
  for (const ids of batches) {
    const jobId = generateJobId(campaignId, ids);
    const existing = await smsQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (['waiting', 'active', 'delayed', 'completed'].includes(state)) {
        continue;
      }
    }

    await smsQueue.add(
      'sendBulkSMS',
      { campaignId, shopId, recipientIds: ids },
      { jobId, attempts: 5, backoff: { type: 'exponential', delay: 3000 } },
    );
    enqueued++;
  }
  return enqueued;
}

/**
 * Manual reconciliation for a single campaign (tenant-safe).
 * - Never resends recipients that already have `mittoMessageId`
 * - Finalizes campaign when terminal
 */
export async function reconcileCampaign(storeId, campaignId, options = {}) {
  const staleMinutes = Number(options.staleMinutes || 15);
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000);

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId: storeId },
    select: { id: true, shopId: true, status: true, updatedAt: true },
  });
  if (!campaign) {
    return { ok: false, reason: 'not_found' };
  }

  const canonicalById = await getCanonicalMetricsForCampaignIds([campaignId]);
  const canonical = canonicalById.get(campaignId);

  // Queue-level pending recipients (not accepted by provider)
  const pendingRecipients = await prisma.campaignRecipient.findMany({
    where: {
      campaignId,
      status: 'pending',
      mittoMessageId: null,
    },
    select: { id: true },
  });
  const pendingIds = pendingRecipients.map(r => r.id);

  const delivery = canonical?.delivery || { delivered: 0, failedDelivery: 0, pendingDelivery: 0 };
  const totals = canonical?.totals || { recipients: 0, accepted: 0, delivered: 0, failed: 0 };
  const terminalProcessed = (delivery.delivered || 0) + (delivery.failedDelivery || 0);

  // If campaign is sending but terminal by delivery metrics, finalize.
  if (campaign.status === CampaignStatus.sending && totals.recipients > 0 && terminalProcessed >= totals.recipients) {
    const finalStatus =
      delivery.failedDelivery === totals.recipients ? CampaignStatus.failed : CampaignStatus.completed;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: finalStatus, finishedAt: new Date(), updatedAt: new Date() },
    });

    // Release reservation (best effort)
    try {
      const reservation = await prisma.creditReservation.findFirst({
        where: { campaignId, shopId: storeId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      });
      if (reservation) {
        await releaseCredits(reservation.id, { reason: 'campaign_reconciled_terminal' });
      }
    } catch (e) {
      logger.warn({ campaignId, storeId, err: e.message }, 'Failed to release credits during reconcile');
    }

    return {
      ok: true,
      action: 'finalized',
      finalStatus,
      stale: campaign.updatedAt < staleThreshold,
      pendingRecipientIds: pendingIds.length,
      canonical,
    };
  }

  // If campaign is stuck (manual: also allow enqueue if not terminal and no active jobs)
  const stuck =
    campaign.status === CampaignStatus.sending &&
    campaign.updatedAt < staleThreshold &&
    pendingIds.length > 0;

  if (campaign.status === CampaignStatus.sending && pendingIds.length > 0) {
    const jobsActive = await hasActiveJobs(campaignId);
    if (!jobsActive) {
      const enqueued = await enqueueMissingBatches({
        campaignId,
        shopId: storeId,
        pendingRecipientIds: pendingIds,
      });
      return {
        ok: true,
        action: 're_enqueued',
        enqueuedJobs: enqueued,
        stale: stuck,
        pendingRecipientIds: pendingIds.length,
        canonical,
      };
    }
  }

  return {
    ok: true,
    action: 'noop',
    status: campaign.status,
    stale: stuck,
    pendingRecipientIds: pendingIds.length,
    canonical,
  };
}


