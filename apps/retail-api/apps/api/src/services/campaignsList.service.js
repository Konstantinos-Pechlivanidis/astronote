const prisma = require('../lib/prisma');

function rate(numer, denom) {
  return denom > 0 ? Number((numer / denom).toFixed(4)) : 0;
}

/**
 * List campaigns for a specific owner, with optional aggregated KPIs.
 *
 * @param {Object} params
 * @param {number} params.ownerId            // << REQUIRED for scoping
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=10]
 * @param {string} [params.q]
 * @param {string} [params.status]
 * @param {string} [params.dateFrom]
 * @param {string} [params.dateTo]
 * @param {string} [params.orderBy='createdAt']  // createdAt|scheduledAt|startedAt|finishedAt|name|status
 * @param {string} [params.order='desc']         // asc|desc
 * @param {boolean} [params.withStats=true]
 */
exports.listCampaigns = async ({
  ownerId,                           // << NEW (required)
  page = 1,
  pageSize = 10,
  q,
  status,
  dateFrom,
  dateTo,
  orderBy = 'createdAt',
  order = 'desc',
  withStats = true
}) => {
  if (!ownerId) {throw new Error('ownerId is required');}

  page = Math.max(1, Number(page));
  pageSize = Math.min(100, Math.max(1, Number(pageSize)));

  // Base scope per owner
  const where = { ownerId };

  if (q) {where.name = { contains: q, mode: 'insensitive' };}
  if (status) {where.status = status;}
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {where.createdAt.gte = new Date(dateFrom);}
    if (dateTo) {where.createdAt.lte = new Date(dateTo);}
  }

  const [total, campaigns] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.findMany({
      where,
      orderBy: { [orderBy]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        scheduledAt: true,
        startedAt: true,
        finishedAt: true,
        total: true,
        sent: true,
        failed: true,
        processed: true
      }
    })
  ]);

  if (!withStats || campaigns.length === 0) {
    return { total, items: campaigns };
  }

  const ids = campaigns.map(c => c.id);

  // Aggregations scoped by ownerId - wrap in try-catch for resilience
  let msgs = [];
  let reds = [];
  
  try {
    msgs = await prisma.campaignMessage.groupBy({
      by: ['campaignId', 'status'],
      where: { ownerId, campaignId: { in: ids } },   // << SCOPE
      _count: { _all: true }
    });
  } catch (error) {
    const logger = require('pino')({ name: 'campaignsList.service' });
    logger.warn({ err: error, ownerId, campaignIds: ids }, 'Error fetching campaign message stats, using defaults');
    // Continue with empty array - stats will default to 0
  }

  try {
    reds = await prisma.redemption.groupBy({
      by: ['campaignId'],
      where: { ownerId, campaignId: { in: ids } },   // << SCOPE
      _count: { _all: true }
    });
  } catch (error) {
    const logger = require('pino')({ name: 'campaignsList.service' });
    logger.warn({ err: error, ownerId, campaignIds: ids }, 'Error fetching redemption stats, using defaults');
    // Continue with empty array - stats will default to 0
  }

  // Note: "delivered" status is mapped to "sent" - we only track sent/failed
  const { computeCampaignMetrics } = require('./campaignMetrics.service');
  const statsMap = new Map();
  for (const id of ids) {statsMap.set(id, { delivered: 0, deliveryFailed: 0, redemptions: 0 });}

  // Compute metrics per campaign (canonical)
  const metricsList = await Promise.all(
    ids.map((id) => computeCampaignMetrics({ campaignId: id, ownerId }))
  );
  metricsList.forEach((m, idx) => {
    const id = ids[idx];
    statsMap.set(id, { delivered: m.delivered, deliveryFailed: m.deliveryFailed, redemptions: 0 });
  });
  for (const row of reds) {
    const s = statsMap.get(row.campaignId);
    if (s) {
      s.redemptions = row._count._all;
    }
  }

  // Note: "delivered" status is mapped to "sent" - deliveredRate is same as sent rate
  const items = campaigns.map(c => {
    const s = statsMap.get(c.id) || { delivered:0, deliveryFailed:0, redemptions:0 };
    return {
      ...c,
      stats: {
        sent: s.delivered, // keep compatibility with UI expecting "sent"
        delivered: s.delivered,
        failed: s.deliveryFailed,
        deliveredRate: rate(s.delivered, s.delivered || 1),
        conversionRate: rate(s.redemptions, s.delivered || 1)
      }
    };
  });

  return { total, items };
};
