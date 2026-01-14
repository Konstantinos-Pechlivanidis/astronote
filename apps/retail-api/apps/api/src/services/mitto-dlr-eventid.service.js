/**
 * Retail Mitto DLR eventId normalization
 *
 * Prisma requires WebhookEvent.eventId and uniqueness on (provider,eventId).
 * If Mitto does not provide a stable event id, we generate a deterministic one:
 *   `${providerMessageId}:${deliveryStatus}:${timestampRoundedToMinute}`
 */

function coerceDate(input) {
  const d = input instanceof Date ? input : new Date(input || Date.now());
  return isNaN(d.getTime()) ? new Date() : d;
}

function bucketToMinute(date) {
  const d = coerceDate(date);
  return Math.floor(d.getTime() / 60000);
}

function resolveMittoExplicitEventId(payload) {
  return (
    payload?.eventId ||
    payload?.event_id ||
    payload?.EventId ||
    payload?.eventID ||
    null
  );
}

function resolveMittoDeliveryStatus(payload) {
  return (
    payload?.deliveryStatus ||
    payload?.status ||
    payload?.Status ||
    payload?.dlr_status ||
    payload?.delivery_status ||
    null
  );
}

/**
 * @param {object} payload
 * @param {string} providerMessageId
 * @param {Date|string|number} doneAt
 */
function resolveMittoDlrEventId(payload, providerMessageId, doneAt) {
  const explicit = resolveMittoExplicitEventId(payload);
  if (explicit) {
    return String(explicit);
  }

  const deliveryStatus = resolveMittoDeliveryStatus(payload) || 'unknown';
  const bucket = bucketToMinute(doneAt);
  return `${providerMessageId || 'unknown'}:${deliveryStatus}:${bucket}`;
}

module.exports = {
  resolveMittoDlrEventId,
};


