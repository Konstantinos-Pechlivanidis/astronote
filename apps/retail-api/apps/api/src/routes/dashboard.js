// apps/api/src/routes/dashboard.js
const { Router } = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/requireAuth');
const pino = require('pino');

const logger = pino({ name: 'dashboard-route' });
const r = Router();

/**
 * GET /dashboard/kpis
 * Returns aggregated KPI data for the authenticated user's store
 * Returns safe defaults (0) if queries fail, but logs errors for debugging
 */
r.get('/dashboard/kpis', requireAuth, async (req, res, _next) => {
  const ownerId = req.user.id;

  // Safe defaults - return these if any query fails
  const safeDefaults = {
    totalCampaigns: 0,
    totalMessages: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    sentRate: 0,
    deliveredRate: 0,
    conversion: 0,
    conversionRate: 0,
  };

  try {
    // Aggregate campaign counts - wrap in try-catch for resilience
    let totalCampaigns = 0;
    try {
      totalCampaigns = await prisma.campaign.count({
        where: { ownerId },
      });
    } catch (err) {
      logger.error({ err, ownerId }, 'Failed to count campaigns');
      // Continue with default (0)
    }

    // Use Campaign aggregates for total (includes queued messages)
    let totalMessages = 0;
    try {
      const campaignAggregates = await prisma.campaign.aggregate({
        where: { ownerId },
        _sum: {
          total: true,  // Total includes queued + sent + failed
        },
      });
      totalMessages = Number(campaignAggregates._sum.total ?? 0);
    } catch (err) {
      logger.error({ err, ownerId }, 'Failed to aggregate campaigns');
      // Continue with default (0)
    }

    // Count messages by status for accurate sent/failed counts
    let sent = 0;
    let failed = 0;
    try {
      const messageStats = await prisma.campaignMessage.groupBy({
        by: ['status'],
        where: {
          ownerId,
        },
        _count: {
          id: true,
        },
      });

      messageStats.forEach(stat => {
        const count = Number(stat._count.id);
        if (stat.status === 'sent') {
          sent += count;
        } else if (stat.status === 'failed') {
          failed += count;
        }
        // Note: queued messages are included in totalMessages but not in sent/failed
      });
    } catch (err) {
      logger.error({ err, ownerId }, 'Failed to group messages by status');
      // Continue with defaults (0)
    }

    // Calculate rates (deliveredRate is same as sent rate since delivered maps to sent)
    const sentRate = totalMessages > 0 ? sent / totalMessages : 0;
    const deliveredRate = sentRate;

    // Aggregate conversions (redemptions) - count from Redemption table
    let conversion = 0;
    try {
      conversion = await prisma.redemption.count({
        where: {
          ownerId,
        },
      });
    } catch (err) {
      logger.error({ err, ownerId }, 'Failed to count redemptions');
      // Continue with default (0)
    }

    const conversionRate = sent > 0 ? conversion / sent : 0;

    // Ensure all values are numbers (not BigInt from Prisma)
    const kpis = {
      totalCampaigns: Number(totalCampaigns),
      totalMessages: Number(totalMessages),
      sent: Number(sent),
      delivered: Number(sent), // For backward compatibility (delivered = sent in our system)
      failed: Number(failed),
      sentRate: Number(sentRate),
      deliveredRate: Number(deliveredRate),
      conversion: Number(conversion),
      conversionRate: Number(conversionRate),
    };

    res.json(kpis);
  } catch (e) {
    // If we get here, it's an unexpected error (not a query failure)
    // Log it and return safe defaults instead of 500
    logger.error({ err: e, ownerId }, 'Unexpected error in /dashboard/kpis');

    // Return safe defaults rather than 500 - this ensures the frontend can still render
    // The frontend will show zeros, which is better than a broken page
    return res.status(200).json(safeDefaults);
  }
});

module.exports = r;
