import prisma from '../services/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { getStoreId } from '../middlewares/store-resolution.js';
import { cacheRedis, queueRedis } from '../config/redis.js';
import { smsQueue, campaignQueue, automationQueue, deliveryStatusQueue, allCampaignsStatusQueue, reconciliationQueue } from '../queue/index.js';
import billingService from '../services/billing.js';
import { areWorkersStarted } from '../queue/start-workers.js';
import { getWorkerMode } from '../config/worker-mode.js';

async function safePing(redisClient, kind) {
  try {
    if (!redisClient) return { kind, ok: false, status: 'missing' };
    if (kind === 'cacheRedis') {
      const pong = await cacheRedis.ping();
      return { kind, ok: pong === 'PONG', pong };
    }
    // ioredis
    const pong = await redisClient.ping();
    return { kind, ok: pong === 'PONG', pong, status: redisClient.status };
  } catch (e) {
    return { kind, ok: false, error: e?.message || String(e) };
  }
}

async function queueCounts(q) {
  try {
    const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
    return counts;
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}

export async function getQueues(req, res, next) {
  try {
    const storeId = getStoreId(req);
    const mode = await getWorkerMode().catch(() => null);

    const [queuePing, cachePing] = await Promise.all([
      safePing(queueRedis, 'queueRedis'),
      safePing(cacheRedis, 'cacheRedis'),
    ]);

    const queues = [
      { name: 'sms-send', q: smsQueue },
      { name: 'campaign-send', q: campaignQueue },
      { name: 'automation-trigger', q: automationQueue },
      { name: 'delivery-status-update', q: deliveryStatusQueue },
      { name: 'all-campaigns-status-update', q: allCampaignsStatusQueue },
      { name: 'reconciliation', q: reconciliationQueue },
    ];

    const queueStats = {};
    for (const entry of queues) {
      // eslint-disable-next-line no-await-in-loop
      queueStats[entry.name] = await queueCounts(entry.q);
    }

    return sendSuccess(res, {
      storeId,
      workerMode: mode,
      workersStartedEmbedded: areWorkersStarted(),
      runScheduler: process.env.RUN_SCHEDULER || 'true (default)',
      redis: { queueRedis: queuePing, cacheRedis: cachePing },
      queues: queueStats,
    });
  } catch (e) {
    next(e);
  }
}

export async function getCampaignDebug(req, res, next) {
  try {
    const storeId = getStoreId(req);
    const { id: campaignId } = req.params;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, shopId: storeId },
      include: { metrics: true },
    });

    if (!campaign) {
      return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Campaign not found' });
    }

    const [byStatus, byDeliveryStatus] = await Promise.all([
      prisma.campaignRecipient.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: { _all: true },
      }),
      prisma.campaignRecipient.groupBy({
        by: ['deliveryStatus'],
        where: { campaignId },
        _count: { _all: true },
      }),
    ]);

    // Find any in-flight queue jobs for this campaign (limited scan)
    const jobs = { waiting: [], active: [], delayed: [] };
    try {
      const [waiting, active, delayed] = await Promise.all([
        smsQueue.getWaiting(),
        smsQueue.getActive(),
        smsQueue.getDelayed(),
      ]);
      const filter = (arr) =>
        arr
          .filter((j) => j?.data?.campaignId === campaignId)
          .slice(0, 25)
          .map((j) => ({ id: j.id, name: j.name, timestamp: j.timestamp, data: { campaignId: j.data?.campaignId, recipientIdsCount: j.data?.recipientIds?.length } }));
      jobs.waiting = filter(waiting);
      jobs.active = filter(active);
      jobs.delayed = filter(delayed);
    } catch (e) {
      jobs.error = e?.message || String(e);
    }

    return sendSuccess(res, {
      campaign: {
        id: campaign.id,
        status: campaign.status,
        startedAt: campaign.startedAt,
        finishedAt: campaign.finishedAt,
        scheduleType: campaign.scheduleType,
        scheduleAt: campaign.scheduleAt,
        updatedAt: campaign.updatedAt,
        meta: campaign.meta || {},
      },
      metrics: campaign.metrics || null,
      recipientsByStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      recipientsByDeliveryStatus: byDeliveryStatus.map((r) => ({ deliveryStatus: r.deliveryStatus || '(null)', count: r._count._all })),
      queueJobs: jobs,
    });
  } catch (e) {
    next(e);
  }
}

export async function getCreditsDebug(req, res, next) {
  try {
    const storeId = getStoreId(req);

    const [balance, shop, wallet, reservations, lastCredits] = await Promise.all([
      billingService.getBalance(storeId),
      prisma.shop.findUnique({
        where: { id: storeId },
        select: {
          includedSmsPerPeriod: true,
          usedSmsThisPeriod: true,
          subscriptionStatus: true,
          subscriptionInterval: true,
          currency: true,
        },
      }),
      prisma.wallet.findUnique({ where: { shopId: storeId } }),
      prisma.creditReservation.findMany({
        where: { shopId: storeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.creditTransaction.findMany({
        where: { shopId: storeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const remainingAllowance = shop?.includedSmsPerPeriod
      ? Math.max(0, shop.includedSmsPerPeriod - (shop.usedSmsThisPeriod || 0))
      : 0;

    return sendSuccess(res, {
      billingBalanceDto: balance,
      allowance: {
        includedSmsPerPeriod: shop?.includedSmsPerPeriod ?? 0,
        usedSmsThisPeriod: shop?.usedSmsThisPeriod ?? 0,
        remainingAllowance,
        subscriptionStatus: shop?.subscriptionStatus ?? null,
        subscriptionInterval: shop?.subscriptionInterval ?? null,
        currency: shop?.currency ?? null,
      },
      wallet: wallet ? { balance: wallet.balance, totalUsed: wallet.totalUsed, totalBought: wallet.totalBought, updatedAt: wallet.updatedAt } : null,
      creditReservations: reservations.map((r) => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        campaignId: r.campaignId,
        reservationKey: r.reservationKey,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      })),
      lastCreditTransactions: lastCredits.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        reason: t.reason,
        idempotencyKey: t.idempotencyKey,
        createdAt: t.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
}

export default {
  getQueues,
  getCampaignDebug,
  getCreditsDebug,
};


