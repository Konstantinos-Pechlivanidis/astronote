// apps/api/src/services/campaignEnqueue.service.js
const prisma = require('../lib/prisma');
const { render } = require('../lib/template');
const { shortenUrlsInText } = require('./urlShortener.service');
const crypto = require('node:crypto');
const pino = require('pino');

const logger = pino({ name: 'campaign-enqueue-service' });

function formatRedisInfo(connection) {
  if (!connection) {
    return {};
  }
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

function newTrackingId() {
  return crypto.randomBytes(9).toString('base64url');
}

function ensureCorrelationId(value) {
  if (value) {
    return value;
  }
  return `enqueue:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

exports.enqueueCampaign = async (campaignId, options = {}) => {
  const correlationId = ensureCorrelationId(options?.correlationId);
  const source = options?.source || 'unknown';
  let step = 'load_campaign';
  let camp;

  try {
    // 0) Fetch campaign and build audience OUTSIDE transaction (heavy work)
    camp = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!camp) {
      logger.warn({ correlationId, campaignId, step, source }, 'Campaign not found');
      return { ok: false, reason: 'not_found', enqueuedJobs: 0 };
    }

    const baseContext = {
      correlationId,
      campaignId: camp.id,
      ownerId: camp.ownerId,
      shopId: camp.ownerId,
      source,
    };

    logger.info({ ...baseContext, step, status: camp.status }, 'Campaign loaded');

    if (!['draft', 'scheduled', 'paused'].includes(camp.status)) {
      logger.warn({ ...baseContext, step: 'validate_status', status: camp.status }, 'Campaign status invalid for enqueue');
      return { ok: false, reason: `invalid_status:${camp.status}`, enqueuedJobs: 0 };
    }

    const initialStatus = camp.status;

    // Ensure queue is available BEFORE heavy work
    step = 'queue_ready';
    let smsQueueModule;
    try {
      smsQueueModule = require('../queues/sms.queue');
    } catch (err) {
      logger.error({ ...baseContext, step, err: err.message, stack: err.stack }, 'Failed to load SMS queue module');
      return { ok: false, reason: 'queue_unavailable', enqueuedJobs: 0 };
    }
    const smsQueue = smsQueueModule?.default || smsQueueModule; // handle CommonJS export
    if (!smsQueue) {
      logger.error({ ...baseContext, step }, 'SMS queue unavailable (module returned null)');
      return { ok: false, reason: 'queue_unavailable', enqueuedJobs: 0 };
    }

    let redisInfo = {};
    try {
      if (smsQueueModule.queueReady) {
        await smsQueueModule.queueReady;
      } else if (smsQueue.waitUntilReady) {
        await smsQueue.waitUntilReady();
      }
      const connection = smsQueue.opts?.connection || smsQueue.client;
      redisInfo = formatRedisInfo(connection);
    } catch (err) {
      logger.error({ ...baseContext, step, err: err.message, stack: err.stack }, 'SMS queue not ready');
      return { ok: false, reason: 'queue_unavailable', enqueuedJobs: 0 };
    }

    const queueName = smsQueue.name || 'smsQueue';

    logger.info({
      ...baseContext,
      step,
      queue: queueName,
      redis: redisInfo,
      status: camp.status,
    }, 'enqueueCampaign called');

    // Build audience OUTSIDE transaction (this can be slow with many contacts)
    step = 'resolve_audience';
    logger.info({
      ...baseContext,
      step,
      filterGender: camp.filterGender,
      filterAgeGroup: camp.filterAgeGroup,
      listId: camp.listId,
    }, 'Resolving campaign audience');
    let contacts = [];

    // Use new system-defined segmentation (allows both filters to be null = all eligible contacts)
    if (camp.filterGender !== null || camp.filterAgeGroup !== null || camp.listId === null) {
      const { buildAudience } = require('./audience.service');

      // Map Prisma enum back to normalized format
      const { mapAgeGroupToApi } = require('../lib/routeHelpers');
      const ageGroup = mapAgeGroupToApi(camp.filterAgeGroup);

      contacts = await buildAudience(
        camp.ownerId,
        camp.filterGender,
        ageGroup,
        null, // No name search when enqueuing
      );
    } else if (camp.listId) {
      // Legacy: use list memberships (only if filters are not set and listId exists)
      const members = await prisma.listMembership.findMany({
        where: { listId: camp.listId, contact: { isSubscribed: true } },
        include: { contact: true },
      });
      contacts = members.map(m => m.contact);
    } else {
      // No filters and no list - invalid campaign
      logger.warn({ ...baseContext, step }, 'Campaign has no filters or list');
      await prisma.campaign.updateMany({
        where: { id: camp.id, ownerId: camp.ownerId },
        data: { status: 'failed', finishedAt: new Date(), total: 0 },
      });
      return { ok: false, reason: 'no_filters_or_list', enqueuedJobs: 0 };
    }

    if (!contacts.length) {
      logger.warn({ ...baseContext, step, recipientCount: 0 }, 'No eligible recipients found');
      await prisma.campaign.updateMany({
        where: { id: camp.id, ownerId: camp.ownerId },
        data: { status: 'failed', finishedAt: new Date(), total: 0 },
      });
      return { ok: false, reason: 'no_recipients', enqueuedJobs: 0 };
    }

    logger.info({ ...baseContext, step, recipientCount: contacts.length }, 'Audience built, checking subscription and billing');

    // 1) Check subscription status BEFORE starting any transaction
    step = 'check_subscription';
    logger.info({ ...baseContext, step }, 'Checking subscription status');
    const { canSendOrSpendCredits, getAllowanceStatus } = require('./subscription.service');
    const subscriptionGate = await canSendOrSpendCredits(camp.ownerId);
    if (!subscriptionGate.allowed) {
      logger.warn({ ...baseContext, step }, 'Inactive subscription - campaign enqueue blocked');
      return { ok: false, reason: subscriptionGate.reason || 'inactive_subscription', enqueuedJobs: 0 };
    }

    // 2) Check allowance + credits BEFORE starting any transaction
    step = 'check_billing';
    const { getWalletSummary } = require('./wallet.service');
    const walletSummary = await getWalletSummary(camp.ownerId);
    const allowance = await getAllowanceStatus(camp.ownerId);
    const requiredCredits = contacts.length;
    const availableCredits = (allowance?.remainingThisPeriod || 0) + (walletSummary.available || 0);

    logger.info({
      ...baseContext,
      step,
      currentBalance: walletSummary.balance,
      reservedBalance: walletSummary.reservedBalance,
      allowanceRemaining: allowance?.remainingThisPeriod || 0,
      requiredCredits,
      availableCredits,
    }, 'Billing check completed');
    if (availableCredits < requiredCredits) {
      logger.warn({
        ...baseContext,
        step,
        currentBalance: walletSummary.balance,
        allowanceRemaining: allowance?.remainingThisPeriod || 0,
        requiredCredits,
        availableCredits,
      }, 'Insufficient allowance or credits');
      return { ok: false, reason: 'insufficient_credits', enqueuedJobs: 0 };
    }

    // 3) Short transaction: only update campaign status (fast, no heavy work)
    step = 'claim_status';
    logger.info({ ...baseContext, step }, 'Attempting to claim campaign send lock');
    const txResult = await prisma.$transaction(async (tx) => {
      // Double-check status hasn't changed (optimistic locking)
      const currentCamp = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true, ownerId: true },
      });

      if (!currentCamp) {
        return { ok: false, reason: 'not_found' };
      }

      if (!['draft', 'scheduled', 'paused'].includes(currentCamp.status)) {
        return { ok: false, reason: `invalid_status:${currentCamp.status}` };
      }

      // Update status atomically
      const upd = await tx.campaign.updateMany({
        where: {
          AND: [
            { id: campaignId },
            {
              OR: [
                { status: 'draft' },
                { status: 'scheduled' },
                { status: 'paused' },
              ],
            },
          ],
        },
        data: { status: 'sending', startedAt: new Date() },
      });

      if (upd.count === 0) {
        return { ok: false, reason: 'already_sending' };
      }

      return { ok: true };
    }, {
      timeout: 5000, // 5 second timeout (should be fast now)
      maxWait: 5000,
    });

    if (!txResult.ok) {
      logger.warn({ ...baseContext, step, reason: txResult.reason }, 'Campaign send lock not acquired');
      return { ...txResult, enqueuedJobs: 0 };
    }

    logger.info({ ...baseContext, step }, 'Campaign send lock acquired');

    // 3) Create messages and set totals (short transaction, no heavy work)
    // Note: Credits are NOT debited here - they will be debited per message after successful send
    step = 'create_messages';
    const ownerId = camp.ownerId;
    // Use messageText (required field, no template association)
    const messageTemplate = camp.messageText;

    if (!messageTemplate || !messageTemplate.trim()) {
      logger.error({ ...baseContext, step }, 'Campaign has no message text');
      await prisma.campaign.updateMany({
        where: { id: camp.id, ownerId },
        data: { status: 'failed', finishedAt: new Date() },
      });
      return { ok: false, reason: 'no_message_text', enqueuedJobs: 0 };
    }

    logger.info({ ...baseContext, step, contactCount: contacts.length }, '[ENQUEUE] Generating messages with tracking IDs and links');

    // Generate messages with offer and unsubscribe links appended
    const messagesData = await Promise.all(contacts.map(async (contact) => {
      // Render message template
      let messageText = render(messageTemplate, contact);

      // Shorten any URLs in the message text first
      messageText = await shortenUrlsInText(messageText, { ownerId, kind: 'message' });

      // Generate tracking ID for offer link (actual offer/unsubscribe links are appended at send time)
      const trackingId = newTrackingId();

      return {
        ownerId,
        campaignId: camp.id,
        contactId: contact.id,
        to: contact.phone,
        text: messageText,
        trackingId,
        status: 'queued',
      };
    }));

    let createdCount = 0;
    try {
      // For large campaigns (>10k messages), batch the createMany operation
      const BATCH_SIZE = 10000;
      const messageCount = messagesData.length;

      if (messageCount > BATCH_SIZE) {
        logger.info({ ...baseContext, step, messageCount }, 'Large campaign detected, using batched inserts');

        // Update campaign totals first
        await prisma.campaign.updateMany({
          where: { id: camp.id, ownerId },
          data: {
            total: contacts.length,
            sent: 0,
            failed: 0,
          },
        });

        // Batch create messages
        for (let i = 0; i < messagesData.length; i += BATCH_SIZE) {
          const batch = messagesData.slice(i, i + BATCH_SIZE);
          await prisma.campaignMessage.createMany({
            data: batch,
            skipDuplicates: true,
          });
          logger.debug({
            ...baseContext,
            step,
            batch: Math.floor(i / BATCH_SIZE) + 1,
            totalBatches: Math.ceil(messageCount / BATCH_SIZE),
          }, 'Batch inserted');
        }
        createdCount = messagesData.length;
      } else {
        // For smaller campaigns, use single transaction
        await prisma.$transaction([
          prisma.campaign.updateMany({
            where: { id: camp.id, ownerId },
            data: {
              total: contacts.length,
              sent: 0,
              failed: 0,
            },
          }),
          prisma.campaignMessage.createMany({
            data: messagesData,
            skipDuplicates: true,
          }),
        ], {
          timeout: 10000, // 10 seconds for bulk insert (should be fast)
          maxWait: 5000,
        });
        createdCount = messagesData.length;
      }

      // Ensure aggregates are updated after message creation (for consistency)
      try {
        const { updateCampaignAggregates } = require('./campaignAggregates.service');
        await updateCampaignAggregates(camp.id, ownerId);
      } catch (aggErr) {
        logger.warn({ ...baseContext, step, err: aggErr.message }, 'Failed to update campaign aggregates after message creation');
        // Don't fail the entire operation - aggregates can be recalculated later
      }
    } catch (e) {
      logger.error({
        ...baseContext,
        step,
        err: e.message,
        stack: e.stack,
        contactCount: contacts.length,
      }, 'Failed to create campaign messages');
      // Revert campaign status (no credits to refund since we don't debit upfront)
      await prisma.campaign.updateMany({
        where: { id: camp.id, ownerId },
        data: { status: 'draft', startedAt: null },
      });
      throw e;
    }

    logger.info({
      ...baseContext,
      step,
      createdMessages: messagesData.length,
      createdCount,
      statusBefore: initialStatus,
    }, '[ENQUEUE] Messages created');

    // 5) Enqueue jobs to Redis (OUTSIDE transaction, non-blocking)
    step = 'enqueue_jobs';
    const toEnqueue = await prisma.campaignMessage.findMany({
      where: { ownerId, campaignId: camp.id, status: 'queued', providerMessageId: null },
      select: { id: true },
    });

    if (toEnqueue.length > 0) {
      step = 'reserve_credits';
      const { reserveCreditsForMessages } = require('./credit-reservation.service');
      try {
        const reservationResult = await reserveCreditsForMessages(
          camp.ownerId,
          toEnqueue.map((m) => m.id),
          { campaignId: camp.id, reason: 'campaign:enqueue' },
        );
        logger.info({
          ...baseContext,
          step,
          reserved: reservationResult.reserved,
          reused: reservationResult.reused,
          total: reservationResult.total,
        }, 'Credits reserved for campaign messages');
      } catch (reserveErr) {
        logger.warn({ ...baseContext, step, err: reserveErr.message }, 'Failed to reserve credits for campaign');

        // Rollback campaign state if reservation fails
        await prisma.campaign.updateMany({
          where: { id: camp.id, ownerId },
          data: { status: initialStatus || 'draft', startedAt: null },
        });
        return { ok: false, reason: 'insufficient_credits', enqueuedJobs: 0 };
      }
    }

    // Unique run token per enqueue attempt to avoid jobId collisions blocking jobs
    // BullMQ forbids ":" in custom job ids; keep token URL-safe.
    const runToken = `run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    let enqueuedJobs = 0;
    if (toEnqueue.length > 0) {
      // Campaigns always use bulk SMS with fixed batch size
      // Mitto's bulk API can handle 1M+ messages, so we use a simple fixed batch size
      // This protects our infrastructure while keeping logic simple and predictable
      const BATCH_SIZE = Number(process.env.SMS_BATCH_SIZE || 5000);

      // Group messages into fixed-size batches
      const batches = [];
      for (let i = 0; i < toEnqueue.length; i += BATCH_SIZE) {
        batches.push(toEnqueue.slice(i, i + BATCH_SIZE).map(m => m.id));
      }

      const jobIds = batches.map((_b, idx) => `campaign-${camp.id}-${runToken}-batch-${idx}`);
      logger.info({
        ...baseContext,
        step,
        totalMessages: toEnqueue.length,
        batchCount: batches.length,
        batchSize: BATCH_SIZE,
        runToken,
        jobIds,
        queue: queueName,
      }, '[ENQUEUE JOBS] Adding bulk SMS batch jobs');

      // Enqueue batch jobs
      const enqueuePromises = batches.map((messageIds, batchIndex) => {
        const jobId = `campaign-${camp.id}-${runToken}-batch-${batchIndex}`;
        return smsQueue.add('sendBulkSMS', {
          campaignId: camp.id,
          ownerId: camp.ownerId,
          messageIds,
        }, {
          jobId,
          attempts: 1,
          removeOnComplete: true,
          backoff: { type: 'exponential', delay: 3000 },
        })
          .then(() => {
            enqueuedJobs += messageIds.length;
            logger.debug({ ...baseContext, step, batchIndex, messageCount: messageIds.length, jobId, queue: queueName }, 'Batch job enqueued');
          })
          .catch(err => {
            logger.error({ ...baseContext, step, batchIndex, jobId, queue: queueName, err: err.message }, 'Failed to enqueue batch job');
            // Continue even if some batches fail to enqueue
          });
      });

      // Wait for initial batches (first 10) to ensure some jobs are enqueued
      try {
        await Promise.all(enqueuePromises.slice(0, Math.min(10, enqueuePromises.length)));
      } catch (err) {
        logger.error({ ...baseContext, step, err: err.message }, 'Some batch jobs failed to enqueue initially');
      }

      // Continue enqueuing remaining batches in background (fire and forget)
      if (enqueuePromises.length > 10) {
        Promise.all(enqueuePromises.slice(10)).catch(err => {
          logger.error({ ...baseContext, step, err: err.message }, 'Some background batch jobs failed to enqueue');
        });
      }
    } else {
      logger.warn({ ...baseContext, step }, 'No queued messages found to enqueue');
    }

    if (enqueuedJobs === 0) {
      logger.error({ ...baseContext, step, queuedCount: toEnqueue.length }, 'No jobs enqueued for campaign');
      const rollbackData = { status: initialStatus || 'draft', startedAt: null, finishedAt: null, total: 0, sent: 0, failed: 0, processed: null };
      try {
        const { releaseReservationForMessage } = require('./credit-reservation.service');
        await Promise.all(
          toEnqueue.map((msg) => releaseReservationForMessage(ownerId, msg.id, { reason: 'enqueue_failed' }).catch(() => null)),
        );
        if (toEnqueue.length > 0) {
          const ids = toEnqueue.map((m) => m.id);
          await prisma.$transaction([
            prisma.campaignMessage.deleteMany({
              where: { id: { in: ids }, ownerId },
            }),
            prisma.campaign.updateMany({
              where: { id: camp.id, ownerId },
              data: rollbackData,
            }),
          ]);
        } else {
          await prisma.campaign.updateMany({
            where: { id: camp.id, ownerId },
            data: rollbackData,
          });
        }
      } catch (cleanupErr) {
        logger.error({ ...baseContext, step, err: cleanupErr.message, stack: cleanupErr.stack }, 'Failed to rollback after enqueue failure');
      }
      return { ok: false, reason: 'enqueue_failed', created: messagesData.length, enqueuedJobs: 0 };
    }

    step = 'finalize';
    logger.info({
      ...baseContext,
      step,
      created: messagesData.length,
      enqueuedJobs,
      queue: queueName,
    }, '[ENQUEUE DONE] Campaign enqueued successfully');

    return { ok: true, created: messagesData.length, enqueuedJobs, campaignId: camp.id, queueName };
  } catch (err) {
    const reason = err?.code === 'P2022' || err?.message?.includes('column') ? 'prisma_schema_drift' : 'enqueue_failed';
    logger.error({
      correlationId,
      campaignId,
      ownerId: camp?.ownerId,
      shopId: camp?.ownerId,
      step,
      source,
      err: err.message,
      stack: err.stack,
      reason,
    }, 'enqueueCampaign failed');
    return { ok: false, reason, error: err.message, enqueuedJobs: 0 };
  }
};
