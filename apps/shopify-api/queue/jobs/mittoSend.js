import prisma from '../../services/prisma.js';
import {
  sendSms,
  MittoApiError,
  ValidationError,
} from '../../services/mitto.js';
import { logger } from '../../utils/logger.js';
import {
  MessageDirection,
  MessageStatus,
} from '../../utils/prismaEnums.js';
import { deliveryStatusQueue } from '../index.js';
import { smsQueue } from '../index.js';
import { cacheRedis } from '../../config/redis.js';
import { redisSetExBestEffort, sha256Hex } from '../../utils/redisSafe.js';

export async function handleMittoSend(job) {
  const { campaignId, shopId, phoneE164, message, sender } = job.data;
  let providerSucceeded = false;
  let providerMsgId = null;
  const debug = process.env.SMS_SEND_DEBUG === '1';

  try {
    if (debug) {
      logger.info(
        {
          tag: 'PRE_SEND',
          kind: 'single',
          campaignId,
          shopId,
          phoneE164,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          providerCalled: false,
        },
        'PRE_SEND',
      );
    }

    // Skip credit consumption for campaign messages (credits already consumed at campaign level)
    // Individual SMS (non-campaign) will consume credits normally
    const isCampaignMessage = !!campaignId;

    // Idempotency guard: if this campaign recipient already has a provider message id, do not resend.
    if (campaignId && phoneE164) {
      const existing = await prisma.campaignRecipient.findFirst({
        where: { campaignId, phoneE164, mittoMessageId: { not: null } },
        select: { id: true, mittoMessageId: true },
      });
      if (existing?.mittoMessageId) {
        logger.warn(
          { jobId: job.id, campaignId, phoneE164, msgId: existing.mittoMessageId },
          'Skipping sendSMS: recipient already has mittoMessageId (idempotent skip)',
        );
        return { ok: true, msgId: existing.mittoMessageId, skipped: true };
      }
    }

    // Use new SMS service with updated API
    if (debug) {
      logger.info(
        {
          tag: 'PRE_SEND',
          kind: 'provider',
          campaignId,
          shopId,
          phoneE164,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          providerCalled: true,
        },
        'PRE_SEND',
      );
    }
    let res;
    try {
      res = await sendSms({
        to: phoneE164,
        text: message,
        senderOverride: sender,
        shopId,
        skipCreditCheck: isCampaignMessage, // Skip credit check for campaign messages
      });
      providerSucceeded = true;
    } catch (providerErr) {
      // Provider call failed before we got definitive provider IDs; safe to retry.
      logger.error(
        { jobId: job.id, campaignId, shopId, phoneE164, err: providerErr?.message || String(providerErr) },
        'Provider send failed (pre-success) — allowing retry',
      );
      throw providerErr;
    }

    const msgId = res?.messageId || null;
    providerMsgId = msgId;
    if (debug) {
      logger.info(
        {
          tag: 'POST_SEND',
          campaignId,
          shopId,
          phoneE164,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          providerCalled: true,
          providerMsgId: msgId,
        },
        'POST_SEND',
      );
    }

    // Post-provider marker (best-effort): prevents resends if DB persist fails.
    if (campaignId && phoneE164 && msgId) {
      const ttlSeconds = Number(process.env.SMS_SENT_MARKER_TTL_SECONDS || 30 * 24 * 60 * 60);
      await redisSetExBestEffort(
        cacheRedis,
        `sms:sent:campaignRecipient:${campaignId}:${sha256Hex(phoneE164).slice(0, 16)}`,
        ttlSeconds,
        String(msgId),
      );
    }

    // Update existing campaign recipient record (created during campaign send)
    // Find the recipient record for this campaign and phone
    const recipient = await prisma.campaignRecipient.findFirst({
      where: {
        campaignId,
        phoneE164,
      },
    });

    if (recipient) {
      // Update existing record
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'sent',
          mittoMessageId: msgId,
          sentAt: new Date(),
          senderNumber: sender,
          deliveryStatus: 'Queued', // Initial status from Mitto
        },
      });
    } else {
      // Fallback: create new record if not found (shouldn't happen normally)
      logger.warn('Campaign recipient not found, creating new record', {
        campaignId,
        phoneE164,
      });
      await prisma.campaignRecipient.create({
        data: {
          campaignId,
          contactId: null,
          phoneE164,
          status: 'sent',
          mittoMessageId: msgId,
          sentAt: new Date(),
          senderNumber: sender,
          deliveryStatus: 'Queued',
        },
      });
    }

    // Create message log with sender info
    await prisma.messageLog.create({
      data: {
        shopId,
        phoneE164,
        direction: MessageDirection.outbound,
        provider: 'mitto',
        providerMsgId: msgId,
        status: 'sent',
        campaignId,
        senderNumber: sender,
        deliveryStatus: 'Queued',
      },
    });

    if (debug) {
      logger.info(
        {
          tag: 'POST_PERSIST',
          campaignId,
          shopId,
          phoneE164,
          jobId: job.id,
          attempt: job.attemptsMade || 0,
          ok: true,
          providerMsgId: msgId,
        },
        'POST_PERSIST',
      );
    }

    // Update campaign metrics
    await prisma.campaignMetrics.update({
      where: { campaignId },
      data: { totalSent: { increment: 1 } },
    });

    // Queue delivery status update job (with delay to allow Mitto to process)
    // Check status after 30 seconds, then again after 2 minutes, then after 5 minutes
    if (campaignId && msgId) {
      try {
        // First check after 30 seconds
        await deliveryStatusQueue.add(
          'update-campaign-status',
          { campaignId },
          {
            delay: 30000, // 30 seconds
            jobId: `status-update-${campaignId}-30s`,
          },
        );

        // Second check after 2 minutes
        await deliveryStatusQueue.add(
          'update-campaign-status',
          { campaignId },
          {
            delay: 120000, // 2 minutes
            jobId: `status-update-${campaignId}-2m`,
          },
        );

        // Final check after 5 minutes
        await deliveryStatusQueue.add(
          'update-campaign-status',
          { campaignId },
          {
            delay: 300000, // 5 minutes
            jobId: `status-update-${campaignId}-5m`,
          },
        );

        logger.info('Queued delivery status update jobs', {
          campaignId,
          msgId,
        });
      } catch (queueError) {
        // Log but don't fail the SMS send if status update queue fails
        logger.warn('Failed to queue delivery status update', {
          campaignId,
          msgId,
          error: queueError.message,
        });
      }
    }

    logger.info('SMS sent successfully via queue', {
      campaignId,
      phoneE164,
      msgId,
    });

    return { ok: true, msgId };
  } catch (err) {
    const errorMessage = err?.message || String(err);
    const errorType =
      err instanceof ValidationError
        ? 'validation'
        : err instanceof MittoApiError
          ? 'api'
          : 'unknown';

    logger.error('SMS send failed via queue', {
      campaignId,
      phoneE164,
      error: errorMessage,
      errorType,
    });

    // If provider was already called (or we have a provider msg id), never throw to retry.
    // Retrying would cause duplicate sends. Schedule a persist repair instead.
    if (providerSucceeded || providerMsgId) {
      logger.error(
        { jobId: job.id, campaignId, phoneE164, providerMsgId, err: errorMessage },
        '[NO-RETRY] Failure after provider call in sendSMS — enqueue persist repair and return',
      );
      if (debug) {
        logger.error(
          {
            tag: 'POST_PERSIST',
            campaignId,
            shopId,
            phoneE164,
            jobId: job.id,
            attempt: job.attemptsMade || 0,
            ok: false,
            providerCalled: true,
            providerMsgId,
            err: errorMessage,
          },
          'POST_PERSIST',
        );
      }
      try {
        const repairKey = `sms:repair:single:${campaignId || 'na'}:${job.id}:${sha256Hex(String(Date.now())).slice(0, 8)}`;
        const ttlSeconds = Number(process.env.SMS_REPAIR_TTL_SECONDS || 24 * 60 * 60);
        const payload = {
          kind: 'single',
          campaignId,
          shopId,
          phoneE164,
          providerMsgId,
          sender,
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
        logger.error({ jobId: job.id, err: repairErr?.message || String(repairErr) }, 'Failed to enqueue single persist repair job');
      }
      return { ok: true, msgId: providerMsgId, postProviderFailure: true };
    }

    // Update existing campaign recipient record with failure status
    const recipient = await prisma.campaignRecipient.findFirst({
      where: {
        campaignId,
        phoneE164,
      },
    });

    if (recipient) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'failed',
          error: errorMessage,
        },
      });
    } else {
      // Fallback: create new record if not found
      await prisma.campaignRecipient.create({
        data: {
          campaignId,
          contactId: null,
          phoneE164,
          status: 'failed',
          error: errorMessage,
        },
      });
    }

    // Create failed message log
    await prisma.messageLog.create({
      data: {
        shopId,
        phoneE164,
        direction: MessageDirection.outbound,
        provider: 'mitto',
        status: MessageStatus.failed,
        error: errorMessage,
        campaignId,
      },
    });

    // Update campaign metrics
    await prisma.campaignMetrics.update({
      where: { campaignId },
      data: { totalFailed: { increment: 1 } },
    });

    throw err;
  }
}

export default { handleMittoSend };
