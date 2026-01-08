const prisma = require('../lib/prisma');

const deliveredStatuses = ['Delivered', 'delivered', 'delivrd', 'completed', 'ok'];
const failedDeliveryStatuses = ['failure', 'failed', 'Failed', 'undelivered', 'Undelivered', 'expired', 'rejected', 'error'];

/**
 * Canonical campaign metrics computed from CampaignMessage only.
 * @returns {Promise<{total:number, queued:number, processing:number, accepted:number, delivered:number, deliveryFailed:number, pendingDelivery:number, processed:number}>}
 */
async function computeCampaignMetrics({ campaignId, ownerId }) {
  if (!campaignId || !ownerId) {
    throw new Error('campaignId and ownerId are required');
  }

  const [total, queued, processing, accepted, delivered, deliveryFailed] = await Promise.all([
    prisma.campaignMessage.count({ where: { campaignId, ownerId } }),
    prisma.campaignMessage.count({ where: { campaignId, ownerId, status: 'queued' } }),
    prisma.campaignMessage.count({ where: { campaignId, ownerId, status: 'processing' } }),
    prisma.campaignMessage.count({ where: { campaignId, ownerId, providerMessageId: { not: null } } }),
    prisma.campaignMessage.count({
      where: {
        campaignId,
        ownerId,
        deliveryStatus: { in: deliveredStatuses },
      },
    }),
    prisma.campaignMessage.count({
      where: {
        campaignId,
        ownerId,
        deliveryStatus: { in: failedDeliveryStatuses },
      },
    }),
  ]);

  const pendingDelivery = Math.max(accepted - delivered - deliveryFailed, 0);
  const processed = delivered + deliveryFailed;

  return {
    total,
    queued,
    processing,
    accepted,
    delivered,
    deliveryFailed,
    pendingDelivery,
    processed,
  };
}

module.exports = {
  computeCampaignMetrics,
  deliveredStatuses,
  failedDeliveryStatuses,
};
