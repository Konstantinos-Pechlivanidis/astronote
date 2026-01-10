// lib/phone.js
// Phone number validation and normalization using libphonenumber-js
// Aligned with Retail implementation

import { parsePhoneNumber, isValidPhoneNumber, AsYouType } from 'libphonenumber-js';

/**
 * Normalize phone number to E.164 format
 * @param {string} phone - Phone number in any format
 * @param {string} defaultCountry - Default country code (e.g., 'GR', 'US')
 * @returns {string|null} E.164 formatted phone number or null if invalid
 */
export function normalizePhoneToE164(phone, defaultCountry = 'GR') {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  try {
    // Try to parse the phone number
    const phoneNumber = parsePhoneNumber(trimmed, defaultCountry);

    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.number; // Returns E.164 format (e.g., +306984303406)
    }

    return null;
  } catch (err) {
    // If parsing fails, return null
    return null;
  }
}

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @param {string} defaultCountry - Default country code
 * @returns {boolean} True if valid
 */
export function isValidPhone(phone, defaultCountry = 'GR') {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  return isValidPhoneNumber(phone.trim(), defaultCountry);
}

/**
 * Format phone number for display (international format)
 * @param {string} phone - E.164 phone number
 * @returns {string} Formatted phone number
 */
export function formatPhoneForDisplay(phone) {
  if (!phone) {
    return '';
  }
  try {
    const phoneNumber = parsePhoneNumber(phone);
    return phoneNumber.formatInternational();
  } catch {
    return phone;
  }
}

