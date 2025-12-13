/**
 * Frontend URL Utilities
 *
 * Helper functions for generating frontend URLs consistently.
 * Handles normalization of base URLs that may or may not include /shopify suffix.
 */

/**
 * Normalize frontend base URL
 * Removes trailing /shopify if present to avoid double paths
 * @param {string} baseUrl - Base URL (may or may not include /shopify)
 * @returns {string} Normalized base URL without /shopify suffix
 */
export function normalizeFrontendBaseUrl(baseUrl) {
  if (!baseUrl) return baseUrl;

  // Remove trailing slash
  let normalized = baseUrl.trim().replace(/\/+$/, '');

  // Remove /shopify suffix if present (to avoid double /shopify in final URL)
  if (normalized.endsWith('/shopify')) {
    normalized = normalized.slice(0, -8); // Remove '/shopify' (8 chars)
  }

  return normalized;
}

/**
 * Get frontend base URL from environment variables
 * Normalizes the URL to remove /shopify suffix if present
 * @returns {string} Normalized frontend base URL
 */
export function getFrontendBaseUrl() {
  const baseUrl =
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_BASE_URL ||
    process.env.WEB_APP_URL ||
    'https://astronote-shopify-frontend.onrender.com';

  return normalizeFrontendBaseUrl(baseUrl);
}

/**
 * Build a frontend URL path
 * Ensures the path starts with /shopify if it's an app route
 * @param {string} path - Path to append (e.g., '/app/billing' or 'app/billing')
 * @param {string} baseUrl - Optional base URL (defaults to env var)
 * @returns {string} Full frontend URL
 */
export function buildFrontendUrl(path, baseUrl = null) {
  const normalizedBase = baseUrl
    ? normalizeFrontendBaseUrl(baseUrl)
    : getFrontendBaseUrl();

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // If path doesn't start with /shopify, add it for app routes
  // (assuming all app routes are under /shopify)
  const finalPath = normalizedPath.startsWith('/shopify')
    ? normalizedPath
    : `/shopify${normalizedPath}`;

  return `${normalizedBase}${finalPath}`;
}
