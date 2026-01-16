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
const { consumeMessageBilling, isSubscriptionActive } = require('../../api/src/services/subscription.service');
const { generateUnsubscribeToken } = require('../../api/src/services/token.service');
const { shortenUrl, shortenUrlsInText } = require('../../api/src/services/urlShortener.service');
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

// Normalize base URL (remove trailing slash)
function normalizeBase(url) {
  if (!url) return '';
  return url.trim().replace(/\/$/, '');
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

async function getCache(key) {
  try {
    return await connection.get(key);
  } catch (e) {
    return null;
  }
}

async function setCacheEx(key, seconds, value) {
  try {
    await connection.set(key, String(value), 'EX', Number(seconds));
    return true;
  } catch (e) {
    return false;
  }
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
    output = await shortenUrlsInText(output);
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
    /^ *view offer:.*$/gim,
    /^ *to unsubscribe.*$/gim,
  ];
  const urlPatterns = [
    /https?:\/\/\S*\/o\/[^\s]+/gi,
    /https?:\/\/\S*\/retail\/o\/[^\s]+/gi,
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
    appended.push(`View offer: ${safeOfferUrl}`);
  }
  if (safeUnsubUrl) {
    appended.push(`To unsubscribe, tap: ${safeUnsubUrl}`);
  }

  if (appended.length) {
    output = `${output}\n\n${appended.join('\n\n')}`;
  }

  output = output.replace(/\n{3,}/g, '\n\n').trim();
  return output;
}

// Base URL for public retail links
const PUBLIC_RETAIL_BASE_URL = normalizeBase(
  process.env.PUBLIC_RETAIL_BASE_URL ||
  process.env.PUBLIC_WEB_BASE_URL ||
  process.env.FRONTEND_URL ||
  'https://astronote-retail-frontend.onrender.com'
);

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
      const subscriptionActive = await isSubscriptionActive(msg.campaign.ownerId);
      if (!subscriptionActive) {
        await prisma.campaignMessage.update({
          where: { id: msg.id },
          data: {
            failedAt: new Date(),
            status: 'failed',
            error: 'Active subscription required to send SMS',
            billingStatus: 'failed',
            billingError: 'SUBSCRIPTION_REQUIRED',
          }
        });
        logger.warn({ messageId: msg.id, ownerId: msg.campaign.ownerId }, 'Inactive subscription - individual SMS blocked');
        return;
      }

      // Ensure unsubscribe link and offer link are present (safety check - should already be added in enqueue)
      let finalText = msg.text || '';
      try {
        if (DEBUG_SEND) {
          logger.info(
            {
              tag: 'SHORTEN_START',
              kind: 'message',
              jobId: job.id,
              attempt: job.attemptsMade || 0,
              campaignId: msg.campaign.id,
              ownerId: msg.campaign.ownerId,
              messageId: msg.id,
            },
            'SHORTEN_START',
          );
        }
        finalText = await shortenUrlsInText(finalText); // Shorten any URLs in message
      } catch (e) {
        if (DEBUG_SEND) {
          logger.warn(
            {
              tag: 'SHORTEN_FAIL',
              kind: 'message',
              jobId: job.id,
              attempt: job.attemptsMade || 0,
              campaignId: msg.campaign.id,
              ownerId: msg.campaign.ownerId,
              messageId: msg.id,
              err: e?.message || String(e),
            },
            'SHORTEN_FAIL',
          );
        }
        logger.warn({ messageId: msg.id, err: e?.message || String(e) }, 'SHORTEN_FAIL (pre-send) — continuing with unshortened message');
        finalText = msg.text || '';
      }
      let needsUnsubscribeLink = !finalText.includes('/unsubscribe/');
      let needsOfferLink = !finalText.includes('/o/');

      if (needsUnsubscribeLink) {
        // Generate unsubscribe token if not present
        try {
          const unsubscribeToken = generateUnsubscribeToken(msg.contact.id, msg.campaign.ownerId, msg.campaign.id);
          const unsubscribeUrl = `${UNSUBSCRIBE_BASE_URL}/unsubscribe/${unsubscribeToken}`;
          const ttlSeconds = Number(process.env.UNSUBSCRIBE_SHORT_CACHE_TTL_SECONDS || 30 * 24 * 60 * 60);
          const cacheKey = `unsubscribe:short:${msg.campaign.ownerId || 'na'}:${sha256Hex(unsubscribeUrl).slice(0, 16)}`;
          let shortenedUnsubscribeUrl = await getCache(cacheKey);
          if (!shortenedUnsubscribeUrl) {
            try {
              if (DEBUG_SEND) {
                logger.info(
                  {
                    tag: 'SHORTEN_START',
                    kind: 'unsubscribe',
                    jobId: job.id,
                    attempt: job.attemptsMade || 0,
                    campaignId: msg.campaign.id,
                    ownerId: msg.campaign.ownerId,
                    messageId: msg.id,
                  },
                  'SHORTEN_START',
                );
              }
              shortenedUnsubscribeUrl = await shortenUrl(unsubscribeUrl);
              await setCacheEx(cacheKey, ttlSeconds, shortenedUnsubscribeUrl);
            } catch (shortErr) {
              if (DEBUG_SEND) {
                logger.warn(
                  {
                    tag: 'SHORTEN_FAIL',
                    kind: 'unsubscribe',
                    jobId: job.id,
                    attempt: job.attemptsMade || 0,
                    campaignId: msg.campaign.id,
                    ownerId: msg.campaign.ownerId,
                    messageId: msg.id,
                    err: shortErr?.message || String(shortErr),
                  },
                  'SHORTEN_FAIL',
                );
              }
              logger.warn({ messageId: msg.id, err: shortErr?.message || String(shortErr) }, 'SHORTEN_FAIL (unsubscribe) — continuing with long URL');
              shortenedUnsubscribeUrl = unsubscribeUrl;
            }
          }
          finalText += `\n\nTo unsubscribe, tap: ${shortenedUnsubscribeUrl}`;
          logger.warn({ messageId: msg.id }, 'Unsubscribe link was missing, appended before send');
        } catch (tokenErr) {
          logger.error({ messageId: msg.id, err: tokenErr.message }, 'Failed to generate unsubscribe token, sending without link');
          // Continue without unsubscribe link if token generation fails
        }
      }

      if (needsOfferLink && msg.trackingId) {
        // Generate offer link if not present (should already be there, but safety check)
        try {
          const baseOfferUrl = process.env.OFFER_BASE_URL || process.env.FRONTEND_URL || 'https://astronote-retail-frontend.onrender.com';
          const OFFER_BASE_URL = ensureRetailPath(baseOfferUrl);
          const offerUrl = `${OFFER_BASE_URL}/o/${msg.trackingId}`;
          let shortenedOfferUrl = offerUrl;
          try {
            if (DEBUG_SEND) {
              logger.info(
                {
                  tag: 'SHORTEN_START',
                  kind: 'offer',
                  jobId: job.id,
                  attempt: job.attemptsMade || 0,
                  campaignId: msg.campaign.id,
                  ownerId: msg.campaign.ownerId,
                  messageId: msg.id,
                },
                'SHORTEN_START',
              );
            }
            shortenedOfferUrl = await shortenUrl(offerUrl);
          } catch (shortErr) {
            if (DEBUG_SEND) {
              logger.warn(
                {
                  tag: 'SHORTEN_FAIL',
                  kind: 'offer',
                  jobId: job.id,
                  attempt: job.attemptsMade || 0,
                  campaignId: msg.campaign.id,
                  ownerId: msg.campaign.ownerId,
                  messageId: msg.id,
                  err: shortErr?.message || String(shortErr),
                },
                'SHORTEN_FAIL',
              );
            }
            logger.warn({ messageId: msg.id, err: shortErr?.message || String(shortErr) }, 'SHORTEN_FAIL (offer) — continuing with long URL');
            shortenedOfferUrl = offerUrl;
          }
          finalText += `\n\nView offer: ${shortenedOfferUrl}`;
          logger.warn({ messageId: msg.id }, 'Offer link was missing, appended before send');
        } catch (err) {
          logger.error({ messageId: msg.id, err: err.message }, 'Failed to append offer link');
          // Continue without offer link if generation fails
        }
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

      // No credit refund needed - credits are only debited after successful send
      // If send failed, no credits were debited, so nothing to refund

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

    // Prepare messages for bulk sending
    const bulkMessages = await Promise.all(unsentMessages.map(async (msg) => {
      // Finalize message text exactly once (remove duplicate links, append single offer/unsubscribe)
      const unsubscribeToken = generateUnsubscribeToken(msg.contact.id, msg.campaign.ownerId, msg.campaign.id);
      const unsubscribeUrl = `${PUBLIC_RETAIL_BASE_URL}/unsubscribe/${unsubscribeToken}`;
      const offerUrl = msg.trackingId ? `${PUBLIC_RETAIL_BASE_URL}/o/${msg.trackingId}` : null;

      // Unsubscribe shortening: best-effort with cache; must never throw
      const ttlSeconds = Number(process.env.UNSUBSCRIBE_SHORT_CACHE_TTL_SECONDS || 30 * 24 * 60 * 60);
      const cacheKey = `unsubscribe:short:${msg.campaign.ownerId || 'na'}:${sha256Hex(unsubscribeUrl).slice(0, 16)}`;
      let shortenedUnsubscribeUrl = await getCache(cacheKey);
      if (!shortenedUnsubscribeUrl) {
        try {
          if (DEBUG_SEND) {
            logger.info(
              {
                tag: 'SHORTEN_START',
                kind: 'unsubscribe',
                jobId: job.id,
                attempt: job.attemptsMade || 0,
                campaignId,
                ownerId,
                messageId: msg.id,
              },
              'SHORTEN_START',
            );
          }
          shortenedUnsubscribeUrl = await shortenUrl(unsubscribeUrl);
          await setCacheEx(cacheKey, ttlSeconds, shortenedUnsubscribeUrl);
        } catch (e) {
          if (DEBUG_SEND) {
            logger.warn(
              {
                tag: 'SHORTEN_FAIL',
                kind: 'unsubscribe',
                jobId: job.id,
                attempt: job.attemptsMade || 0,
                campaignId,
                ownerId,
                messageId: msg.id,
                err: e?.message || String(e),
              },
              'SHORTEN_FAIL',
            );
          }
          logger.warn({ messageId: msg.id, err: e?.message || String(e) }, 'SHORTEN_FAIL (unsubscribe) — continuing with long URL');
          shortenedUnsubscribeUrl = unsubscribeUrl;
        }
      }

      // Offer shortening: best-effort; must never throw
      let shortenedOfferUrl = offerUrl;
      if (offerUrl) {
        try {
          if (DEBUG_SEND) {
            logger.info(
              {
                tag: 'SHORTEN_START',
                kind: 'offer',
                jobId: job.id,
                attempt: job.attemptsMade || 0,
                campaignId,
                ownerId,
                messageId: msg.id,
              },
              'SHORTEN_START',
            );
          }
          shortenedOfferUrl = await shortenUrl(offerUrl);
        } catch (e) {
          if (DEBUG_SEND) {
            logger.warn(
              {
                tag: 'SHORTEN_FAIL',
                kind: 'offer',
                jobId: job.id,
                attempt: job.attemptsMade || 0,
                campaignId,
                ownerId,
                messageId: msg.id,
                err: e?.message || String(e),
              },
              'SHORTEN_FAIL',
            );
          }
          logger.warn({ messageId: msg.id, err: e?.message || String(e) }, 'SHORTEN_FAIL (offer) — continuing with long URL');
          shortenedOfferUrl = offerUrl;
        }
      }

      const finalText = await finalizeMessageText(msg.text, {
        offerUrl: shortenedOfferUrl,
        unsubscribeUrl: shortenedUnsubscribeUrl,
        ctx: {
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          campaignId,
          ownerId,
          messageId: msg.id,
        },
      });

      return {
        ownerId: msg.campaign.ownerId,
        destination: msg.to,
        text: finalText,
        contactId: msg.contact.id,
        createdById: msg.campaign.createdById,
        internalMessageId: msg.id,
        meta: {
          reason: `sms:send:campaign:${msg.campaign.id}`,
          campaignId: msg.campaign.id,
          messageId: msg.id
        }
      };
    }));

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
