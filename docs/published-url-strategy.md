# Dynamic Published URL Strategy

**Generated**: 2025-01-XX  
**Purpose**: Robust URL generation for tracking links, unsubscribe links, and redirects

## Current State Analysis

### URL Generation Locations

1. **Short Links (URL Shortener)**
   - **Location**: `services/shortLinks.js:createShortLink()`
   - **Current**: Uses `URL_SHORTENER_BASE_URL` env var (backend URL)
   - **Status**: ✅ **IMPLEMENTED** - Database-backed with redirect endpoint

2. **Unsubscribe URLs**
   - **Location**: `utils/unsubscribe.js:generateUnsubscribeUrl()`
   - **Current**: Uses `FRONTEND_URL` env var
   - **Issue**: No dynamic detection, no proxy header support

3. **Tracking URLs**
   - **Location**: `utils/tracking.js` (if exists), campaign message generation
   - **Current**: Uses `FRONTEND_URL` env var
   - **Issue**: No dynamic detection

4. **Stripe Redirect URLs**
   - **Location**: `services/stripe.js`
   - **Current**: Uses `FRONTEND_URL` env var
   - **Issue**: No dynamic detection

5. **OAuth Callback URLs**
   - **Location**: `routes/auth.js`
   - **Current**: Uses `HOST` env var
   - **Issue**: No proxy header support

### Current Issues

1. **No Proxy Header Support**: Behind Render/NGINX, `X-Forwarded-Proto` and `X-Forwarded-Host` not used
2. **Hardcoded URLs**: All URLs come from env vars, no runtime detection
3. **Inconsistent Base URLs**: Different env vars used (`FRONTEND_URL`, `WEB_APP_URL`, `HOST`)
4. **No Per-Tenant Override**: Cannot customize URLs per shop

## Proposed Solution

### 1. Base URL Helper Function

Create `utils/baseUrl.js` with `getBaseUrl(req, shopId?)` function:

```javascript
/**
 * Get base URL for the application
 * Priority:
 * 1. Per-tenant override (from DB, if shopId provided)
 * 2. Proxy headers (X-Forwarded-Proto, X-Forwarded-Host)
 * 3. PUBLIC_BASE_URL env var
 * 4. HOST env var (fallback)
 * 
 * @param {Object} req - Express request object
 * @param {string} shopId - Optional shop ID for tenant-specific URL
 * @returns {Promise<string>} Base URL (e.g., "https://api.example.com")
 */
export async function getBaseUrl(req, shopId = null) {
  // 1. Check per-tenant override (if shopId provided)
  if (shopId) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: { settings: true },
    });
    if (shop?.settings?.baseUrl) {
      return normalizeUrl(shop.settings.baseUrl);
    }
  }

  // 2. Check proxy headers (trust proxy enabled in app.js)
  const forwardedProto = req.get('X-Forwarded-Proto');
  const forwardedHost = req.get('X-Forwarded-Host');
  if (forwardedProto && forwardedHost) {
    // Validate to prevent header injection
    if (isValidProtocol(forwardedProto) && isValidHost(forwardedHost)) {
      return `${forwardedProto}://${forwardedHost}`;
    }
  }

  // 3. Check PUBLIC_BASE_URL env var
  if (process.env.PUBLIC_BASE_URL) {
    return normalizeUrl(process.env.PUBLIC_BASE_URL);
  }

  // 4. Fallback to HOST env var
  if (process.env.HOST) {
    return normalizeUrl(process.env.HOST);
  }

  // 5. Last resort: construct from request
  const protocol = req.secure ? 'https' : 'http';
  const host = req.get('Host') || 'localhost:8080';
  return `${protocol}://${host}`;
}
```

### 2. Frontend URL Helper

Update `utils/frontendUrl.js` to use base URL helper:

```javascript
import { getBaseUrl } from './baseUrl.js';

/**
 * Get frontend base URL
 * Uses getBaseUrl() and normalizes /shopify suffix
 */
export async function getFrontendBaseUrl(req, shopId = null) {
  const baseUrl = await getBaseUrl(req, shopId);
  return normalizeFrontendBaseUrl(baseUrl);
}
```

### 3. Security Validations

Add validation functions to prevent header injection:

```javascript
function isValidProtocol(proto) {
  return proto === 'http' || proto === 'https';
}

function isValidHost(host) {
  // Allow alphanumeric, dots, hyphens, colons (for ports)
  // Reject anything that looks like injection
  const hostRegex = /^[a-zA-Z0-9.-]+(:\d+)?$/;
  return hostRegex.test(host) && host.length <= 255;
}

function normalizeUrl(url) {
  // Remove trailing slashes
  return url.replace(/\/+$/, '');
}
```

### 4. Database Schema Update

Add `baseUrl` field to `ShopSettings`:

```prisma
model ShopSettings {
  // ... existing fields
  baseUrl String? // Optional per-tenant base URL override
}
```

## Implementation Plan

### Phase 1: Core Helper (P0)

1. **Create `utils/baseUrl.js`**
   - Implement `getBaseUrl(req, shopId?)`
   - Add security validations
   - Add tests

2. **Update `utils/frontendUrl.js`**
   - Use `getBaseUrl()` instead of env vars
   - Maintain backward compatibility

3. **Add Database Migration**
   - Add `baseUrl` to `ShopSettings`
   - Default to `null` (use global config)

### Phase 2: Integration (P0)

1. **Update Unsubscribe URL Generation**
   - `utils/unsubscribe.js`: Use `getFrontendBaseUrl(req, shopId)`
   - Pass `req` and `shopId` to generation functions

2. **Update Tracking URL Generation**
   - Campaign message generation: Use `getFrontendBaseUrl(req, shopId)`
   - Click tracking: Use `getBaseUrl(req, shopId)`

3. **Update Stripe Redirect URLs**
   - `services/stripe.js`: Use `getFrontendBaseUrl(req, shopId)`

4. **Update OAuth Callback URLs**
   - `routes/auth.js`: Use `getBaseUrl(req)`

### Phase 3: Testing (P0)

1. **Unit Tests**
   - Test `getBaseUrl()` with various inputs
   - Test proxy header handling
   - Test security validations
   - Test per-tenant override

2. **Integration Tests**
   - Test unsubscribe URL generation
   - Test tracking URL generation
   - Test OAuth callback URL generation

3. **Environment Tests**
   - Test behind proxy (Render/NGINX)
   - Test without proxy (direct)
   - Test with per-tenant override

## Code Changes

### 1. Create `utils/baseUrl.js`

```javascript
import prisma from '../services/prisma.js';
import { logger } from './logger.js';

/**
 * Validate protocol to prevent header injection
 */
function isValidProtocol(proto) {
  return proto === 'http' || proto === 'https';
}

/**
 * Validate host to prevent header injection
 */
function isValidHost(host) {
  // Allow alphanumeric, dots, hyphens, colons (for ports)
  // Reject anything that looks like injection
  const hostRegex = /^[a-zA-Z0-9.-]+(:\d+)?$/;
  return hostRegex.test(host) && host.length <= 255;
}

/**
 * Normalize URL (remove trailing slashes)
 */
function normalizeUrl(url) {
  if (!url) return url;
  return url.trim().replace(/\/+$/, '');
}

/**
 * Get base URL for the application
 * Priority:
 * 1. Per-tenant override (from DB, if shopId provided)
 * 2. Proxy headers (X-Forwarded-Proto, X-Forwarded-Host)
 * 3. PUBLIC_BASE_URL env var
 * 4. HOST env var (fallback)
 * 
 * @param {Object} req - Express request object
 * @param {string} shopId - Optional shop ID for tenant-specific URL
 * @returns {Promise<string>} Base URL (e.g., "https://api.example.com")
 */
export async function getBaseUrl(req, shopId = null) {
  // 1. Check per-tenant override (if shopId provided)
  if (shopId) {
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        include: { settings: true },
      });
      if (shop?.settings?.baseUrl) {
        const url = normalizeUrl(shop.settings.baseUrl);
        logger.debug('Using per-tenant base URL', { shopId, url });
        return url;
      }
    } catch (error) {
      logger.warn('Error fetching shop settings for base URL', {
        shopId,
        error: error.message,
      });
      // Continue to fallback methods
    }
  }

  // 2. Check proxy headers (trust proxy enabled in app.js)
  const forwardedProto = req.get('X-Forwarded-Proto');
  const forwardedHost = req.get('X-Forwarded-Host');
  if (forwardedProto && forwardedHost) {
    // Validate to prevent header injection
    if (isValidProtocol(forwardedProto) && isValidHost(forwardedHost)) {
      const url = `${forwardedProto}://${forwardedHost}`;
      logger.debug('Using proxy header base URL', { url });
      return url;
    } else {
      logger.warn('Invalid proxy headers, ignoring', {
        proto: forwardedProto,
        host: forwardedHost,
      });
    }
  }

  // 3. Check PUBLIC_BASE_URL env var
  if (process.env.PUBLIC_BASE_URL) {
    const url = normalizeUrl(process.env.PUBLIC_BASE_URL);
    logger.debug('Using PUBLIC_BASE_URL env var', { url });
    return url;
  }

  // 4. Fallback to HOST env var
  if (process.env.HOST) {
    const url = normalizeUrl(process.env.HOST);
    logger.debug('Using HOST env var', { url });
    return url;
  }

  // 5. Last resort: construct from request
  const protocol = req.secure ? 'https' : 'http';
  const host = req.get('Host') || 'localhost:8080';
  const url = `${protocol}://${host}`;
  logger.debug('Using request-derived base URL', { url });
  return url;
}

/**
 * Synchronous version for cases where req is not available
 * Uses only env vars (no proxy headers, no per-tenant override)
 */
export function getBaseUrlSync() {
  if (process.env.PUBLIC_BASE_URL) {
    return normalizeUrl(process.env.PUBLIC_BASE_URL);
  }
  if (process.env.HOST) {
    return normalizeUrl(process.env.HOST);
  }
  return 'http://localhost:8080';
}
```

### 2. Update `utils/frontendUrl.js`

```javascript
import { getBaseUrl, getBaseUrlSync } from './baseUrl.js';

// ... existing normalizeFrontendBaseUrl() ...

/**
 * Get frontend base URL (async, uses request context)
 */
export async function getFrontendBaseUrl(req, shopId = null) {
  const baseUrl = await getBaseUrl(req, shopId);
  return normalizeFrontendBaseUrl(baseUrl);
}

/**
 * Get frontend base URL (sync, fallback to env vars)
 */
export function getFrontendBaseUrlSync() {
  const baseUrl = getBaseUrlSync();
  return normalizeFrontendBaseUrl(baseUrl);
}

// ... rest of existing functions ...
```

### 3. Update `utils/unsubscribe.js`

```javascript
import { getFrontendBaseUrl } from './frontendUrl.js';

/**
 * Generate unsubscribe URL (async, uses request context)
 */
export async function generateUnsubscribeUrl(
  contactId,
  shopId,
  phoneE164,
  req, // Add req parameter
) {
  const token = generateUnsubscribeToken(contactId, shopId, phoneE164);
  const baseUrl = await getFrontendBaseUrl(req, shopId);
  return `${baseUrl}/shopify/unsubscribe/${token}`;
}

/**
 * Generate unsubscribe URL (sync, fallback)
 */
export function generateUnsubscribeUrlSync(
  contactId,
  shopId,
  phoneE164,
) {
  const token = generateUnsubscribeToken(contactId, shopId, phoneE164);
  const baseUrl = getFrontendBaseUrlSync();
  return `${baseUrl}/shopify/unsubscribe/${token}`;
}
```

### 4. Update Prisma Schema

```prisma
model ShopSettings {
  // ... existing fields
  baseUrl String? // Optional per-tenant base URL override
}
```

## Environment Variables

### New Variables

- **`PUBLIC_BASE_URL`**: Public-facing base URL (used when proxy headers not available)
  - Example: `https://astronote-shopify-backend.onrender.com`
  - Fallback: Uses `HOST` env var

### Updated Variables

- **`HOST`**: Still used as fallback, but `PUBLIC_BASE_URL` takes precedence
- **`FRONTEND_URL`**: Still used for frontend-specific URLs, but will use `getFrontendBaseUrl()` helper

## Testing Strategy

### Unit Tests

```javascript
// tests/unit/baseUrl.test.js
describe('getBaseUrl', () => {
  it('should use proxy headers when available', async () => {
    const req = {
      get: (header) => {
        if (header === 'X-Forwarded-Proto') return 'https';
        if (header === 'X-Forwarded-Host') return 'api.example.com';
        return null;
      },
    };
    const url = await getBaseUrl(req);
    expect(url).toBe('https://api.example.com');
  });

  it('should reject invalid protocol', async () => {
    const req = {
      get: (header) => {
        if (header === 'X-Forwarded-Proto') return 'javascript:';
        if (header === 'X-Forwarded-Host') return 'api.example.com';
        return null;
      },
    };
    const url = await getBaseUrl(req);
    expect(url).not.toContain('javascript:');
  });

  it('should use per-tenant override when provided', async () => {
    // Mock Prisma
    const req = {};
    const shopId = 'shop123';
    // ... test implementation
  });
});
```

### Integration Tests

- Test unsubscribe URL generation in campaign send flow
- Test tracking URL generation
- Test OAuth callback URL generation

## Migration Guide

### For Existing Deployments

1. **Add `PUBLIC_BASE_URL` env var** (optional, `HOST` still works)
2. **Run database migration** to add `baseUrl` to `ShopSettings`
3. **Deploy code changes**
4. **Verify URLs** in production logs

### For New Deployments

1. Set `PUBLIC_BASE_URL` to public-facing URL
2. Ensure proxy headers are configured (Render/NGINX)
3. Deploy code

## Rollback Plan

If issues occur:

1. Revert code changes
2. System falls back to `HOST` env var (existing behavior)
3. No database changes required (field is nullable)

## Success Criteria

- ✅ URLs work correctly behind proxy (Render/NGINX)
- ✅ URLs work correctly without proxy (direct)
- ✅ Per-tenant override works (if implemented)
- ✅ Security validations prevent header injection
- ✅ Backward compatible with existing env vars

