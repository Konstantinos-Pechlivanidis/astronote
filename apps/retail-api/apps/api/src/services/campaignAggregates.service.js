// apps/api/src/services/campaignAggregates.service.js
const prisma = require('../lib/prisma');
const pino = require('pino');

const logger = pino({ name: 'campaign-aggregates-service' });

/**
 * Update campaign aggregates (total, sent, failed, processed) from CampaignMessage counts
 * Phase 2.2: sent = only actually sent (status='sent'), processed = sent + failed
 * Note: "delivered" status is mapped to "sent" - we only track sent/failed
 *
 * @param {number} campaignId - Campaign ID
 * @param {number} ownerId - Owner ID for scoping
 * @returns {Promise<Object>} Updated aggregate counts
 */
async function updateCampaignAggregates(campaignId, ownerId) {
  try {
    // Verify campaign exists and belongs to owner
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, ownerId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        deliverySlaSeconds: true,
        createdAt: true,
      },
    });

    if (!campaign) {
      logger.warn({ campaignId, ownerId }, 'Campaign not found or not owned by user');
      return null;
    }

    const { computeCampaignMetrics } = require('./campaignMetrics.service');
    const metrics = await computeCampaignMetrics({ campaignId, ownerId });

    const total = metrics.total;
    const queuedCount = metrics.queued;
    const processingCount = metrics.processing;
    const queuedCombined = queuedCount + processingCount;
    const acceptedCount = metrics.accepted;
    const deliveredCount = metrics.delivered;
    const failedDeliveryCount = metrics.deliveryFailed;
    const pendingDelivery = metrics.pendingDelivery;
    const processed = metrics.processed;

    const isFinished = Boolean(campaign.finishedAt) || ['completed', 'failed'].includes(campaign.status);
    const isNotStarted = !campaign.startedAt && ['draft', 'scheduled', 'paused'].includes(campaign.status);
    if (total === 0 && (isFinished || isNotStarted)) {
      logger.info({
        campaignId,
        ownerId,
        status: campaign.status,
        total,
      }, 'Skipping aggregate update because campaign has no messages but status is stable');
      return {
        total: campaign.total,
        sent: campaign.sent,
        processed: campaign.processed ?? (campaign.sent + campaign.failed),
        failed: campaign.failed,
        campaignStatus: campaign.status,
      };
    }

    // SLA calculation
    const defaultSlaSeconds =
      total <= 100 ? 600 :
        total <= 5000 ? 1800 :
          3600;
    const slaSeconds = campaign.deliverySlaSeconds || defaultSlaSeconds;
    const startedAt = campaign.startedAt || campaign.createdAt;
    const slaExceeded = startedAt ? (Date.now() - new Date(startedAt).getTime()) / 1000 > slaSeconds : false;

    // Determine campaign status based on message states
    let campaignStatus = null;
    if (queuedCombined > 0) {
      campaignStatus = 'sending';
    } else if (pendingDelivery > 0 && !slaExceeded) {
      campaignStatus = 'sending';
    } else if (pendingDelivery > 0 && slaExceeded) {
      // Do not mark failed after SLA; treat as completed with pending delivery outstanding
      campaignStatus = 'completed';
    } else if (queuedCombined === 0 && pendingDelivery === 0 && deliveredCount > 0) {
      campaignStatus = 'completed';
    } else if (queuedCombined === 0 && acceptedCount === 0 && deliveredCount === 0 && failedDeliveryCount === total && total > 0) {
      campaignStatus = 'failed';
    } else if (total === 0) {
      campaignStatus = 'failed';
    }

    // Update campaign aggregates and status
    const updateData = {
      total,
      sent: deliveredCount,
      failed: failedDeliveryCount,
      processed,
      updatedAt: new Date(),
    };

    if (!campaign.startedAt && (campaignStatus === 'sending')) {
      updateData.startedAt = new Date();
    }

    if (campaignStatus) {
      updateData.status = campaignStatus;
      if (campaignStatus === 'completed' || campaignStatus === 'failed' || campaignStatus === 'completed_pending_delivery') {
        updateData.finishedAt = updateData.finishedAt || new Date();
        updateData.deliveryCompletedAt = updateData.deliveryCompletedAt || new Date();
      }
      updateData.deliverySlaSeconds = slaSeconds;
    }

    await prisma.campaign.updateMany({
      where: { id: campaignId, ownerId },
      data: updateData,
    });

    logger.info({
      campaignId,
      total,
      sent: deliveredCount,
      processed,
      failed: failedDeliveryCount,
      queued: queuedCombined,
      pendingDelivery,
      campaignStatus: campaignStatus || 'unchanged',
    }, 'Campaign aggregates updated');

    return { total, sent: deliveredCount, processed, failed: failedDeliveryCount, campaignStatus };
  } catch (err) {
    logger.error({ campaignId, ownerId, err: err.message }, 'Failed to update campaign aggregates');
    // Don't throw - aggregates can be recalculated later
    return null;
  }
}

/**
 * Recalculate aggregates for all campaigns owned by a user
 * Useful for bulk updates or data consistency checks
 *
 * @param {number} ownerId - Owner ID
 * @returns {Promise<Object>} Summary of updates
 */
async function recalculateAllCampaignAggregates(ownerId) {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: ownerId ? { ownerId } : {},
      select: { id: true, ownerId: true },
    });

    let updated = 0;
    let errors = 0;

    for (const campaign of campaigns) {
      const result = await updateCampaignAggregates(campaign.id, campaign.ownerId);
      if (result) {
        updated++;
      } else {
        errors++;
      }
    }

    logger.info({ ownerId, updated, errors, total: campaigns.length }, 'Bulk campaign aggregates update completed');

    return { updated, errors, total: campaigns.length };
  } catch (err) {
    logger.error({ ownerId, err: err.message }, 'Failed to recalculate all campaign aggregates');
    throw err;
  }
}

module.exports = {
  updateCampaignAggregates,
  recalculateAllCampaignAggregates,
};
