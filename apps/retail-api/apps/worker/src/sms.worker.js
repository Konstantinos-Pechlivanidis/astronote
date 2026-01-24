// apps/worker/src/sms.worker.js
const loadEnv = require('../../api/src/config/loadEnv');
loadEnv();

const pino = require('pino');
const logger = pino({ name: 'sms-worker' });

if (process.env.QUEUE_DISABLED === '1') {
  logger.warn('Disabled via QUEUE_DISABLED=1');
  process.exit(0);
}

// Dependencies are resolved from apps/api/node_modules because worker runs with cwd=apps/api
const { Worker } = require('bullmq');
const { getRedisClient } = require('../../api/src/lib/redis');
const prisma = require('../../api/src/lib/prisma');
const { sendSingle } = require('../../api/src/services/mitto.service');
const { sendBulkSMSWithCredits } = require('../../api/src/services/smsBulk.service');
const { consumeMessageBilling, canSendOrSpendCredits } = require('../../api/src/services/subscription.service');
const { releaseReservationForMessage } = require('../../api/src/services/credit-reservation.service');
const { generateUnsubscribeToken } = require('../../api/src/services/token.service');
const { shortenUrlsInText, ShortenerError } = require('../../api/src/services/urlShortener.service');
const { buildOfferShortUrl, buildUnsubscribeShortUrl } = require('../../api/src/services/publicLinkBuilder.service');
const crypto = require('crypto');

const DEBUG_SEND = process.env.SMS_SEND_DEBUG === '1';

function formatRedisInfo(connection) {
  if (!connection) return {};
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

async function finalizeMessageText(text, { offerUrl, unsubscribeUrl, ctx = null }) {
  let output = text || '';
  try {
    if (DEBUG_SEND) {
      logger.info(
        {
          tag: 'SHORTEN_START',
          kind: 'message',
          jobId: ctx?.jobId,
          attempt: ctx?.attempt,
          campaignId: ctx?.campaignId,
          ownerId: ctx?.ownerId,
          messageId: ctx?.messageId,
        },
        'SHORTEN_START',
      );
    }
    output = await shortenUrlsInText(output, {
      ownerId: ctx?.ownerId || null,
      kind: 'message',
    });
  } catch (e) {
    if (DEBUG_SEND) {
      logger.warn(
        {
          tag: 'SHORTEN_FAIL',
          kind: 'message',
          jobId: ctx?.jobId,
          attempt: ctx?.attempt,
          campaignId: ctx?.campaignId,
          ownerId: ctx?.ownerId,
          messageId: ctx?.messageId,
          err: e?.message || String(e),
        },
        'SHORTEN_FAIL',
      );
    }
    logger.warn({ err: e?.message || String(e) }, 'SHORTEN_FAIL (pre-send) — continuing with unshortened message');
    output = text || '';
  }

  // Remove any existing offer/unsubscribe blocks or short URLs
  const linePatterns = [
    /^ *(view|claim) offer:.*$/gim,
    /^ *to unsubscribe.*$/gim,
  ];
  const urlPatterns = [
    /https?:\/\/\S*\/o\/[^\s]+/gi,
    /https?:\/\/\S*\/retail\/o\/[^\s]+/gi,
    /https?:\/\/\S*\/tracking\/offer\/[^\s]+/gi,
    /https?:\/\/\S*\/s\/[^\s]+/gi,
    /https?:\/\/\S*\/retail\/s\/[^\s]+/gi,
    /https?:\/\/\S*\/unsubscribe\/[^\s]+/gi
  ];

  [...linePatterns, ...urlPatterns].forEach((pattern) => {
    output = output.replace(pattern, '');
  });

  // Clean up excessive blank lines after removal
  output = output.replace(/\n{3,}/g, '\n\n').trim();

  const appended = [];

  const safeOfferUrl = offerUrl || null;
  const safeUnsubUrl = unsubscribeUrl || null;

  if (safeOfferUrl) {
    appended.push(`Claim Offer: ${safeOfferUrl}`);
  }
  if (safeUnsubUrl) {
    appended.push(`To unsubscribe, tap: ${safeUnsubUrl}`);
  }

  if (appended.length) {
    output = `${output}\n\n${appended.join('\n\n')}`;
  }

  output = output.replace(/\n{3,}/g, '\n\n').trim();
  const appendedLinks = {
    offer: Boolean(safeOfferUrl),
    unsubscribe: Boolean(safeUnsubUrl),
  };
  if (DEBUG_SEND) {
    logger.info(
      {
        tag: 'FINALIZE_LINKS',
        jobId: ctx?.jobId,
        attempt: ctx?.attempt,
        campaignId: ctx?.campaignId,
        ownerId: ctx?.ownerId,
        messageId: ctx?.messageId,
        appendedLinks,
      },
      'FINALIZE_LINKS',
    );
  }
  return { text: output, appended: appendedLinks };
}

const connection = getRedisClient();

if (!connection) {
  logger.warn('Redis client could not be created, SMS worker disabled');
  process.exit(0);
}

// With lazyConnect: true, Redis connects on first command
// BullMQ will handle the connection, so we don't need to wait for 'ready' here
// Just ensure we have a client instance
logger.info({ queue: 'smsQueue', redis: formatRedisInfo(connection) }, 'Starting SMS worker (Redis will connect on first use)...');

// Log DB target (sanitized) to ensure worker and API share the same DB
try {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl) {
    const parsed = new URL(dbUrl);
    const dbInfo = {
      host: parsed.hostname,
      port: parsed.port,
      database: parsed.pathname.replace(/^\//, '') || 'unknown',
      hash: crypto.createHash('sha256').update(dbUrl).digest('hex').slice(0, 8),
    };
    logger.info({ db: dbInfo }, '[DB] Worker using database');
  } else {
    logger.warn('[DB] DATABASE_URL not set for worker');
  }
} catch (err) {
  logger.warn({ err: err.message }, '[DB] Worker failed to parse DATABASE_URL');
}

const concurrency = Number(process.env.WORKER_CONCURRENCY || 5);
const CLAIM_STALE_MINUTES = Number(process.env.SEND_CLAIM_STALE_MINUTES || 15);

function isRetryable(err) {
  // Check for rate limit errors from our rate limiter (Phase 2.1)
  if (err?.reason === 'rate_limit_exceeded' || 
      err?.message?.includes('rate limit exceeded')) {
    return true; // Retryable - transient condition
  }
  
  const status = err?.status;
  if (!status) return true;      // network/timeout
  if (status >= 500) return true; // provider/server error
  if (status === 429) return true; // rate limited (HTTP 429)
  return false;                    // 4xx hard fail
}

async function renderMessageWithLinks(msg, jobCtx = {}) {
  if (!msg?.campaign || !msg?.contact) {
    throw new ShortenerError('Missing campaign or contact for message rendering', { messageId: msg?.id });
  }
  if (!msg.campaign.ownerId) {
    throw new ShortenerError('Missing ownerId for message rendering', { messageId: msg?.id });
  }

  const unsubscribeToken = generateUnsubscribeToken(msg.contact.id, msg.campaign.ownerId, msg.campaign.id);
  const unsubscribe = await buildUnsubscribeShortUrl({
    token: unsubscribeToken,
    ownerId: msg.campaign.ownerId,
    campaignId: msg.campaign.id,
    campaignMessageId: msg.id,
  });

  const offer = msg.trackingId
    ? await buildOfferShortUrl({
      trackingId: msg.trackingId,
      ownerId: msg.campaign.ownerId,
      campaignId: msg.campaign.id,
      campaignMessageId: msg.id,
    })
    : null;

  const { text, appended } = await finalizeMessageText(msg.text, {
    offerUrl: offer?.shortUrl || null,
    unsubscribeUrl: unsubscribe?.shortUrl || null,
    ctx: {
      ...jobCtx,
      messageId: msg.id,
      campaignId: msg.campaign.id,
      ownerId: msg.campaign.ownerId,
    },
  });

  return {
    text,
    appended,
    shortLinks: {
      offer: offer?.shortUrl || null,
      unsubscribe: unsubscribe?.shortUrl || null,
    },
    targets: {
      offer: offer?.longUrl || null,
      unsubscribe: unsubscribe?.longUrl || null,
    },
  };
}

async function markShortenerFailure(messageId, ownerId, campaignId, err) {
  const message = err?.message || 'Short link generation failed';
  const errorCode = err?.code || 'SHORTENER_FAILED';
  try {
    await prisma.campaignMessage.update({
      where: { id: messageId },
      data: {
        status: 'failed',
        failedAt: new Date(),
        error: `${errorCode}:${message}`,
        sendClaimedAt: null,
        sendClaimToken: null,
      },
    });
  } catch (updateErr) {
    logger.warn({ messageId, err: updateErr?.message }, 'Failed to mark message as failed after shortener error');
  }
  logger.error({ messageId, ownerId, campaignId, err: message }, 'Shortener failure — message not sent');
}

const worker = new Worker(
  'smsQueue',
  async (job) => {
    logger.info({
      jobId: job.id,
      jobName: job.name,
      campaignId: job.data?.campaignId,
      ownerId: job.data?.ownerId,
      messageCount: Array.isArray(job.data?.messageIds) ? job.data.messageIds.length : null,
      attemptsMade: job.attemptsMade,
      attempts: job.opts?.attempts
    }, 'Job started');

    // Campaigns always use bulk SMS (sendBulkSMS job type)
    // Individual jobs (sendSMS) are only for automations and test messages
    if (job.name === 'sendBulkSMS') {
      // Process campaign batch job
      const { campaignId, ownerId, messageIds } = job.data;
      
      if (!campaignId || !ownerId || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        logger.error({ jobId: job.id, data: job.data }, 'Invalid batch job data');
        return;
      }

      await processBatchJob(campaignId, ownerId, messageIds, job);
    } else if (job.name === 'sendSMS') {
      // Process individual job (for automations and test messages only)
    const { messageId } = job.data;
      await processIndividualJob(messageId, job);
    } else {
      logger.warn({ jobId: job.id, jobName: job.name }, 'Unknown job type, skipping');
    }
  },
  { connection, concurrency }
);

/**
 * Process individual message job (legacy)
 */
async function processIndividualJob(messageId, job) {
    const msg = await prisma.campaignMessage.findUnique({
      where: { id: messageId },
      include: {
        campaign: { select: { id: true, ownerId: true, createdById: true } },
        contact:  { select: { id: true, phone: true, unsubscribeTokenHash: true } }
      }
    });
    if (!msg) return;

    let providerId = null;
    try {
      if (DEBUG_SEND) {
        logger.info(
          {
            tag: 'PRE_SEND',
            kind: 'single',
            jobId: job.id,
            attempt: job.attemptsMade || 0,
            campaignId: msg.campaign.id,
            ownerId: msg.campaign.ownerId,
            messageId: msg.id,
            providerCalled: false,
          },
          'PRE_SEND',
        );
      }
      const subscriptionGate = await canSendOrSpendCredits(msg.campaign.ownerId);
      if (!subscriptionGate.allowed) {
        await releaseReservationForMessage(msg.campaign.ownerId, msg.id, {
          reason: 'inactive_subscription',
        }).catch(() => null);
        await prisma.campaignMessage.update({
          where: { id: msg.id },
          data: {
            failedAt: new Date(),
            status: 'failed',
            error: subscriptionGate.message || 'Active subscription required to send SMS',
            billingStatus: 'failed',
            billingError: 'SUBSCRIPTION_REQUIRED',
          }
        });
        logger.warn({ messageId: msg.id, ownerId: msg.campaign.ownerId }, 'Inactive subscription - individual SMS blocked');
        return;
      }

      let finalText = msg.text || '';
      try {
        const rendered = await renderMessageWithLinks(msg, {
          jobId: job.id,
          attempt: job.attemptsMade || 0,
        });
        finalText = rendered.text;
      } catch (linkErr) {
        await markShortenerFailure(msg.id, msg.campaign.ownerId, msg.campaign.id, linkErr);
        return;
      }

      if (DEBUG_SEND) {
        logger.info(
          {
            tag: 'PRE_SEND',
            kind: 'provider',
            jobId: job.id,
            attempt: job.attemptsMade || 0,
            campaignId: msg.campaign.id,
            ownerId: msg.campaign.ownerId,
            messageId: msg.id,
            providerCalled: true,
          },
          'PRE_SEND',
        );
      }
      const resp = await sendSingle({
        userId: msg.campaign.createdById,
        destination: msg.to,
        text: finalText
      });

      // Response format: { messageId, trafficAccountId, rawResponse }
      providerId = resp?.messageId || null;
      if (DEBUG_SEND) {
        logger.info(
          {
            tag: 'POST_SEND',
            jobId: job.id,
            attempt: job.attemptsMade || 0,
            campaignId: msg.campaign.id,
            ownerId: msg.campaign.ownerId,
            messageId: msg.id,
            providerCalled: true,
            providerId,
          },
          'POST_SEND',
        );
      }

      if (!providerId) {
        await releaseReservationForMessage(msg.campaign.ownerId, msg.id, {
          reason: 'send_failed',
        }).catch(() => null);
        await prisma.campaignMessage.update({
          where: { id: msg.id },
          data: {
            failedAt: new Date(),
            status: 'failed',
            error: 'Provider did not return messageId',
            billingStatus: 'failed',
            billingError: 'NO_PROVIDER_MESSAGE_ID',
          },
        });
        logger.warn({ messageId: msg.id, ownerId: msg.campaign.ownerId }, 'Provider did not return messageId; message marked failed');
        return;
      }

      let billingStatus = null;
      let billingError = null;
      let billedAt = null;

      // Only consume allowance/credits AFTER successful send (when we have messageId)
      if (providerId) {
        try {
          const billingResult = await consumeMessageBilling(msg.campaign.ownerId, 1, {
            reason: `sms:send:campaign:${msg.campaign.id}`,
            campaignId: msg.campaign.id,
            messageId: msg.id,
            meta: { providerMessageId: providerId }
          });
          billingStatus = billingResult.billingStatus || 'paid';
          billedAt = billingResult.billedAt || new Date();
          logger.debug({
            messageId: msg.id,
            ownerId: msg.campaign.ownerId,
            usedAllowance: billingResult.usedAllowance,
            debitedCredits: billingResult.debitedCredits,
          }, 'Billing applied after successful send');
        } catch (billingErr) {
          // Log error but don't fail the message - it was already sent
          billingStatus = 'failed';
          billingError = billingErr.message;
          logger.error({
            messageId: msg.id,
            ownerId: msg.campaign.ownerId,
            err: billingErr.message
          }, 'Failed to bill after successful send');
        }
      }

      await prisma.campaignMessage.update({
        where: { id: msg.id },
        data: {
          providerMessageId: providerId,
          sentAt: new Date(),
          status: 'sent',
          billingStatus: billingStatus || undefined,
          billingError: billingError || null,
          billedAt: billedAt || undefined,
        }
      });
      if (DEBUG_SEND) {
        logger.info(
          {
            tag: 'POST_PERSIST',
            jobId: job.id,
            attempt: job.attemptsMade || 0,
            campaignId: msg.campaign.id,
            ownerId: msg.campaign.ownerId,
            messageId: msg.id,
            ok: true,
            providerId,
          },
          'POST_PERSIST',
        );
      }

      // Update campaign aggregates (non-blocking)
      try {
        const { updateCampaignAggregates } = require('../../api/src/services/campaignAggregates.service');
        await updateCampaignAggregates(msg.campaign.id, msg.campaign.ownerId);
      } catch (aggErr) {
        logger.warn({ campaignId: msg.campaign.id, err: aggErr.message }, 'Failed to update campaign aggregates');
      }
    } catch (e) {
      const retryable = isRetryable(e);
      // If provider was already called and returned a providerMessageId, never throw to retry.
      // Retrying would resend. Best-effort: log and exit.
      if (typeof providerId !== 'undefined' && providerId) {
        if (DEBUG_SEND) {
          logger.error(
            {
              tag: 'POST_PERSIST',
              jobId: job.id,
              attempt: job.attemptsMade || 0,
              campaignId: msg.campaign.id,
              ownerId: msg.campaign.ownerId,
              messageId: msg.id,
              ok: false,
              providerCalled: true,
              providerId,
              err: e?.message || String(e),
            },
            'POST_PERSIST',
          );
        }
        logger.error({
          messageId: msg.id,
          campaignId: msg.campaign.id,
          ownerId: msg.campaign.ownerId,
          providerMessageId: providerId,
          err: e.message
        }, '[NO-RETRY] Individual SMS failed after provider send; skipping retry to prevent duplicate send');
        return;
      }
      logger.warn({ 
        messageId: msg.id, 
        campaignId: msg.campaign.id, 
        retryable, 
        err: e.message 
      }, 'SMS send failed');

      await prisma.campaignMessage.update({
        where: { id: msg.id },
        data: {
          failedAt: retryable ? null : new Date(),
          status: retryable ? 'queued' : 'failed',
          error: e.message
        }
      });

      if (!retryable) {
        await releaseReservationForMessage(msg.campaign.ownerId, msg.id, {
          reason: 'send_failed',
        }).catch(() => null);
      }

      // Update campaign aggregates for failed message (non-blocking)
      try {
        const { updateCampaignAggregates } = require('../../api/src/services/campaignAggregates.service');
        await updateCampaignAggregates(msg.campaign.id, msg.campaign.ownerId);
      } catch (aggErr) {
        logger.warn({ campaignId: msg.campaign.id, err: aggErr.message }, 'Failed to update campaign aggregates');
      }

      if (retryable) throw e;
    }
}

/**
 * Process batch job (new bulk sending)
 */
async function processBatchJob(campaignId, ownerId, messageIds, job) {
  const claimToken = `job:${job.id}`;
  let providerSucceeded = false;
  try {

    // Reuse existing claims for retries
    let claimedMessages = await prisma.campaignMessage.findMany({
      where: {
        id: { in: messageIds },
        ownerId,
        sendClaimToken: claimToken
      },
      include: {
        campaign: { select: { id: true, ownerId: true, createdById: true } },
        contact: { select: { id: true, phone: true } }
      }
    });

    // Claim unclaimed queued messages
    if (!claimedMessages.length) {
      const claimed = await prisma.campaignMessage.updateMany({
        where: {
          id: { in: messageIds },
          ownerId,
          campaignId,
          status: 'queued',
          sendClaimedAt: null
        },
        data: {
          status: 'processing',
          sendClaimedAt: new Date(),
          sendClaimToken: claimToken
        }
      });

      if (claimed.count > 0) {
        claimedMessages = await prisma.campaignMessage.findMany({
          where: {
            id: { in: messageIds },
            ownerId,
            sendClaimToken: claimToken,
            providerMessageId: null
          },
          include: {
            campaign: { select: { id: true, ownerId: true, createdById: true } },
            contact: { select: { id: true, phone: true } }
          }
        });
      }
    }

    const requested = messageIds.length;
    const claimedCount = claimedMessages.length;

    // Filter out messages already accepted to avoid duplicate sends on retries
    const unsentMessages = claimedMessages.filter((m) => !m.providerMessageId);
    const alreadyAccepted = claimedMessages.length - unsentMessages.length;

    logger.info({
      campaignId,
      ownerId,
      jobId: job.id,
      requestedCount: requested,
      claimedCount,
      alreadyAccepted,
      toSendCount: unsentMessages.length
    }, 'Message claim result');

    if (claimedCount === 0 || unsentMessages.length === 0) {
      logger.info({ campaignId, ownerId, jobId: job.id }, 'No messages to send in batch; skipping send');
      return;
    }

    const startTime = Date.now();
    logger.info({ 
      campaignId, 
      ownerId, 
      batchSize: claimedMessages.length,
      requestedCount: messageIds.length,
      jobId: job.id,
      retryAttempt: job.attemptsMade || 0
    }, 'Processing batch job');

    if (DEBUG_SEND) {
      logger.info(
        {
          tag: 'PRE_SEND',
          kind: 'bulk',
          campaignId,
          ownerId,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          providerCalled: false,
          toSendCount: unsentMessages.length,
        },
        'PRE_SEND',
      );
    }

    const bulkMessages = [];
    const shortenerFailures = [];

    for (const msg of unsentMessages) {
      try {
        const rendered = await renderMessageWithLinks(msg, {
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          campaignId,
          ownerId,
        });

        bulkMessages.push({
          ownerId: msg.campaign.ownerId,
          destination: msg.to,
          text: rendered.text,
          contactId: msg.contact.id,
          createdById: msg.campaign.createdById,
          internalMessageId: msg.id,
          meta: {
            reason: `sms:send:campaign:${msg.campaign.id}`,
            campaignId: msg.campaign.id,
            messageId: msg.id
          }
        });
      } catch (err) {
        logger.error({
          campaignId,
          ownerId,
          messageId: msg.id,
          err: err?.message || String(err),
        }, 'Short link generation failed for message in batch');
        shortenerFailures.push({ id: msg.id, err });
      }
    }

    if (shortenerFailures.length) {
      await prisma.campaignMessage.updateMany({
        where: { id: { in: shortenerFailures.map(s => s.id) } },
        data: {
          status: 'failed',
          failedAt: new Date(),
          error: 'SHORTENER_FAILED',
          sendClaimedAt: null,
          sendClaimToken: null,
        },
      });
      logger.error({
        campaignId,
        ownerId,
        failedCount: shortenerFailures.length,
      }, 'Short link generation failed for some messages in batch');
    }

    if (!bulkMessages.length) {
      logger.warn({ campaignId, ownerId, jobId: job.id }, 'No messages to send after shortener failures');
      return;
    }

    if (DEBUG_SEND) {
      logger.info(
        {
          tag: 'PRE_SEND',
          kind: 'provider',
          campaignId,
          ownerId,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          providerCalled: true,
          sendCount: bulkMessages.length,
        },
        'PRE_SEND',
      );
    }

    let result;
    try {
      result = await sendBulkSMSWithCredits(bulkMessages);
      providerSucceeded = true;
    } catch (providerErr) {
      logger.error(
        {
          campaignId,
          ownerId,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          err: providerErr?.message || String(providerErr),
        },
        'Provider bulk send failed (pre-success) — allowing retry',
      );
      throw providerErr;
    }

    if (DEBUG_SEND) {
      logger.info(
        {
          tag: 'POST_SEND',
          campaignId,
          ownerId,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          providerCalled: true,
          bulkId: result.bulkId,
          sentCount: (result.results || []).filter(r => r.sent && r.messageId).length,
          failedCount: (result.results || []).filter(r => !r.sent).length,
        },
        'POST_SEND',
      );
    }

    if (process.env.DEBUG_SEND_LOGS === '1') {
      logger.info({
        debug: true,
        campaignId,
        ownerId,
        jobId: job.id,
        bulkId: result.bulkId,
        requestedIds: messageIds.slice(0, 10),
        resultSample: result.results?.slice(0, 10)
      }, '[DEBUG] Worker bulk result');
    }

    // Update messages with results
    const updatePromises = [];
    const successfulIds = [];
    const failedIds = [];

    for (const res of result.results) {
      const updateData = {};

      if (!res.internalMessageId) {
        logger.error({ campaignId, ownerId, jobId: job.id, res }, 'Result missing internalMessageId, skipping update');
        continue;
      }

      if (res.sent && res.messageId) {
        updateData.providerMessageId = res.messageId;
        updateData.bulkId = result.bulkId;
        updateData.acceptedAt = new Date();
        updateData.sentAt = new Date();
        updateData.status = 'sent';
        updateData.error = null;
        updateData.sendClaimedAt = null;
        updateData.sendClaimToken = null;
        updateData.billingStatus = res.billingStatus || 'pending';
        updateData.billingError = res.billingError || null;
        if (res.billedAt) {
          updateData.billedAt = res.billedAt;
        }
        successfulIds.push(res.internalMessageId);
      } else {
        updateData.status = 'failed';
        updateData.failedAt = new Date();
        updateData.error = res.error || res.reason || 'Send failed';
        updateData.sendClaimedAt = null;
        updateData.sendClaimToken = null;
        updateData.billingStatus = res.billingStatus || 'failed';
        updateData.billingError = res.billingError || updateData.error;
        failedIds.push(res.internalMessageId);
      }

      updatePromises.push(
        prisma.campaignMessage.update({
          where: { id: res.internalMessageId },
          data: updateData
        })
      );
    }

    await Promise.all(updatePromises);
    if (DEBUG_SEND) {
      logger.info(
        {
          tag: 'POST_PERSIST',
          campaignId,
          ownerId,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          ok: true,
          bulkId: result.bulkId,
          successfulCount: successfulIds.length,
          failedCount: failedIds.length,
        },
        'POST_PERSIST',
      );
    }

    // Debug: read back statuses for this batch to ensure they moved out of queued/processing
    try {
      const postStatuses = await prisma.campaignMessage.findMany({
        where: { id: { in: messageIds } },
        select: { id: true, status: true, providerMessageId: true, sentAt: true, deliveryStatus: true }
      });
      logger.info({
        campaignId,
        ownerId,
        jobId: job.id,
        postStatuses
      }, '[BATCH STATUS] Post-send message states');
    } catch (readErr) {
      logger.warn({ campaignId, ownerId, jobId: job.id, err: readErr.message }, 'Failed to read back post-send statuses');
    }

    const duration = Date.now() - startTime;
    logger.info({ 
      campaignId, 
      ownerId, 
      bulkId: result.bulkId,
      successful: successfulIds.length,
      failed: failedIds.length,
      total: result.results.length,
      duration,
      jobId: job.id,
      retryAttempt: job.attemptsMade || 0
    }, '[MITTO BULK] Batch job completed');

    // Update campaign aggregates (non-blocking)
    try {
      const { updateCampaignAggregates } = require('../../api/src/services/campaignAggregates.service');
      await updateCampaignAggregates(campaignId, ownerId);
    } catch (aggErr) {
      logger.warn({ campaignId, err: aggErr.message }, 'Failed to update campaign aggregates');
    }

    // If there were failures, log them but don't throw (partial success is acceptable)
    if (failedIds.length > 0) {
      logger.warn({ 
        campaignId, 
        failedCount: failedIds.length,
        failedIds: failedIds.slice(0, 10) // Log first 10 failed IDs
      }, 'Some messages in batch failed');
    }

  } catch (e) {
    const retryable = isRetryable(e);
    logger.error({ 
      campaignId, 
      ownerId, 
      messageIds,
      retryable, 
      err: e.message 
    }, providerSucceeded ? '[NO-RETRY] Batch job failed after provider call' : 'Batch job failed');

    // Mark all messages in batch based on retryability/provider call
    if (retryable && !providerSucceeded) {
      // Reset to queued so they can be re-claimed on retry
      await prisma.campaignMessage.updateMany({
        where: {
          id: { in: messageIds },
          campaignId,
          ownerId,
          sendClaimToken: claimToken
        },
        data: {
          status: 'queued',
          sendClaimedAt: null,
          sendClaimToken: null,
          error: e.message,
          retryCount: { increment: 1 }
        }
      });
    } else {
      // Do not leave processing hanging; guard against overriding accepted messages
      await prisma.campaignMessage.updateMany({
        where: {
          id: { in: messageIds },
          campaignId,
          ownerId,
          sendClaimToken: claimToken,
          status: 'processing',
          providerMessageId: null
        },
        data: {
          status: 'failed',
          failedAt: new Date(),
          sendClaimedAt: null,
          sendClaimToken: null,
          error: e.message,
          retryCount: { increment: 1 }
        }
      });
    }

    if (providerSucceeded && DEBUG_SEND) {
      logger.error(
        {
          tag: 'POST_PERSIST',
          campaignId,
          ownerId,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          ok: false,
          providerCalled: true,
          err: e?.message || String(e),
        },
        'POST_PERSIST',
      );
    }

    // Update campaign aggregates
    try {
      const { updateCampaignAggregates } = require('../../api/src/services/campaignAggregates.service');
      await updateCampaignAggregates(campaignId, ownerId);
    } catch (aggErr) {
      logger.warn({ campaignId, err: aggErr.message }, 'Failed to update campaign aggregates');
    }

    if (retryable && !providerSucceeded) throw e;
  }
}

worker.on('ready', () => {
  logger.info('Ready and listening for jobs');
});

worker.on('active', (job) => {
  if (job.name === 'sendBulkSMS') {
    logger.info({ jobId: job.id, campaignId: job.data.campaignId, messageCount: job.data.messageIds?.length }, `Processing ${job.name}`);
  } else {
  logger.info({ jobId: job.id, messageId: job.data.messageId }, `Processing ${job.name}`);
  }
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, name: job.name }, `Completed ${job.name}`);
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, name: job?.name, attemptsMade: job?.attemptsMade, attempts: job?.opts?.attempts, err: err?.message }, `Failed ${job?.name}`);
});

worker.on('error', (err) => {
  logger.error({ err: err.message }, 'Worker error');
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
