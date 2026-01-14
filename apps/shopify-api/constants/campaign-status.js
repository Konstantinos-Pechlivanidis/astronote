/**
 * Shopify Campaign Statuses — canonical contract
 *
 * Source of truth for the Shopify campaign status vocabulary used by:
 * - Prisma enum `CampaignStatus` (DB stores these values)
 * - Backend API DTO normalization (prefer `completed` over legacy `sent`)
 * - Frontend generated mirror constants
 *
 * Notes:
 * - `sent` is a legacy alias kept for backward compatibility in DB and older clients.
 * - API should *normalize* `sent` -> `completed` while still accepting `sent` as input.
 */

export const CAMPAIGN_STATUS_VALUES = Object.freeze([
  'draft',
  'scheduled',
  'sending',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'sent', // legacy alias for completed
]);

export const CAMPAIGN_STATUS_SET = new Set(CAMPAIGN_STATUS_VALUES);

export function isCampaignStatus(value) {
  return typeof value === 'string' && CAMPAIGN_STATUS_SET.has(value);
}

/**
 * Normalize persisted/legacy status into the canonical API status.
 * - `sent` -> `completed`
 * - unknown -> passthrough (caller may choose to fallback)
 */
export function normalizeCampaignStatus(rawStatus) {
  if (rawStatus === 'sent') {
    return { status: 'completed', statusRaw: 'sent', legacy: true };
  }
  if (typeof rawStatus === 'string' && rawStatus) {
    return { status: rawStatus, statusRaw: rawStatus, legacy: false };
  }
  return { status: 'draft', statusRaw: rawStatus ?? null, legacy: false };
}


