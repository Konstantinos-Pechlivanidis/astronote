import prisma from '../../services/prisma.js';
import { logger } from '../../utils/logger.js';
import { cacheRedis } from '../../config/redis.js';

/**
 * Persist previously-sent provider results to DB.
 * This job MUST NOT call the provider. It is safe to retry.
 */
export async function handlePersistSmsResults(job) {
  const { repairKey } = job.data || {};
  if (!repairKey) {
    return { ok: false, reason: 'missing_repairKey' };
  }

  const raw = await cacheRedis.get(repairKey);
  if (!raw) {
    logger.warn({ jobId: job.id, repairKey }, 'Repair payload missing/expired; nothing to persist');
    return { ok: true, skipped: true, reason: 'missing_payload' };
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    logger.error({ jobId: job.id, repairKey, err: e?.message || String(e) }, 'Failed to parse repair payload');
    return { ok: false, reason: 'bad_payload' };
  }

  let updated = 0;
  if (payload.kind === 'bulk') {
    const { campaignId, shopId, bulkId, results } = payload;
    const sent = (results || []).filter(r => r.sent && r.messageId && r.internalRecipientId);

    for (const r of sent) {
      const res = await prisma.campaignRecipient.updateMany({
        where: {
          id: r.internalRecipientId,
          campaignId,
          status: 'pending',
          mittoMessageId: null,
        },
        data: {
          mittoMessageId: String(r.messageId),
          bulkId: bulkId || null,
          sentAt: new Date(),
          status: 'sent',
          deliveryStatus: 'Queued',
          error: null,
        },
      });
      updated += res.count || 0;
    }

    logger.info(
      {
        jobId: job.id,
        campaignId,
        shopId,
        bulkId,
        updated,
        sentCount: sent.length,
      },
      'Persist repair completed (bulk)',
    );
  } else if (payload.kind === 'single') {
    const { campaignId, shopId, phoneE164, providerMsgId, sender } = payload;
    if (campaignId && phoneE164 && providerMsgId) {
      const res = await prisma.campaignRecipient.updateMany({
        where: {
          campaignId,
          phoneE164,
          status: 'pending',
          mittoMessageId: null,
        },
        data: {
          mittoMessageId: String(providerMsgId),
          sentAt: new Date(),
          status: 'sent',
          senderNumber: sender || null,
          deliveryStatus: 'Queued',
          error: null,
        },
      });
      updated += res.count || 0;
    }

    logger.info(
      {
        jobId: job.id,
        campaignId,
        shopId,
        phoneE164,
        updated,
      },
      'Persist repair completed (single)',
    );
  } else {
    logger.warn({ jobId: job.id, repairKey, kind: payload.kind }, 'Unsupported repair kind');
    return { ok: false, reason: 'unsupported_kind' };
  }

  try {
    await cacheRedis.del(repairKey);
  } catch {
    // best-effort
  }

  return { ok: true, updated };
}

export default { handlePersistSmsResults };

