import { logger } from '../utils/logger.js';

/**
 * URL Helper Utilities
 *
 * Provides robust URL construction and validation for Stripe redirects
 * and other external URLs.
 */

/**
 * Normalize base URL
 * - Trims whitespace
 * - Removes trailing slashes
 * - Ensures protocol (http:// or https://)
 * @param {string} input - Base URL input
 * @returns {string|null} Normalized URL or null if invalid
 */
export function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  let normalized = input.trim();

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  // If no protocol, assume https:// (production-safe)
  if (!normalized.match(/^https?:\/\//)) {
    const localhostPattern = /^localhost(:\d+)?$/i;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
    const domainPattern = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(?::\d+)?$/;

    // If it looks like a domain, localhost, or IP, add https://
    if (
      localhostPattern.test(normalized) ||
      ipPattern.test(normalized) ||
      domainPattern.test(normalized)
    ) {
      normalized = `https://${normalized}`;
    } else {
      // Invalid format
      return null;
    }
  }

  return normalized;
}

/**
 * Build a valid absolute URL
 * Uses URL constructor for validation
 * @param {string} base - Base URL (must be absolute)
 * @param {string} path - Path to append
 * @param {Object} query - Optional query parameters
 * @returns {string} Valid absolute URL
 * @throws {Error} If base is not a valid URL
 */
export function buildUrl(base, path, query = null) {
  if (!base) {
    throw new Error('Base URL is required');
  }

  // Normalize base URL
  const normalizedBase = normalizeBaseUrl(base);
  if (!normalizedBase) {
    throw new Error(`Invalid base URL: ${base}`);
  }

  try {
    // Use URL constructor for proper URL building
    const baseUrl = new URL(normalizedBase);

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Combine base and path
    const url = new URL(normalizedPath, baseUrl);

    // Add query parameters if provided
    if (query && typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) {
        if (value !== null && value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  } catch (error) {
    throw new Error(`Failed to build URL from base "${normalizedBase}" and path "${path}": ${error.message}`);
  }
}

/**
 * Validate URL is absolute and valid
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid absolute URL
 */
export function isValidAbsoluteUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    // Must have protocol and hostname
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate and log URL configuration
 * Used at startup to catch configuration errors early
 * @param {string} url - URL to validate
 * @param {string} envVarName - Environment variable name (for error messages)
 * @returns {string|null} Validated URL or null if invalid
 */
export function validateUrlConfig(url, envVarName) {
  if (!url) {
    // Don't log warning here - let caller decide if it's required
    return null;
  }

  const normalized = normalizeBaseUrl(url);
  if (!normalized) {
    logger.error(`Invalid URL in ${envVarName}: "${url}" (must be a valid absolute URL with protocol)`);
    return null;
  }

  if (!isValidAbsoluteUrl(normalized)) {
    logger.error(`Invalid absolute URL in ${envVarName}: "${normalized}"`);
    return null;
  }

  return normalized;
}
