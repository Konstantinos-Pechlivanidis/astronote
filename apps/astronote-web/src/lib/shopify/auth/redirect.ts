/**
 * Redirect Utilities for Shopify App
 * Handles top-level redirects (OAuth) and internal navigation
 */

/**
 * Top-level redirect (breaks out of iframe)
 * Use for OAuth, logout, external redirects
 * @param url - URL to redirect to
 */
export function topLevelRedirect(url: string): void {
  if (typeof window !== 'undefined') {
    if (window.top) {
      window.top.location.href = url;
    } else {
      window.location.href = url;
    }
  }
}

/**
 * Internal navigation (within app)
 * Use for same-origin page navigation
 * @param path - Path to navigate to
 * @param router - Next.js router instance
 */
export function internalNavigate(path: string, router: { push: (_p: string) => void }): void {
  router.push(path);
}

