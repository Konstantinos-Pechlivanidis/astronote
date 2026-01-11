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
    const payload = tokenParts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(tokenParts[1].length / 4) * 4, '=');
    return JSON.parse(atob(payload));
  } catch (error) {
    return null;
  }
}

/**
 * Validate shop domain format
 * @param domain - Shop domain to validate
 * @returns True if valid format
 */
function isValidShopDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }
  // Must match: alphanumeric, hyphens, ending with .myshopify.com
  const shopDomainPattern = /^[a-zA-Z0-9-]+\.myshopify\.com$/;
  return shopDomainPattern.test(domain.trim());
}

/**
 * Normalize shop domain (add .myshopify.com if missing)
 * @param domain - Shop domain to normalize
 * @returns Normalized domain or null if invalid
 */
function normalizeShopDomain(domain: string): string | null {
  if (!domain || typeof domain !== 'string') {
    return null;
  }
  const trimmed = domain.trim();
  if (!trimmed) {
    return null;
  }
  // If already has .myshopify.com, validate and return
  if (trimmed.includes('.')) {
    return isValidShopDomain(trimmed) ? trimmed : null;
  }
  // Add .myshopify.com suffix
  const normalized = `${trimmed}.myshopify.com`;
  return isValidShopDomain(normalized) ? normalized : null;
}

/**
 * Get shop domain from Shopify App Bridge embedded context
 * @returns shopDomain string or null if not available
 */
function getShopDomainFromAppBridge(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check App Bridge context for shop domain
  const shopify = (window as any).shopify;
  if (shopify) {
    // App Bridge may provide shop domain in config or context
    if (shopify.config?.shop) {
      const normalized = normalizeShopDomain(shopify.config.shop);
      if (normalized) {
        return normalized;
      }
    }
    // Some App Bridge versions provide shop in different locations
    if (shopify.shop) {
      const normalized = normalizeShopDomain(shopify.shop);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

/**
 * Resolve shop domain from available sources
 * Priority (per requirements):
 * 1. Embedded context / App Bridge (if available)
 * 2. URL query param `shop` (validated, *.myshopify.com)
 * 3. sessionStorage fallback (validated)
 * 4. localStorage fallback (validated)
 * 5. JWT token payload (shopify_token) - shopDomain field (final fallback)
 *
 * @returns shopDomain string or null if not found
 */
export function resolveShopDomain(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Priority 1: Embedded context / App Bridge (if available)
  const appBridgeShop = getShopDomainFromAppBridge();
  if (appBridgeShop) {
    // Store it for future use
    try {
      sessionStorage.setItem('shopify_shop_domain', appBridgeShop);
      const existingStore = localStorage.getItem('shopify_store');
      const store = existingStore ? JSON.parse(existingStore) : {};
      localStorage.setItem('shopify_store', JSON.stringify({
        ...store,
        shopDomain: appBridgeShop,
      }));
    } catch (e) {
      // Storage may not be available, continue
    }
    return appBridgeShop;
  }

  // Priority 2: URL query param `shop` (validated, *.myshopify.com)
  // Only check if we're on a redirect/callback route to avoid security issues
  const currentPath = window.location.pathname;
  const isRedirectRoute =
    currentPath.includes('/auth/callback') ||
    currentPath.includes('/auth/login') ||
    currentPath.includes('/auth/shopify') ||
    currentPath.includes('/auth/shopify-token');

  if (isRedirectRoute) {
    const urlParams = new URLSearchParams(window.location.search);
    const queryShop = urlParams.get('shop') || urlParams.get('shop_domain');
    if (queryShop) {
      const normalized = normalizeShopDomain(queryShop);
      if (normalized) {
        // Store it immediately for future API calls
        try {
          sessionStorage.setItem('shopify_shop_domain', normalized);
          const existingStore = localStorage.getItem('shopify_store');
          const store = existingStore ? JSON.parse(existingStore) : {};
          localStorage.setItem('shopify_store', JSON.stringify({
            ...store,
            shopDomain: normalized,
          }));
        } catch (e) {
          // If storage failed, still return the domain
        }
        return normalized;
      }
    }
  }

  // Priority 3: sessionStorage fallback (validated)
  try {
    const sessionShop = sessionStorage.getItem('shopify_shop_domain');
    if (sessionShop) {
      const normalized = normalizeShopDomain(sessionShop);
      if (normalized) {
        return normalized;
      }
    }
  } catch (e) {
    // sessionStorage may not be available, continue
  }

  // Priority 4: localStorage fallback (validated)
  const storeInfo = localStorage.getItem('shopify_store');
  if (storeInfo) {
    try {
      const store = JSON.parse(storeInfo);
      if (store.shopDomain) {
        const normalized = normalizeShopDomain(store.shopDomain);
        if (normalized) {
          return normalized;
        }
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  // Priority 5: JWT token payload (shopify_token) - shopDomain field (final fallback)
  const token = localStorage.getItem('shopify_token');
  if (token) {
    const payload = decodeJWT(token);
    if (payload?.shopDomain) {
      const normalized = normalizeShopDomain(payload.shopDomain);
      if (normalized) {
        // Store it for future use
        try {
          sessionStorage.setItem('shopify_shop_domain', normalized);
          const existingStore = storeInfo ? JSON.parse(storeInfo) : {};
          localStorage.setItem('shopify_store', JSON.stringify({
            ...existingStore,
            shopDomain: normalized,
          }));
        } catch (e) {
          // Storage may not be available, continue
        }
        return normalized;
      }
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
