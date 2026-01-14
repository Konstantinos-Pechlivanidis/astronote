/**
 * Shopify campaign delivery metrics — canonical semantics
 *
 * Provider (Mitto) is the source of truth for `deliveryStatus`.
 * DB mirrors provider state via:
 * - CampaignRecipient.mittoMessageId (accepted by provider)
 * - CampaignRecipient.deliveryStatus (provider status vocab)
 * - CampaignRecipient.status (our terminal-ish state: pending/sent/failed)
 */

export const MITTO_DELIVERED_STATUSES = Object.freeze([
  'delivered',
  'delivrd',
  'completed',
  'ok',
]);

export const MITTO_FAILED_STATUSES = Object.freeze([
  'failure',
  'failed',
  'undelivered',
  'expired',
  'rejected',
  'error',
]);

function toTitleCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * DeliveryStatus values are persisted in DB as whatever Mitto sends (often TitleCase).
 * For DB queries, match both normalized and TitleCase variants.
 */
export const MITTO_DELIVERED_STATUS_DB_VALUES = Object.freeze([
  ...MITTO_DELIVERED_STATUSES,
  ...MITTO_DELIVERED_STATUSES.map(toTitleCase),
]);

export const MITTO_FAILED_STATUS_DB_VALUES = Object.freeze([
  ...MITTO_FAILED_STATUSES,
  ...MITTO_FAILED_STATUSES.map(toTitleCase),
]);

export function normalizeMittoDeliveryStatus(value) {
  if (!value) return null;
  return String(value).toLowerCase().trim();
}

export function isDeliveredDeliveryStatus(deliveryStatus) {
  const v = normalizeMittoDeliveryStatus(deliveryStatus);
  return !!v && MITTO_DELIVERED_STATUSES.includes(v);
}

export function isFailedDeliveryStatus(deliveryStatus) {
  const v = normalizeMittoDeliveryStatus(deliveryStatus);
  return !!v && MITTO_FAILED_STATUSES.includes(v);
}

/**
 * Build canonical totals/delivery fields given raw counts.
 *
 * Definitions:
 * - recipients: total recipients in the campaign
 * - accepted: Mitto accepted (mittoMessageId present)
 * - delivered: deliveryStatus indicates Delivered (provider truth)
 * - failed: recipient terminal failure (our status='failed' OR provider failed deliveryStatus)
 * - pendingDelivery: accepted - delivered - failedDelivery
 */
export function buildCanonicalCampaignMetrics({
  recipients = 0,
  accepted = 0,
  delivered = 0,
  failed = 0,
}) {
  const safeRecipients = Math.max(0, Number(recipients || 0));
  const safeAccepted = Math.max(0, Number(accepted || 0));
  const safeDelivered = Math.max(0, Number(delivered || 0));
  const safeFailed = Math.max(0, Number(failed || 0));

  const pendingDelivery = Math.max(safeAccepted - safeDelivered - safeFailed, 0);

  return {
    totals: {
      recipients: safeRecipients,
      accepted: safeAccepted,
      sent: safeAccepted, // explicit: “sent” == provider accepted + DB persisted id (same as accepted)
      delivered: safeDelivered,
      failed: safeFailed,
    },
    delivery: {
      pendingDelivery,
      delivered: safeDelivered,
      failedDelivery: safeFailed,
    },
    sourceOfTruth: 'mitto',
  };
}


