/**
 * Phone number validation and normalization helpers
 * Backend expects E.164 format (e.g., +306912345678)
 */

/**
 * Validate E.164 phone format
 * E.164 format: +[country code][number] (e.g., +306912345678)
 */
export function isValidE164(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  // E.164: starts with +, followed by 1-15 digits
  return /^\+[1-9]\d{1,14}$/.test(phone.trim());
}

/**
 * Format phone for display (mask for privacy)
 * Shows: +30***1234 (last 4 digits visible)
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  if (phone.length <= 7) return phone;
  const last4 = phone.slice(-4);
  const prefix = phone.slice(0, -4).replace(/\d/g, '*');
  return prefix + last4;
}

