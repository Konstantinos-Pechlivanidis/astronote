// apps/worker/src/sms.worker.js
require('dotenv').config();

const pino = require('pino');
const logger = pino({ name: 'sms-worker' });

if (process.env.QUEUE_DISABLED === '1') {
  logger.warn('Disabled via QUEUE_DISABLED=1');
  process.exit(0);
}

// Dependencies are resolved from apps/retail-api/node_modules because worker runs with cwd=apps/retail-api
const { Worker } = require('bullmq');
const { getRedisClient } = require('../../retail-api/src/lib/redis');
const prisma = require('../../retail-api/src/lib/prisma');
const { sendSingle } = require('../../retail-api/src/services/mitto.service');
const { sendBulkSMSWithCredits } = require('../../retail-api/src/services/smsBulk.service');
const { debit } = require('../../retail-api/src/services/wallet.service');
const { generateUnsubscribeToken } = require('../../retail-api/src/services/token.service');
const { shortenUrl, shortenUrlsInText } = require('../../retail-api/src/services/urlShortener.service');
const { logSkippedMessage } = require('../../retail-api/src/services/duplicatePreventionMetrics.service');

// Helper function to ensure base URL includes /retail path
function ensureRetailPath(url) {
  if (!url) return url;
  const trimmed = url.trim().replace(/\/$/, ''); // Remove trailing slash
  // If URL doesn't end with /retail, add it
  if (!trimmed.endsWith('/retail')) {
    return `${trimmed}/retail`;
  }
  return trimmed;
}

// CRITICAL FIX: Use unified public URL resolver (respects NODE_ENV)
const { getUnsubscribeBaseUrl, getOfferBaseUrl } = require('../../retail-api/src/lib/public-url-resolver');
const UNSUBSCRIBE_BASE_URL = getUnsubscribeBaseUrl();
const OFFER_BASE_URL = getOfferBaseUrl();

const connection = getRedisClient();

if (!connection) {
  logger.warn('Redis client could not be created, SMS worker disabled');
  process.exit(0);
}

// With lazyConnect: true, Redis connects on first command
// BullMQ will handle the connection, so we don't need to wait for 'ready' here
// Just ensure we have a client instance
logger.info('Starting SMS worker (Redis will connect on first use)...');

const concurrency = Number(process.env.WORKER_CONCURRENCY || 5);

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
    if (!msg) {
      logger.warn({ messageId }, 'Message not found, skipping');
      return;
    }

    // Billing Contract: Check subscription status BEFORE processing
    const { isSubscriptionActive } = require('../../retail-api/src/services/subscription.service');
    const subscriptionActive = await isSubscriptionActive(msg.campaign.ownerId);
    if (!subscriptionActive) {
      logger.warn({ messageId, ownerId: msg.campaign.ownerId }, 'Inactive subscription - individual send blocked');
      // Mark message as failed
      await prisma.campaignMessage.updateMany({
        where: { 
          id: messageId,
          status: 'queued',
          campaignId: msg.campaign.id,
          ownerId: msg.campaign.ownerId
        },
        data: { 
          status: 'failed',
          error: 'Active subscription required to send SMS. Please subscribe to a plan.',
          failedAt: new Date()
        }
      });
      logSkippedMessage({
        campaignId: msg.campaign.id,
        messageId,
        reason: 'inactive_subscription',
        jobId: job.id
      });
      return;
    }

    try {
      // Phase 1 Task 1.4: Do NOT regenerate unsubscribe tokens - use existing from message text
      // Use existing message text as-is (already contains unsubscribe and offer links)
      let finalText = await shortenUrlsInText(msg.text); // Shorten any URLs in message
      
      // Phase 1 Task 1.4: Only check if links are missing (safety check only)
      // Do NOT regenerate tokens - this would create new unsubscribe links on retry
      const hasUnsubscribeLink = finalText.includes('/unsubscribe/') || finalText.includes('/api/contacts/unsubscribe/');
      const hasOfferLink = finalText.includes('/o/');

      if (!hasUnsubscribeLink) {
        // Safety check: Only if completely missing, log error but don't regenerate
        // This should never happen if enqueueCampaign worked correctly
        logger.error({ 
          messageId: msg.id, 
          campaignId: msg.campaign.id 
        }, 'Unsubscribe link missing from message text - this should not happen');
        // Continue without unsubscribe link rather than creating new token
      }

      if (!hasOfferLink && msg.trackingId) {
        // Safety check: Only if completely missing, append offer link
        // This should already be in the message text from enqueueCampaign
        try {
          // CRITICAL FIX: Use unified resolver (already imported at top)
          const offerUrl = `${OFFER_BASE_URL}/o/${msg.trackingId}`;
          const shortenedOfferUrl = await shortenUrl(offerUrl);
          finalText += `\n\nView offer: ${shortenedOfferUrl}`;
          logger.warn({ messageId: msg.id }, 'Offer link was missing, appended (safety check)');
        } catch (err) {
          logger.error({ messageId: msg.id, err: err.message }, 'Failed to append offer link');
          // Continue without offer link if generation fails
        }
      }

      const resp = await sendSingle({
        userId: msg.campaign.createdById,
        destination: msg.to,
        text: finalText
      });

      // Response format: { messageId, trafficAccountId, rawResponse }
      const providerId = resp?.messageId || null;

      // Only debit credits AFTER successful send (when we have messageId)
      if (providerId) {
        try {
          await debit(msg.campaign.ownerId, 1, {
            reason: `sms:send:campaign:${msg.campaign.id}`,
            campaignId: msg.campaign.id,
            messageId: msg.id,
            meta: { providerMessageId: providerId }
          });
          logger.debug({ messageId: msg.id, ownerId: msg.campaign.ownerId }, 'Credits debited after successful send');
        } catch (debitErr) {
          // Log error but don't fail the message - it was already sent
          logger.error({ 
            messageId: msg.id, 
            ownerId: msg.campaign.ownerId, 
            err: debitErr.message 
          }, 'Failed to debit credits after successful send');
        }
      }

      // Phase 1 Task 1.3: Atomic update - only update if still queued and no providerMessageId
      await prisma.campaignMessage.updateMany({
        where: {
          id: msg.id,
          campaignId: msg.campaign.id,
          ownerId: msg.campaign.ownerId,
          status: 'queued', // Idempotency: only update if still queued
          providerMessageId: null // Idempotency: only update if not sent
        },
        data: {
          providerMessageId: providerId,
          sentAt: new Date(),
          status: 'sent'
        }
      });

      // Update campaign aggregates (non-blocking)
      try {
        const { updateCampaignAggregates } = require('../../retail-api/src/services/campaignAggregates.service');
        await updateCampaignAggregates(msg.campaign.id, msg.campaign.ownerId);
      } catch (aggErr) {
        logger.warn({ campaignId: msg.campaign.id, err: aggErr.message }, 'Failed to update campaign aggregates');
      }
    } catch (e) {
      const retryable = isRetryable(e);
      logger.warn({ 
        messageId: msg.id, 
        campaignId: msg.campaign.id, 
        retryable, 
        err: e.message 
      }, 'SMS send failed');

      // Phase 1 Task 1.3: Atomic update for failed messages
      await prisma.campaignMessage.updateMany({
        where: {
          id: msg.id,
          campaignId: msg.campaign.id,
          ownerId: msg.campaign.ownerId,
          status: 'queued' // Idempotency: only update if still queued
        },
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
        const { updateCampaignAggregates } = require('../../retail-api/src/services/campaignAggregates.service');
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
  const enqueueAttemptId = job.data.enqueueAttemptId || null; // BUG FIX: Extract correlation ID
  
  logger.info({
    campaignId,
    ownerId,
    jobId: job.id,
    enqueueAttemptId,
    messageIdsCount: messageIds.length,
    retryAttempt: job.attemptsMade || 0
  }, 'Processing batch job');
  
  try {
    // Billing Contract: Check subscription status BEFORE processing
    const { isSubscriptionActive } = require('../../retail-api/src/services/subscription.service');
    const subscriptionActive = await isSubscriptionActive(ownerId);
    if (!subscriptionActive) {
      logger.warn({ campaignId, ownerId, enqueueAttemptId }, 'Inactive subscription - batch send blocked');
      // Mark messages as failed with reason
      await prisma.campaignMessage.updateMany({
        where: { 
          id: { in: messageIds }, 
          status: 'queued',
          campaignId,
          ownerId
        },
        data: { 
          status: 'failed',
          error: 'Active subscription required to send SMS. Please subscribe to a plan.',
          failedAt: new Date()
        }
      });
      // Log skipped messages
      messageIds.forEach(messageId => {
        logSkippedMessage({
          campaignId,
          messageId,
          reason: 'inactive_subscription',
          jobId: job.id
        });
      });
      return; // Idempotent: safe to skip
    }

    // Phase 1 Task 1.3: Validate campaign state before processing
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId, ownerId },
      select: { status: true }
    });
    
    if (!campaign) {
      logger.warn({ campaignId, ownerId }, 'Campaign not found, skipping batch');
      return;
    }
    
    if (!['sending', 'paused'].includes(campaign.status)) {
      logger.warn({ 
        campaignId, 
        ownerId, 
        status: campaign.status 
      }, 'Campaign not in sendable state, skipping (idempotent)');
      // Phase 4 Task 4.3: Log skipped messages (batch level)
      messageIds.forEach(messageId => {
        logSkippedMessage({
          campaignId,
          messageId,
          reason: 'campaign_not_sendable',
          jobId: job.id
        });
      });
      return; // Idempotent: safe to skip
    }

    // Fetch all messages in batch
    // Phase 1 Task 1.3: Idempotency check - Only process messages that haven't been sent yet
    const messages = await prisma.campaignMessage.findMany({
      where: {
        id: { in: messageIds },
        campaignId,
        ownerId,
        status: 'queued',
        providerMessageId: null  // Only process unsent messages
      },
      include: {
        campaign: { select: { id: true, ownerId: true, createdById: true } },
        contact: { select: { id: true, phone: true } }
      }
    });
    
    // Idempotency: Skip messages that were already sent (in case of retry)
    const alreadySent = messageIds.length - messages.length;
    if (alreadySent > 0) {
      logger.warn({ 
        campaignId, 
        ownerId, 
        alreadySent,
        totalRequested: messageIds.length 
      }, 'Some messages already sent, skipping (idempotency)');
      // Phase 4 Task 4.3: Log skipped messages
      const sentMessageIds = new Set(messages.map(m => m.id));
      messageIds.forEach(messageId => {
        if (!sentMessageIds.has(messageId)) {
          logSkippedMessage({
            campaignId,
            messageId,
            reason: 'already_sent',
            jobId: job.id
          });
        }
      });
    }

    if (messages.length === 0) {
      logger.info({ campaignId, ownerId, messageIds }, 'No queued messages found for batch (idempotent)');
      return; // Idempotent: safe to skip
    }

    // CRITICAL FIX: Check if messages already have providerMessageId (already sent)
    // This prevents retries from sending duplicate messages
    // This check happens BEFORE the atomic claim to avoid unnecessary DB operations
    const alreadySentCheck = await prisma.campaignMessage.findFirst({
      where: {
        id: { in: messages.map(m => m.id) },
        providerMessageId: { not: null }
      },
      select: { id: true, providerMessageId: true }
    });

    if (alreadySentCheck) {
      logger.warn({ 
        campaignId, 
        ownerId, 
        messageId: alreadySentCheck.id,
        providerMessageId: alreadySentCheck.providerMessageId,
        jobId: job.id,
        retryAttempt: job.attemptsMade || 0
      }, 'Message already sent (has providerMessageId), skipping job to prevent duplicate');
      return; // Idempotent: safe to skip - message already sent
    }

    // PRODUCTION-GRADE: Atomic claim before sending with sendAttemptCount
    // This prevents race conditions where multiple workers process the same message
    const claimStartTime = Date.now();
    const claimed = await prisma.campaignMessage.updateMany({
      where: {
        id: { in: messages.map(m => m.id) },
        campaignId,
        ownerId,
        status: 'queued',
        providerMessageId: null // CRITICAL: Only claim if not already sent
      },
      data: {
        status: 'sending', // Temporary state (will be updated to 'submitted' after Mitto response)
        lockedAt: new Date(),
        lockedBy: job.id,
        sendAttemptCount: { increment: 1 } // PRODUCTION-GRADE: Track send attempts
      }
    });
    
    if (claimed.count === 0) {
      logger.warn({ 
        campaignId, 
        ownerId, 
        requestedCount: messages.length,
        jobId: job.id,
        retryAttempt: job.attemptsMade || 0
      }, 'No messages claimed (all may have been claimed by other workers or already sent)');
      return; // Idempotent: safe to skip
    }
    
    // Fetch only the claimed messages
    const claimedMessages = await prisma.campaignMessage.findMany({
      where: {
        id: { in: messages.map(m => m.id) },
        campaignId,
        ownerId,
        status: 'sending',
        lockedBy: job.id
      },
      include: {
        campaign: { select: { id: true, ownerId: true, createdById: true } },
        contact: { select: { id: true, phone: true } }
      }
    });
    
    if (claimedMessages.length === 0) {
      logger.warn({ campaignId, ownerId, jobId: job.id }, 'No messages available after claim');
      return;
    }
    
    logger.info({ 
      campaignId, 
      ownerId, 
      claimedCount: claimed.count,
      requestedCount: messages.length,
      jobId: job.id,
      retryAttempt: job.attemptsMade || 0,
      claimDuration: Date.now() - claimStartTime
    }, 'Messages claimed atomically, proceeding with send');

    // CRITICAL FIX: Double-check no providerMessageId exists before sending
    // This is a safety net in case the job was retried after a partial success
    // Check the claimed messages specifically
    const finalCheck = await prisma.campaignMessage.findFirst({
      where: {
        id: { in: claimedMessages.map(m => m.id) },
        providerMessageId: { not: null }
      },
      select: { id: true, providerMessageId: true }
    });

    if (finalCheck) {
      logger.error({ 
        campaignId, 
        ownerId, 
        messageId: finalCheck.id,
        providerMessageId: finalCheck.providerMessageId,
      jobId: job.id,
      retryAttempt: job.attemptsMade || 0
      }, 'CRITICAL: Message has providerMessageId after claim - possible race condition, skipping send');
      
      // Release locks for messages that were claimed but shouldn't be sent
      await prisma.campaignMessage.updateMany({
        where: {
          id: { in: claimedMessages.map(m => m.id) },
          status: 'sending',
          lockedBy: job.id
        },
        data: {
          status: 'queued', // Put back to queued
          lockedAt: null,
          lockedBy: null
        }
      });
      return; // Don't send - already sent
    }

    const startTime = Date.now();

    // Prepare messages for bulk sending (only claimed messages)
    // Phase 1 Task 1.4: Do NOT regenerate unsubscribe tokens - use existing from message text
    const bulkMessages = await Promise.all(claimedMessages.map(async (msg) => {
      // Use existing message text as-is (already contains unsubscribe and offer links)
      // Only shorten URLs if needed (should already be shortened, but safety check)
      let finalText = await shortenUrlsInText(msg.text);
      
      // Phase 1 Task 1.4: Only append links if completely missing (safety check only)
      // Do NOT regenerate tokens - this would create new unsubscribe links on retry
      const hasUnsubscribeLink = finalText.includes('/unsubscribe/') || finalText.includes('/api/contacts/unsubscribe/');
      const hasOfferLink = finalText.includes('/o/');

      if (!hasUnsubscribeLink) {
        // Safety check: Only if completely missing, log warning but don't regenerate
        // This should never happen if enqueueCampaign worked correctly
        logger.error({ 
          messageId: msg.id, 
          campaignId: msg.campaign.id 
        }, 'Unsubscribe link missing from message text - this should not happen');
        // Continue without unsubscribe link rather than creating new token
      }

      if (!hasOfferLink && msg.trackingId) {
        // Safety check: Only if completely missing, append offer link
        // This should already be in the message text from enqueueCampaign
        try {
          // CRITICAL FIX: Use unified resolver (already imported at top)
          const offerUrl = `${OFFER_BASE_URL}/o/${msg.trackingId}`;
          const shortenedOfferUrl = await shortenUrl(offerUrl);
          finalText += `\n\nView offer: ${shortenedOfferUrl}`;
          logger.warn({ messageId: msg.id }, 'Offer link was missing, appended (safety check)');
        } catch (err) {
          logger.warn({ messageId: msg.id, err: err.message }, 'Failed to append offer link');
        }
      }

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

    // Send bulk SMS
    logger.info({
      campaignId,
      ownerId,
      enqueueAttemptId,
      jobId: job.id,
      messageCount: bulkMessages.length
    }, 'Sending bulk SMS via provider');
    
    const result = await sendBulkSMSWithCredits(bulkMessages);
    
    logger.info({
      campaignId,
      ownerId,
      enqueueAttemptId,
      jobId: job.id,
      sentCount: result.results.filter(r => r.sent).length,
      failedCount: result.results.filter(r => !r.sent).length,
      bulkId: result.bulkId
    }, 'Bulk SMS send completed');

    // RELIABLE SENDING FIX: Update messages with submitted status after Mitto response
    // Status: 'sending' (claimed) -> 'submitted' (sent to Mitto, waiting for DLR)
    // Only update messages that were claimed by this job (lockedBy = job.id)
    const successfulIds = [];
    const failedIds = [];
    const submittedAt = new Date();

    for (const res of result.results) {
      if (res.sent && res.messageId) {
        // RELIABLE SENDING FIX: Update to 'submitted' status (not 'sent')
        // DLR webhook will update to final status (delivered/failed)
        const updateResult = await prisma.campaignMessage.updateMany({
          where: {
            id: res.internalMessageId,
            campaignId,
            ownerId,
            status: 'sending', // Only update if still in 'sending' (claimed by this job)
            lockedBy: job.id // Additional safety: only update messages claimed by this job
          },
          data: {
            providerMessageId: res.messageId,
            providerBulkId: result.bulkId, // PRODUCTION-GRADE: Use providerBulkId
            bulkId: result.bulkId, // Legacy support
            submittedAt: submittedAt, // Track when submitted to Mitto
            status: 'submitted', // Temporary status - DLR will update to final status
            error: null,
            lastError: null, // PRODUCTION-GRADE: Clear last error on success
            lockedAt: null, // Clear lock
            lockedBy: null // Clear lock
          }
        });
        
        if (updateResult.count > 0) {
          successfulIds.push(res.internalMessageId);
        } else {
          // Message was already updated (race condition or retry)
          logger.debug({ 
            messageId: res.internalMessageId, 
            campaignId 
          }, 'Message already sent, skipping update (idempotent)');
        }
      } else {
        // RELIABLE SENDING FIX: Update failed messages (claimed by this job)
        const updateResult = await prisma.campaignMessage.updateMany({
          where: {
            id: res.internalMessageId,
            campaignId,
            ownerId,
            status: 'sending', // Only update if still in 'sending' (claimed by this job)
            lockedBy: job.id // Additional safety: only update messages claimed by this job
          },
          data: {
            status: 'failed',
            failedAt: new Date(),
            error: res.error || res.reason || 'Send failed',
            lastError: res.error || res.reason || 'Send failed', // PRODUCTION-GRADE: Store in lastError
            lockedAt: null, // Clear lock
            lockedBy: null // Clear lock
          }
        });
        
        if (updateResult.count > 0) {
          failedIds.push(res.internalMessageId);
        }
      }
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
    }, 'Batch job completed');

    // Update campaign aggregates (non-blocking)
    try {
      const { updateCampaignAggregates } = require('../../retail-api/src/services/campaignAggregates.service');
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
      err: e.message,
      jobId: job.id
    }, 'Batch job failed');

    // RELIABLE SENDING FIX: Release locks on error
    // If messages were claimed but send failed, release the lock
    // If retryable, set back to 'queued' for retry; otherwise mark as 'failed'
    await prisma.campaignMessage.updateMany({
      where: {
        id: { in: messageIds },
        campaignId,
        ownerId,
        status: 'sending', // Only update messages claimed by this job
        lockedBy: job.id // Additional safety: only update messages claimed by this job
      },
        data: {
          failedAt: retryable ? null : new Date(),
          status: retryable ? 'queued' : 'failed',
          error: e.message,
          lastError: e.message, // PRODUCTION-GRADE: Store in lastError
          retryCount: { increment: 1 }, // Track retry attempts
          lockedAt: null, // Release lock
          lockedBy: null // Release lock
        }
    });
    
    // Also handle messages that might still be in 'queued' (not claimed yet)
      await prisma.campaignMessage.updateMany({
        where: {
          id: { in: messageIds },
          campaignId,
          ownerId,
          status: 'queued'  // Only update queued messages (idempotency)
        },
        data: {
          failedAt: retryable ? null : new Date(),
          status: retryable ? 'queued' : 'failed',
          error: e.message,
          retryCount: { increment: 1 }  // Track retry attempts
        }
      });

    // Update campaign aggregates
    try {
      const { updateCampaignAggregates } = require('../../retail-api/src/services/campaignAggregates.service');
      await updateCampaignAggregates(campaignId, ownerId);
    } catch (aggErr) {
      logger.warn({ campaignId, err: aggErr.message }, 'Failed to update campaign aggregates');
    }

    if (retryable) throw e;
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
  logger.info({ jobId: job.id }, `Completed ${job.name}`);
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err?.message }, `Failed ${job?.name}`);
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
