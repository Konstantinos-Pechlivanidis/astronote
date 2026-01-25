const prisma = require('../lib/prisma');

// Utility: safe division
function rate(numer, denom) {
  return denom > 0 ? Number((numer / denom).toFixed(4)) : 0;
}

async function getFirstSentAt(campaignId, ownerId) {
  const first = await prisma.campaignMessage.findFirst({
    where: { ownerId, campaignId, sentAt: { not: null } },
    orderBy: { sentAt: 'asc' },
    select: { sentAt: true },
  });
  return first?.sentAt || null;
}

/**
 * Scoped stats for a single campaign that belongs to `ownerId`.
 * Throws { code: 'NOT_FOUND' } if the campaign doesn't belong to owner.
 */
exports.getCampaignStats = async (campaignId, ownerId) => {
  if (!ownerId) {throw new Error('ownerId is required');}

  // Ensure the campaign belongs to owner and fetch metrics from messages
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId },
    select: {
      id: true,
      status: true,
      total: true,
      sent: true,
      failed: true,
      processed: true,
      updatedAt: true,
    },
  });
  if (!campaign) {
    const err = new Error('campaign not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const { computeCampaignMetrics } = require('./campaignMetrics.service');
  const metrics = await computeCampaignMetrics({ campaignId, ownerId });
  if (metrics.total === 0 && campaign.total > 0 && ['completed', 'failed'].includes(campaign.status)) {
    metrics.accepted = (campaign.sent || 0) + (campaign.failed || 0);
    metrics.delivered = campaign.sent || 0;
    metrics.deliveryFailed = campaign.failed || 0;
    metrics.pendingDelivery = 0;
    metrics.processed = Number.isFinite(campaign.processed)
      ? campaign.processed
      : (campaign.sent || 0) + (campaign.failed || 0);
    metrics.total = campaign.total;
  }

  // Get conversions count from Redemption table (this is our conversion tracking)
  const conversions = await prisma.redemption.count({
    where: { ownerId, campaignId },
  });

  // recipients (distinct contacts) — scoped via campaignMessage.ownerId
  const recipients = await prisma.campaignMessage.groupBy({
    by: ['contactId'],
    where: { ownerId, campaignId },
  });
  const recipientIds = recipients.map(r => r.contactId);

  // firstSentAt for unsubscribe window
  const firstSentAt = await getFirstSentAt(campaignId, ownerId);

  // unsubscribes among recipients since the campaign started sending
  let unsubscribes = 0;
  if (recipientIds.length && firstSentAt) {
    unsubscribes = await prisma.contact.count({
      where: {
        ownerId,                          // << scope
        id: { in: recipientIds },
        unsubscribedAt: { gte: firstSentAt },
      },
    });
  }

  return {
    metrics,
    total: metrics.total,
    // Canonical fields (preferred)
    accepted: metrics.accepted,
    delivered: metrics.delivered,
    failedDelivery: metrics.deliveryFailed,
    pendingDelivery: metrics.pendingDelivery,
    // Backward compatibility (legacy consumers treat "sent" as delivered)
    sent: metrics.delivered,
    failed: metrics.deliveryFailed,
    conversions,
    unsubscribes,
    failureRate: rate(metrics.deliveryFailed, metrics.delivered || 1),
    conversionRate: rate(conversions, metrics.delivered || 1), // Conversion rate = conversions / delivered
    firstSentAt,
    updatedAt: campaign.updatedAt,
  };
};

/**
 * Optional: bulk scoped stats for multiple campaignIds
 * Uses Campaign aggregates for consistency and performance
 */
exports.getManyCampaignsStats = async (campaignIds, ownerId) => {
  if (!ownerId) {throw new Error('ownerId is required');}
  if (!campaignIds?.length) {return [];}

  // Get campaigns with aggregates (more efficient than counting messages)
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds }, ownerId },
    select: {
      id: true,
      total: true,
      status: true,
      sent: true,
      failed: true,
      processed: true,
    },
  });

  // Get conversions count per campaign (from Redemption table)
  const conversions = await prisma.redemption.groupBy({
    by: ['campaignId'],
    where: { ownerId, campaignId: { in: campaignIds } },
    _count: { _all: true },
  });

  // Create a map for quick lookup
  const conversionsMap = new Map(conversions.map(c => [c.campaignId, c._count._all]));

  const { computeCampaignMetrics } = require('./campaignMetrics.service');
  const metricsList = await Promise.all(
    campaigns.map(c => computeCampaignMetrics({ campaignId: c.id, ownerId })),
  );

  // Shape into per-campaign summary with rates (delivered as "sent" for backward compatibility)
  const out = campaigns.map((c, idx) => {
    const m = metricsList[idx];
    const conversionsCount = conversionsMap.get(c.id) || 0;
    if (m.total === 0 && c.total > 0 && ['completed', 'failed'].includes(c.status)) {
      const delivered = c.sent || 0;
      const deliveryFailed = c.failed || 0;
      return {
        campaignId: c.id,
        total: c.total,
        accepted: delivered + deliveryFailed,
        delivered,
        failedDelivery: deliveryFailed,
        pendingDelivery: 0,
        // Backward compatibility
        sent: delivered,
        failed: deliveryFailed,
        conversions: conversionsCount,
        failureRate: rate(deliveryFailed, delivered || 1),
        conversionRate: rate(conversionsCount, delivered || 1),
      };
    }
    return {
      campaignId: c.id,
      total: m.total,
      accepted: m.accepted,
      delivered: m.delivered,
      failedDelivery: m.deliveryFailed,
      pendingDelivery: m.pendingDelivery,
      // Backward compatibility
      sent: m.delivered,
      failed: m.deliveryFailed,
      conversions: conversionsCount,
      failureRate: rate(m.deliveryFailed, m.delivered || 1),
      conversionRate: rate(conversionsCount, m.delivered || 1),
    };
  });

  return out;
};
