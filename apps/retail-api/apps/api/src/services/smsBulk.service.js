// apps/api/src/services/smsBulk.service.js
// Bulk SMS sending service with credit enforcement

const { sendBulkMessages } = require('./mitto.service');
const { getBalance } = require('./wallet.service');
const { isSubscriptionActive, getAllowanceStatus, consumeMessageBilling } = require('./subscription.service');
const pino = require('pino');

const logger = pino({ name: 'sms-bulk-service' });

/**
 * Send bulk SMS with billing enforcement
 * Checks allowance + credits before sending, debits/consumes AFTER successful send
 *
 * @param {Array<Object>} messages - Array of message data objects
 * @param {number} messages[].ownerId - Store owner ID
 * @param {string} messages[].destination - Recipient phone number
 * @param {string} messages[].text - Message text
 * @param {string} [messages[].sender] - Optional sender override
 * @param {string} [messages[].trafficAccountId] - Optional traffic account ID override
 * @param {number} [messages[].contactId] - Optional contact ID for unsubscribe link
 * @param {Object} [messages[].meta] - Optional metadata (campaignId, messageId, etc.)
 * @param {number} messages[].internalMessageId - Internal CampaignMessage.id for mapping response
 * @returns {Promise<Object>} Result with bulkId, results array, and summary
 */
async function sendBulkSMSWithCredits(messages) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array is required and must not be empty');
  }

  // All messages should have the same ownerId for credit checks
  const ownerId = messages[0]?.ownerId;
  if (!ownerId) {
    throw new Error('ownerId is required for all messages');
  }

  // Validate all messages have same ownerId
  for (const msg of messages) {
    if (msg.ownerId !== ownerId) {
      throw new Error('All messages in a batch must have the same ownerId');
    }
  }

  // 1. Check subscription status first
  const subscriptionActive = await isSubscriptionActive(ownerId);
  if (!subscriptionActive) {
    logger.warn({ ownerId, messageCount: messages.length }, 'Inactive subscription - bulk SMS send blocked');
    return {
      bulkId: null,
      results: messages.map(msg => ({
        internalMessageId: msg.internalMessageId,
        sent: false,
        reason: 'subscription_required',
        error: 'Active subscription required to send SMS. Please subscribe to a plan.',
      })),
      summary: {
        total: messages.length,
        sent: 0,
        failed: messages.length,
      },
    };
  }

  // 2. Check allowance + credits before sending
  const allowance = await getAllowanceStatus(ownerId);
  const balance = await getBalance(ownerId);
  const requiredCredits = messages.length;
  const available = (allowance?.remainingThisPeriod || 0) + (balance || 0);

  if (available < requiredCredits) {
    logger.warn({
      ownerId,
      balance,
      allowanceRemaining: allowance?.remainingThisPeriod || 0,
      requiredCredits,
      messageCount: messages.length,
    }, 'Insufficient allowance/credits for bulk SMS send');
    return {
      bulkId: null,
      results: messages.map(msg => ({
        internalMessageId: msg.internalMessageId,
        sent: false,
        reason: 'insufficient_credits',
        balance,
        error: 'Not enough free allowance or credits to send SMS. Please purchase credits or upgrade your subscription.',
      })),
      summary: {
        total: messages.length,
        sent: 0,
        failed: messages.length,
      },
    };
  }

  // 3. Prepare messages for Mitto API
  // Resolve sender for all messages (assuming same sender for batch, or resolve per message)
  const { resolveSender } = require('./mitto.service');
  const TRAFFIC_ACCOUNT_ID = process.env.SMS_TRAFFIC_ACCOUNT_ID || process.env.MITTO_TRAFFIC_ACCOUNT_ID;

  const mittoMessages = [];
  const messageMapping = []; // Maps index in mittoMessages to internal message data

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Resolve sender (use createdById for sender resolution, or ownerId as fallback)
    let finalSender;
    try {
      finalSender = await resolveSender(msg.createdById || ownerId, msg.sender);
    } catch (senderErr) {
      logger.warn({ ownerId, messageIndex: i, err: senderErr.message }, 'Failed to resolve sender, skipping message');
      continue; // Skip this message
    }

    const trafficAccountId = msg.trafficAccountId || TRAFFIC_ACCOUNT_ID;
    if (!trafficAccountId) {
      logger.warn({ ownerId, messageIndex: i }, 'No traffic account ID, skipping message');
      continue; // Skip this message
    }

    mittoMessages.push({
      trafficAccountId,
      destination: msg.destination,
      sms: {
        text: msg.text,
        sender: finalSender,
      },
    });

    messageMapping.push({
      index: mittoMessages.length - 1,
      internalMessageId: msg.internalMessageId,
      ownerId: msg.ownerId,
      destination: msg.destination,
      text: msg.text,
      meta: msg.meta || {},
    });
  }

  if (mittoMessages.length === 0) {
    logger.error({ ownerId }, 'No valid messages to send after preparation');
    return {
      bulkId: null,
      results: messages.map(msg => ({
        internalMessageId: msg.internalMessageId,
        sent: false,
        reason: 'preparation_failed',
        error: 'Message preparation failed',
      })),
      summary: {
        total: messages.length,
        sent: 0,
        failed: messages.length,
      },
    };
  }

  // 4. Check rate limits before sending
  const { checkAllLimits } = require('./rateLimiter.service');
  const trafficAccountId = mittoMessages[0]?.trafficAccountId || TRAFFIC_ACCOUNT_ID;

  const rateLimitCheck = await checkAllLimits(trafficAccountId, ownerId);
  if (!rateLimitCheck.allowed) {
    logger.warn({
      ownerId,
      trafficAccountId,
      trafficAccountRemaining: rateLimitCheck.trafficAccountLimit.remaining,
      tenantRemaining: rateLimitCheck.tenantLimit.remaining,
    }, 'Rate limit exceeded, will retry with backoff (Phase 2.1)');

    // Throw error instead of returning - allows worker to retry with exponential backoff
    // Worker's isRetryable() will recognize this as retryable
    const error = new Error('Rate limit exceeded. Will retry after backoff.');
    error.reason = 'rate_limit_exceeded';
    error.retryable = true; // Explicit flag for clarity
    throw error; // Worker will catch and retry
  }

  // 5. Send bulk SMS via Mitto
  try {
    const result = await sendBulkMessages(mittoMessages);
    if (process.env.DEBUG_SEND_LOGS === '1') {
      logger.info({
        debug: true,
        ownerId,
        campaignId: messages[0]?.meta?.campaignId,
        batchSize: messages.length,
        mittoMessageCount: result.messages?.length,
        internalIds: messages.slice(0, 10).map(m => m.internalMessageId),
      }, '[DEBUG] Mitto response received');
    }

    // 6. Map response messageIds to input messages
    // Response order should match request order
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Create a map of response messageIds by index
    const responseMap = new Map();
    for (let i = 0; i < result.messages.length; i++) {
      const respMsg = result.messages[i];
      if (respMsg.messageId) {
        responseMap.set(i, respMsg);
      }
    }

    // Process each message in our mapping
    for (const mapping of messageMapping) {
      const respMsg = responseMap.get(mapping.index);

      if (respMsg && respMsg.messageId) {
        if (process.env.DEBUG_SEND_LOGS === '1') {
          logger.info({
            debug: true,
            ownerId,
            campaignId: mapping.meta?.campaignId,
            internalMessageId: mapping.internalMessageId,
            providerMessageId: respMsg.messageId,
            mapIndex: mapping.index,
            bulkId: result.bulkId,
          }, '[DEBUG] Mapping accepted messageId');
        }
        // Message sent successfully - consume allowance/credits (idempotent) but never fail the send
        try {
          const billingResult = await consumeMessageBilling(mapping.ownerId, 1, {
            reason: mapping.meta.reason || 'sms:send:bulk',
            campaignId: mapping.meta.campaignId || null,
            messageId: mapping.internalMessageId || null,
            meta: { ...mapping.meta, bulkId: result.bulkId, providerMessageId: respMsg.messageId },
          });

          logger.debug({
            ownerId: mapping.ownerId,
            internalMessageId: mapping.internalMessageId,
            messageId: respMsg.messageId,
            usedAllowance: billingResult.usedAllowance,
            debitedCredits: billingResult.debitedCredits,
            balanceAfter: billingResult.balance,
            alreadyBilled: Boolean(billingResult.alreadyBilled),
          }, 'Billing applied after successful bulk send');

          results.push({
            internalMessageId: mapping.internalMessageId,
            sent: true,
            messageId: respMsg.messageId,
            providerMessageId: respMsg.messageId,
            trafficAccountId: respMsg.trafficAccountId,
            balanceAfter: billingResult.balance ?? balance,
            billingStatus: billingResult.billingStatus || 'paid',
            billedAt: billingResult.billedAt || new Date(),
          });
          successCount++;
        } catch (billingErr) {
          // Log error but don't fail - message was already sent; mark billing pending/failure
          logger.error({
            ownerId: mapping.ownerId,
            internalMessageId: mapping.internalMessageId,
            err: billingErr.message,
          }, 'Failed to bill after successful bulk send');

          results.push({
            internalMessageId: mapping.internalMessageId,
            sent: true,
            messageId: respMsg.messageId,
            providerMessageId: respMsg.messageId,
            trafficAccountId: respMsg.trafficAccountId,
            balanceAfter: balance, // Return original balance if debit failed
            billingStatus: 'failed',
            billingError: billingErr.message,
          });
          successCount++;
        }
      } else {
        // No messageId in response - treat as failure
        logger.error({
          ownerId: mapping.ownerId,
          internalMessageId: mapping.internalMessageId,
          destination: mapping.destination,
        }, 'Mitto bulk send succeeded but no messageId returned for message');

        results.push({
          internalMessageId: mapping.internalMessageId,
          sent: false,
          reason: 'send_failed',
          error: 'Mitto send succeeded but no messageId returned',
        });
        failureCount++;
      }
    }

    if (process.env.DEBUG_SEND_LOGS === '1') {
      logger.info({
        debug: true,
        ownerId,
        campaignId: messages[0]?.meta?.campaignId,
        bulkId: result.bulkId,
        resultsSample: results.slice(0, 10),
      }, '[DEBUG] Bulk results before return');
    }

    // Validate mapping completeness
    const missingInternal = results.filter(r => !r.internalMessageId || !r.messageId).map(r => r.internalMessageId);
    if (missingInternal.length) {
      logger.error({ missingInternal, bulkId: result.bulkId }, 'Bulk send mapping incomplete: missing internalMessageId or messageId');
    }

    // Handle messages that were skipped during preparation
    const processedInternalIds = new Set(messageMapping.map(m => m.internalMessageId));
    for (const msg of messages) {
      if (!processedInternalIds.has(msg.internalMessageId)) {
        results.push({
          internalMessageId: msg.internalMessageId,
          sent: false,
          reason: 'preparation_failed',
          error: 'Message was skipped during preparation',
        });
        failureCount++;
      }
    }

    logger.info({
      ownerId,
      bulkId: result.bulkId,
      total: messages.length,
      sent: successCount,
      failed: failureCount,
    }, 'Bulk SMS send completed');

    return {
      bulkId: result.bulkId,
      results,
      summary: {
        total: messages.length,
        sent: successCount,
        failed: failureCount,
      },
      rawResponse: result.rawResponse,
    };
  } catch (err) {
    // 7. On send failure, do NOT debit credits (no messageId = no debit)
    logger.warn({ ownerId, messageCount: messages.length, err: err.message }, 'Bulk SMS send failed, no credits debited');

    return {
      bulkId: null,
      results: messages.map(msg => ({
        internalMessageId: msg.internalMessageId,
        sent: false,
        reason: 'send_failed',
        error: err.message,
        balanceAfter: balance,
      })),
      summary: {
        total: messages.length,
        sent: 0,
        failed: messages.length,
      },
    };
  }
}

module.exports = {
  sendBulkSMSWithCredits,
};
