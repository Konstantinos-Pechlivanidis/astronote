import prisma from '../../services/prisma.js';
import { logger } from '../../utils/logger.js';
import { sendBulkSMSWithCredits } from '../../services/smsBulk.js';
import { deliveryStatusQueue, smsQueue } from '../index.js';
import { updateCampaignAggregates } from '../../services/campaignAggregates.js';
import { replacePlaceholders } from '../../utils/personalization.js';
import { appendUnsubscribeLink } from '../../utils/unsubscribe.js';
import { shortenUrlsInText } from '../../utils/urlShortener.js';
import { getDiscountCode } from '../../services/shopify.js';
import { cacheRedis } from '../../config/redis.js';
import {
  redisGetMany,
  redisSetExBestEffort,
  redisSetNxWithTtl,
  redisDelMany,
  sha256Hex,
} from '../../utils/redisSafe.js';

/**
 * Check if error is retryable (Phase 2.1: Rate limiting retry)
 */
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

/**
 * Process bulk SMS batch job
 * @param {Object} job - BullMQ job with campaignId, shopId, recipientIds
 */
export async function handleBulkSMS(job) {
  const { campaignId, shopId, recipientIds } = job.data;
  let providerSucceeded = false;
  let providerResults = null;
  const debug = process.env.SMS_SEND_DEBUG === '1';
  let claimKeys = [];
  let claimedRecipientIds = [];
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkSms.js:32',message:'handleBulkSMS ENTRY',data:{jobId:job.id,campaignId,shopId,recipientIdsCount:recipientIds?.length,first5Recipients:recipientIds?.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
  // #endregion

  if (!campaignId || !shopId || !recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    logger.error({ jobId: job.id, data: job.data }, 'Invalid bulk SMS job data');
    throw new Error('Invalid bulk SMS job data: missing campaignId, shopId, or recipientIds');
  }

  try {
    // Fetch campaign recipients (idempotency: only process pending, unsent messages)
    const recipients = await prisma.campaignRecipient.findMany({
      where: {
        id: { in: recipientIds },
        campaignId,
        status: 'pending',
        mittoMessageId: null, // Only process unsent messages
      },
      include: {
        contact: {
          select: {
            id: true,
            phoneE164: true,
            firstName: true,
            lastName: true,
          },
        },
        campaign: {
          select: {
            id: true,
            message: true,
            discountId: true,
          },
        },
      },
    });

    // Idempotency: Skip messages that were already sent (in case of retry)
    const alreadySent = recipientIds.length - recipients.length;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkSms.js:67',message:'Recipients found in DB',data:{campaignId,jobId:job.id,requestedCount:recipientIds.length,foundCount:recipients.length,alreadySent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
    // #endregion
    if (alreadySent > 0) {
      logger.warn({
        campaignId,
        shopId,
        alreadySent,
        totalRequested: recipientIds.length,
      }, 'Some recipients already sent, skipping (idempotency)');
    }

    if (recipients.length === 0) {
      logger.warn({ campaignId, shopId, recipientIds }, 'No pending recipients found for batch');
      return { ok: true, processed: 0, skipped: alreadySent };
    }

    if (debug) {
      logger.info(
        {
          tag: 'PRE_SEND',
          campaignId,
          shopId,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          pendingCount: recipients.length,
          alreadySentCount: alreadySent,
        },
        'PRE_SEND',
      );
    }

    // Idempotency guard: if a previous attempt already called the provider but DB persist failed,
    // we store a redis marker per CampaignRecipient to prevent re-send.
    // Only needed for retries (attemptsMade > 0), but harmless otherwise.
    const redisSentKeys = recipients.map(r => `sms:sent:campaignRecipient:${r.id}`);
    const redisSentVals = await redisGetMany(cacheRedis, redisSentKeys);
    const redisSentSet = new Set(
      recipients
        .filter((_, idx) => Boolean(redisSentVals[idx]))
        .map(r => r.id),
    );
    const redisAlreadySentCount = redisSentSet.size;
    let recipientsToProcess = redisAlreadySentCount
      ? recipients.filter(r => !redisSentSet.has(r.id))
      : recipients;

    if (redisAlreadySentCount > 0) {
      logger.warn(
        {
          campaignId,
          shopId,
          jobId: job.id,
          retryAttempt: job.attemptsMade || 0,
          redisAlreadySentCount,
        },
        'Skipping recipients already marked as sent in Redis (post-send persist repair pending)',
      );
    }

    // Claim recipients to prevent duplicate sends across overlapping jobs
    const claimTtlSeconds = Number(process.env.SMS_SEND_CLAIM_TTL_SECONDS || 15 * 60);
    if (claimTtlSeconds > 0 && recipientsToProcess.length > 0) {
      const claimResults = await Promise.all(
        recipientsToProcess.map(r =>
          redisSetNxWithTtl(
            cacheRedis,
            `sms:send-claim:${r.id}`,
            claimTtlSeconds,
            job.id || 'send',
          ),
        ),
      );
      const newlyClaimed = [];
      const alreadyClaimed = [];
      claimResults.forEach((ok, idx) => {
        if (ok) {
          newlyClaimed.push(recipientsToProcess[idx]);
        } else {
          alreadyClaimed.push(recipientsToProcess[idx]);
        }
      });
      claimKeys = newlyClaimed.map(r => `sms:send-claim:${r.id}`);
      claimedRecipientIds = newlyClaimed.map(r => r.id);
      recipientsToProcess = newlyClaimed;
      if (alreadyClaimed.length > 0) {
        logger.warn(
          {
            campaignId,
            shopId,
            jobId: job.id,
            skippedAlreadyClaimed: alreadyClaimed.length,
          },
          'Send claim exists for recipients, skipping to avoid duplicate send',
        );
      }
    }

    const startTime = Date.now();
    logger.info({
      campaignId,
      shopId,
      batchSize: recipients.length,
      requestedCount: recipientIds.length,
      jobId: job.id,
      retryAttempt: job.attemptsMade || 0,
    }, 'Processing bulk SMS batch job');

    // Fetch discount code if campaign has a discountId (fetch once, use for all recipients)
    let discountCode = '';
    if (recipients[0]?.campaign?.discountId) {
      try {
        const shop = await prisma.shop.findUnique({
          where: { id: shopId },
          select: { shopDomain: true },
        });

        if (shop?.shopDomain) {
          const discount = await getDiscountCode(
            shop.shopDomain,
            recipients[0].campaign.discountId,
          );
          discountCode = discount?.code || '';
        }
      } catch (error) {
        logger.warn(
          { shopId, campaignId, error: error.message },
          'Failed to fetch discount code, continuing without it',
        );
      }
    }

    // Frontend base URL for unsubscribe links (if needed in future)
    // const frontendBaseUrl =
    //   process.env.FRONTEND_URL ||
    //   process.env.FRONTEND_BASE_URL ||
    //   'https://astronote-shopify-frontend.onrender.com';

    // Prepare messages for bulk sending
    const bulkMessages = await Promise.all(
      recipientsToProcess.map(async (recipient) => {
        // Get message template from campaign
        let messageText = recipient.campaign.message;

        // Replace personalization placeholders
        messageText = replacePlaceholders(messageText, {
          firstName: recipient.contact?.firstName || '',
          lastName: recipient.contact?.lastName || '',
          discountCode,
        });

        // Shorten any URLs in the message text FIRST (before adding unsubscribe link)
        // IMPORTANT: best-effort only; never throw (shortening failure must not trigger resend).
        try {
          if (debug) {
            logger.info(
              {
                tag: 'SHORTEN_START',
                campaignId,
                shopId,
                jobId: job.id,
                attempt: job.attemptsMade || 0,
                recipientId: recipient.id,
              },
              'SHORTEN_START',
            );
          }
          messageText = await shortenUrlsInText(messageText, {
            shopId,
            campaignId,
            contactId: recipient.contactId,
          });
        } catch (shortErr) {
          if (debug) {
            logger.warn(
              {
                tag: 'SHORTEN_FAIL',
                campaignId,
                shopId,
                jobId: job.id,
                attempt: job.attemptsMade || 0,
                recipientId: recipient.id,
                err: shortErr?.message || String(shortErr),
              },
              'SHORTEN_FAIL',
            );
          }
          logger.warn(
            {
              campaignId,
              shopId,
              recipientId: recipient.id,
              err: shortErr?.message || String(shortErr),
            },
            'SHORTEN_FAIL (pre-send) — continuing with unshortened message',
          );
        }

        // Append unsubscribe link AFTER shortening
        // We add it after shortening to ensure it's never processed by shortenUrlsInText.
        // The unsubscribe helper will generate the long, signed unsubscribe URL, then wrap it
        // in a system-owned DB-backed short link (/r/:token) for SMS length + compliance.
        // Note: No req available in queue job context, pass null
        let messageWithUnsubscribe = messageText;
        try {
          if (debug) {
            logger.info(
              {
                tag: 'SHORTEN_START',
                kind: 'unsubscribe',
                campaignId,
                shopId,
                jobId: job.id,
                attempt: job.attemptsMade || 0,
                recipientId: recipient.id,
              },
              'SHORTEN_START',
            );
          }
          messageWithUnsubscribe = await appendUnsubscribeLink(
            messageText,
            recipient.contactId,
            shopId,
            recipient.phoneE164,
            null, // No req available in queue job context
            { campaignId, recipientId: recipient.id },
          );
        } catch (unsubErr) {
          if (debug) {
            logger.warn(
              {
                tag: 'SHORTEN_FAIL',
                kind: 'unsubscribe',
                campaignId,
                shopId,
                jobId: job.id,
                attempt: job.attemptsMade || 0,
                recipientId: recipient.id,
                err: unsubErr?.message || String(unsubErr),
              },
              'SHORTEN_FAIL',
            );
          }
          logger.warn(
            {
              campaignId,
              shopId,
              recipientId: recipient.id,
              err: unsubErr?.message || String(unsubErr),
            },
            'SHORTEN_FAIL (unsubscribe) — continuing without modified unsubscribe link',
          );
          // Keep the message without appended unsubscribe rather than failing the job.
        }

        return {
          shopId, // Use shopId to match smsBulk.service.js
          destination: recipient.phoneE164,
          text: messageWithUnsubscribe,
          contactId: recipient.contactId,
          internalRecipientId: recipient.id, // Use internalRecipientId to match smsBulk.service.js
          meta: {
            reason: `sms:send:campaign:${campaignId}`,
            campaignId,
            recipientId: recipient.id,
          },
        };
      }),
    );

    // CRITICAL: Re-check recipients status before sending (prevent duplicate sends from retries)
    // This check happens right before the API call to ensure we only send to truly pending recipients
    // Use a transaction to get a consistent snapshot of recipient statuses
    const currentRecipients = await prisma.$transaction(async tx => {
      return await tx.campaignRecipient.findMany({
        where: {
          id: { in: recipientIds },
          campaignId,
          status: 'pending',
          mittoMessageId: null, // CRITICAL: Only process unsent messages
        },
        select: { id: true, phoneE164: true },
      });
    });

    // Filter bulkMessages to only include recipients that are still pending
    const currentRecipientIds = new Set(currentRecipients.map(r => r.id));
    const filteredBulkMessages = bulkMessages.filter(msg =>
      currentRecipientIds.has(msg.internalRecipientId),
    );

    const skippedCount = bulkMessages.length - filteredBulkMessages.length;
    if (skippedCount > 0) {
      logger.warn(
        {
          campaignId,
          shopId,
          requestedCount: bulkMessages.length,
          currentPendingCount: currentRecipients.length,
          skippedCount,
          jobId: job.id,
          retryAttempt: job.attemptsMade || 0,
        },
        'Some recipients already sent (skipping to prevent duplicates)',
      );
    }

    logger.info(
      {
        campaignId,
        shopId,
        jobId: job.id,
        requested: recipientIds.length,
        fetchedPending: recipients.length,
        alreadySentDb: alreadySent,
        redisAlreadySent: redisAlreadySentCount,
        claimed: claimedRecipientIds.length || recipientsToProcess.length,
        filteredToSend: filteredBulkMessages.length,
        skippedAfterSnapshot: skippedCount,
      },
      'Bulk SMS batch filter summary',
    );

    if (filteredBulkMessages.length === 0) {
      logger.warn(
        {
          campaignId,
          shopId,
          requestedCount: bulkMessages.length,
          currentPendingCount: currentRecipients.length,
          jobId: job.id,
          retryAttempt: job.attemptsMade || 0,
        },
        'No pending recipients found (all already sent by another job or previous retry)',
      );
      if (claimKeys.length > 0) {
        await redisDelMany(cacheRedis, claimKeys);
      }
      return {
        ok: true,
        bulkId: null,
        successful: 0,
        failed: 0,
        skipped: bulkMessages.length,
        total: 0,
      };
    }

    // Send bulk SMS only for recipients that are still pending
    const mittoStart = Date.now();
    if (debug) {
      logger.info(
        {
          tag: 'PRE_SEND',
          kind: 'provider',
          campaignId,
          shopId,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          providerCalled: true,
          sendCount: filteredBulkMessages.length,
        },
        'PRE_SEND',
      );
    }
    let result;
    try {
      result = await sendBulkSMSWithCredits(filteredBulkMessages, {
        jobId: job.id,
        campaignId,
        shopId,
      });
      providerSucceeded = true;
    } catch (providerErr) {
      // Provider call failed before we got definitive provider IDs; safe to retry (BullMQ will retry).
      logger.error(
        {
          campaignId,
          shopId,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          err: providerErr?.message || String(providerErr),
        },
        'Provider send failed (pre-success) — allowing retry',
      );
      throw providerErr;
    }
    providerResults = result;
    const mittoMs = Date.now() - mittoStart;
    if (debug) {
      logger.info(
        {
          tag: 'POST_SEND',
          campaignId,
          shopId,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          providerCalled: true,
          bulkId: result.bulkId || null,
          sentCount: (result.results || []).filter(r => r.sent && r.messageId).length,
          failedCount: (result.results || []).filter(r => !r.sent).length,
        },
        'POST_SEND',
      );
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkSms.js:230',message:'sendBulkSMSWithCredits result',data:{campaignId,jobId:job.id,totalResults:result.results?.length,sentCount:result.results?.filter(r => r.sent).length,failedCount:result.results?.filter(r => !r.sent).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
    // #endregion
    if (result?.rateLimit) {
      logger.info(
        {
          campaignId,
          shopId,
          jobId: job.id,
          rateLimit: result.rateLimit,
        },
        'Rate limit snapshot (post-provider)',
      );
    }

    // IMPORTANT: After provider success, set redis sent markers immediately to prevent resends
    // even if DB persist fails (job retry must not call provider again).
    try {
      const ttlSeconds = Number(process.env.SMS_SENT_MARKER_TTL_SECONDS || 30 * 24 * 60 * 60);
      await Promise.all(
        (result.results || [])
          .filter(r => r.sent && r.messageId)
          .map(r =>
            redisSetExBestEffort(
              cacheRedis,
              `sms:sent:campaignRecipient:${r.internalRecipientId}`,
              ttlSeconds,
              String(r.messageId),
            ),
          ),
      );
    } catch (markerErr) {
      logger.warn(
        { campaignId, shopId, jobId: job.id, err: markerErr?.message || String(markerErr) },
        'Failed to write redis sent markers (best-effort)',
      );
    }

    // P0: CRITICAL: Persist provider IDs. If DB persist fails, do NOT throw (avoid resend).
    let updateResult;
    try {
      updateResult = await prisma.$transaction(
        async tx => {
          const successfulIds = [];
          const failedIds = [];
          const messageLogs = [];

          for (const res of result.results) {
            if (res.sent && res.messageId) {
            // P0: CRITICAL: Atomic update with double idempotency check
              const updateResult = await tx.campaignRecipient.updateMany({
                where: {
                  id: res.internalRecipientId,
                  mittoMessageId: null, // CRITICAL: Only update if not already sent
                  status: 'pending', // Double check: only update pending recipients
                },
                data: {
                  mittoMessageId: res.messageId,
                  bulkId: result.bulkId,
                  sentAt: new Date(),
                  status: 'sent',
                  deliveryStatus: 'Queued', // Initial status from Mitto
                  error: null,
                },
              });

              if (updateResult.count > 0) {
                successfulIds.push(res.internalRecipientId);
                // Create message log for successful send
                const recipient = recipients.find(r => r.id === res.internalRecipientId);
                if (recipient) {
                  messageLogs.push({
                    shopId,
                    phoneE164: recipient.phoneE164,
                    provider: 'mitto',
                    direction: 'outbound',
                    status: 'sent',
                    providerMsgId: res.messageId,
                    campaignId,
                    contactId: recipient.contactId,
                    payload: {
                      text: recipient.campaign.message,
                      bulkId: result.bulkId,
                    },
                  });
                }
              } else {
                logger.warn(
                  {
                    campaignId,
                    shopId,
                    recipientId: res.internalRecipientId,
                    messageId: res.messageId,
                  },
                  'Recipient already sent (transaction idempotency check prevented duplicate)',
                );
              }
            } else {
            // Only update if still pending (idempotency)
              const updateResult = await tx.campaignRecipient.updateMany({
                where: {
                  id: res.internalRecipientId,
                  status: 'pending', // CRITICAL: Only update pending recipients
                  mittoMessageId: null, // Double check: only update unsent
                },
                data: {
                  status: 'failed',
                  failedAt: new Date(),
                  error: res.error || res.reason || 'Send failed',
                  updatedAt: new Date(),
                },
              });

              if (updateResult.count > 0) {
                failedIds.push(res.internalRecipientId);
              } else {
                logger.warn(
                  {
                    campaignId,
                    shopId,
                    recipientId: res.internalRecipientId,
                  },
                  'Recipient already processed (transaction idempotency check prevented duplicate)',
                );
              }
            }
          }

          if (messageLogs.length > 0) {
            await tx.messageLog.createMany({ data: messageLogs });
          }

          return {
            successfulIds,
            failedIds,
          };
        },
        {
          timeout: 30000, // 30 second timeout for transaction (updates should be fast)
          maxWait: 5000, // 5 second max wait for lock
        },
      );
      if (debug) {
        logger.info(
          {
            tag: 'POST_PERSIST',
            campaignId,
            shopId,
            jobId: job.id,
            attempt: job.attemptsMade || 0,
            ok: true,
          },
          'POST_PERSIST',
        );
      }
    } catch (persistErr) {
      // Persist failed AFTER provider send. Do NOT throw (prevents duplicate provider sends).
      logger.error(
        {
          campaignId,
          shopId,
          jobId: job.id,
          retryAttempt: job.attemptsMade || 0,
          err: persistErr?.message || String(persistErr),
        },
        'POST_PERSIST failed after provider send — scheduling repair and returning success to avoid resend',
      );
      if (debug) {
        logger.error(
          {
            tag: 'POST_PERSIST',
            campaignId,
            shopId,
            jobId: job.id,
            attempt: job.attemptsMade || 0,
            ok: false,
            providerCalled: true,
            err: persistErr?.message || String(persistErr),
          },
          'POST_PERSIST',
        );
      }

      // Store provider result mapping in Redis and enqueue a repair job that ONLY persists IDs.
      try {
        const repairKey = `sms:repair:bulk:${campaignId}:${job.id}:${sha256Hex(String(Date.now())).slice(0, 8)}`;
        const ttlSeconds = Number(process.env.SMS_REPAIR_TTL_SECONDS || 24 * 60 * 60);
        const payload = {
          kind: 'bulk',
          campaignId,
          shopId,
          bulkId: result.bulkId || null,
          results: result.results || [],
        };
        await redisSetExBestEffort(cacheRedis, repairKey, ttlSeconds, JSON.stringify(payload));
        await smsQueue.add(
          'persistSmsResults',
          { repairKey },
          {
            jobId: `persistSmsResults:${repairKey}`,
            attempts: 10,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 200,
            removeOnFail: 200,
          },
        );
      } catch (repairErr) {
        logger.error(
          { campaignId, shopId, jobId: job.id, err: repairErr?.message || String(repairErr) },
          'Failed to enqueue post-send persist repair job',
        );
      }

      // Return as ok: provider already accepted sends.
      return {
        ok: true,
        bulkId: result.bulkId || null,
        successful: (result.results || []).filter(r => r.sent && r.messageId).length,
        failed: (result.results || []).filter(r => !r.sent).length,
        skipped: skippedCount || 0,
        total: (result.results || []).length,
        postPersist: 'failed',
      };
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkSms.js:312',message:'Transaction completed',data:{campaignId,jobId:job.id,successfulCount:updateResult.successfulIds.length,failedCount:updateResult.failedIds.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
    // #endregion

    const { successfulIds, failedIds } = updateResult;
    const skipped = bulkMessages.length - filteredBulkMessages.length;
    const bulkId = result.bulkId;
    const results = result.results;

    const duration = Date.now() - startTime;
    logger.info({
      campaignId,
      shopId,
      bulkId: result.bulkId,
      successful: successfulIds.length,
      failed: failedIds.length,
      total: result.results.length,
      duration,
      mittoMs,
      jobId: job.id,
      retryAttempt: job.attemptsMade || 0,
    }, 'Bulk SMS batch job completed');

    // Update campaign aggregates (non-blocking)
    try {
      await updateCampaignAggregates(campaignId, shopId);
    } catch (aggErr) {
      logger.warn({ campaignId, err: aggErr.message }, 'Failed to update campaign aggregates');
    }

    // Queue delivery status update jobs for successful sends
    if (bulkId && successfulIds.length > 0) {
      try {
        // Short ladder for quick feedback in UI: 10s, 30s, 60s
        await deliveryStatusQueue.add(
          'update-campaign-status',
          { campaignId },
          {
            delay: 10000, // 10 seconds
            jobId: `status-update-${campaignId}-10s-${Date.now()}`,
            removeOnComplete: true,
            attempts: 2,
            backoff: { type: 'fixed', delay: 5000 },
          },
        );

        await deliveryStatusQueue.add(
          'update-campaign-status',
          { campaignId },
          {
            delay: 30000, // 30 seconds
            jobId: `status-update-${campaignId}-30s-${Date.now()}`,
            removeOnComplete: true,
            attempts: 2,
            backoff: { type: 'fixed', delay: 5000 },
          },
        );

        await deliveryStatusQueue.add(
          'update-campaign-status',
          { campaignId },
          {
            delay: 60000, // 60 seconds
            jobId: `status-update-${campaignId}-60s-${Date.now()}`,
            removeOnComplete: true,
            attempts: 2,
            backoff: { type: 'fixed', delay: 5000 },
          },
        );

        logger.debug('Queued delivery status update jobs', {
          campaignId,
          bulkId,
        });
      } catch (queueError) {
        logger.warn('Failed to queue delivery status update', {
          campaignId,
          bulkId,
          error: queueError.message,
        });
      }
    }

    // If there were failures, log them but don't throw (partial success is acceptable)
    if (failedIds.length > 0) {
      logger.warn({
        campaignId,
        failedCount: failedIds.length,
        failedIds: failedIds.slice(0, 10), // Log first 10 failed IDs
      }, 'Some messages in batch failed');
    }

    return {
      ok: true,
      bulkId,
      successful: successfulIds.length,
      failed: failedIds.length,
      skipped: skipped || 0,
      total: results.length,
    };

  } catch (e) {
    const retryable = isRetryable(e);
    logger.error({
      campaignId,
      shopId,
      recipientIds,
      retryable,
      err: e.message,
      stack: e.stack,
    }, 'Bulk SMS batch job failed');

    // If provider was called, NEVER throw or reset recipients to pending for retry.
    // Retrying would cause duplicate sends. Instead, log and return success-ish.
    if (providerSucceeded || providerResults) {
      logger.error(
        {
          campaignId,
          shopId,
          jobId: job.id,
          retryAttempt: job.attemptsMade || 0,
          err: e?.message || String(e),
        },
        '[NO-RETRY] Failure after provider call — returning without retry to prevent duplicate sends',
      );
      return { ok: true, bulkId: providerResults?.bulkId || null, postProviderFailure: true };
    }

    if (!providerSucceeded && !providerResults && claimKeys.length > 0) {
      await redisDelMany(cacheRedis, claimKeys);
    }

    // Pre-send failure: safe to retry (provider not called).
    await prisma.campaignRecipient.updateMany({
      where: {
        id: { in: recipientIds },
        campaignId,
        status: 'pending',
      },
      data: {
        status: retryable ? 'pending' : 'failed',
        error: e.message,
        retryCount: { increment: 1 },
      },
    });

    // Update campaign aggregates
    try {
      await updateCampaignAggregates(campaignId, shopId);
    } catch (aggErr) {
      logger.warn({ campaignId, err: aggErr.message }, 'Failed to update campaign aggregates');
    }

    if (retryable) throw e;

    return {
      ok: false,
      error: e.message,
      retryable: false,
    };
  }
}

export default { handleBulkSMS };
