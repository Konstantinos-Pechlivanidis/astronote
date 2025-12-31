/**
 * Shopify Session Token Utilities
 * Get session token from Shopify App Bridge (embedded iframe context)
 */

/**
 * Get session token from Shopify App Bridge
 * @returns Session token string or null if not available
 */
export function getShopifySessionToken(): string | null {
  // In embedded iframe context
  if (typeof window !== 'undefined' && (window as any).shopify?.sessionToken) {
    return (window as any).shopify.sessionToken;
  }
  return null;
}

/**
 * Check if we're in embedded Shopify context
 * @returns true if session token is available
 */
export function isEmbeddedShopifyApp(): boolean {
  return getShopifySessionToken() !== null;
}

