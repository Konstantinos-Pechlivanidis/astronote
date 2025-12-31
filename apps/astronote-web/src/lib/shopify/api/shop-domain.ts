/**
 * Shopify Shop Domain Resolver
 * Provides reliable source of truth for shopDomain across the app
 */

export interface ShopInfo {
  shopDomain: string;
  storeId?: number;
  shopName?: string;
  credits?: number;
  currency?: string;
}

/**
 * Decode JWT token payload (client-side, no verification)
 * Safe to use for reading shopDomain from token
 */
function decodeJWT(token: string): any | null {
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(atob(tokenParts[1]));
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Resolve shop domain from available sources
 * Priority:
 * 1. JWT token payload (shopify_token)
 * 2. localStorage shopify_store.shopDomain
 *
 * @returns shopDomain string or null if not found
 */
export function resolveShopDomain(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Primary: Decode JWT token and read shopDomain
  const token = localStorage.getItem('shopify_token');
  if (token) {
    const payload = decodeJWT(token);
    if (payload?.shopDomain) {
      return payload.shopDomain;
    }
  }

  // Fallback: localStorage shopify_store
  const storeInfo = localStorage.getItem('shopify_store');
  if (storeInfo) {
    try {
      const store = JSON.parse(storeInfo);
      if (store.shopDomain) {
        return store.shopDomain;
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  return null;
}

/**
 * Get full shop info from localStorage
 * @returns ShopInfo object or null
 */
export function getShopInfo(): ShopInfo | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storeInfo = localStorage.getItem('shopify_store');
  if (storeInfo) {
    try {
      const store = JSON.parse(storeInfo);
      if (store.shopDomain) {
        return store as ShopInfo;
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  // Try to get from token as fallback
  const token = localStorage.getItem('shopify_token');
  if (token) {
    const payload = decodeJWT(token);
    if (payload?.shopDomain) {
      return {
        shopDomain: payload.shopDomain,
        storeId: payload.storeId,
      };
    }
  }

  return null;
}

/**
 * Check if shop domain is available
 * Used for conditional rendering/guards
 */
export function hasShopDomain(): boolean {
  return resolveShopDomain() !== null;
}

