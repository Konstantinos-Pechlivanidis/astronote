/**
 * Phone number validation and normalization helpers
 * Backend expects E.164 format (e.g., +306912345678)
 */

/**
 * Validate E.164 phone format
 * E.164 format: +[country code][number] (e.g., +306912345678)
 */
export function isValidE164(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // E.164: starts with +, followed by 1-15 digits
  return /^\+[1-9]\d{1,14}$/.test(phone.trim());
}

/**
 * Normalize phone input to E.164 format
 * Accepts various formats and attempts to normalize
 * Returns null if invalid
 */
export function normalizeToE164(phone) {
  if (!phone || typeof phone !== 'string') return null;
  
  const cleaned = phone.trim().replace(/\s+/g, '');
  
  // Already in E.164 format
  if (isValidE164(cleaned)) {
    return cleaned;
  }
  
  // Remove common separators
  const withoutSeparators = cleaned.replace(/[-()]/g, '');
  
  // If starts with 00, replace with +
  if (withoutSeparators.startsWith('00')) {
    const withPlus = '+' + withoutSeparators.substring(2);
    if (isValidE164(withPlus)) {
      return withPlus;
    }
  }
  
  // If doesn't start with +, try to add country code
  // For now, return null - let backend handle normalization
  // Frontend should guide user to enter with country code
  return null;
}

/**
 * Format phone for display (mask for privacy)
 * Shows: +30***1234 (last 4 digits visible)
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  if (phone.length <= 7) return phone;
  const last4 = phone.slice(-4);
  const prefix = phone.slice(0, -4).replace(/\d/g, '*');
  return prefix + last4;
}

