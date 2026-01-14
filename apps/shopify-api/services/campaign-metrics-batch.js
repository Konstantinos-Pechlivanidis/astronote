import prisma from './prisma.js';
import {
  buildCanonicalCampaignMetrics,
  MITTO_DELIVERED_STATUS_DB_VALUES,
  MITTO_FAILED_STATUS_DB_VALUES,
} from './campaign-status-metrics.js';

/**
 * Compute canonical metrics for a set of campaign IDs using batched groupBy queries.
 * This is used to avoid N+1 in list endpoints.
 */
export async function getCanonicalMetricsForCampaignIds(campaignIds) {
  const ids = Array.isArray(campaignIds) ? campaignIds.filter(Boolean) : [];
  if (ids.length === 0) return new Map();

  const [totalCounts, acceptedCounts, deliveredCounts, failedCounts] =
    await Promise.all([
      prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: ids }, mittoMessageId: { not: null } },
        _count: { _all: true },
      }),
      prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: {
          campaignId: { in: ids },
          deliveryStatus: { in: MITTO_DELIVERED_STATUS_DB_VALUES },
        },
        _count: { _all: true },
      }),
      prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: {
          campaignId: { in: ids },
          OR: [
            { status: 'failed' },
            { deliveryStatus: { in: MITTO_FAILED_STATUS_DB_VALUES } },
          ],
        },
        _count: { _all: true },
      }),
    ]);

  const totalsBy = new Map(totalCounts.map(r => [r.campaignId, r._count._all]));
  const acceptedBy = new Map(acceptedCounts.map(r => [r.campaignId, r._count._all]));
  const deliveredBy = new Map(deliveredCounts.map(r => [r.campaignId, r._count._all]));
  const failedBy = new Map(failedCounts.map(r => [r.campaignId, r._count._all]));

  const out = new Map();
  for (const id of ids) {
    const recipients = totalsBy.get(id) || 0;
    const accepted = acceptedBy.get(id) || 0;
    const delivered = deliveredBy.get(id) || 0;
    const failed = failedBy.get(id) || 0;
    out.set(id, buildCanonicalCampaignMetrics({ recipients, accepted, delivered, failed }));
  }

  return out;
}


