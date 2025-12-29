# Public URL and CORS Strategy

## Date
2025-01-23

## Overview
This document validates and documents the public URL resolution and CORS configuration for production deployment on Render.

---

## CORS Configuration

### Shopify API CORS

**Location:** `apps/shopify-api/app.js`

**Configuration:**
```javascript
const corsList = process.env.CORS_ALLOWLIST || process.env.ALLOWED_ORIGINS;
const allowedOrigins = [
  'https://admin.shopify.com',
  'https://astronote-shopify-frontend.onrender.com',
  'https://astronote.onrender.com', // Web frontend production domain
  ...(corsList ? corsList.split(',').map(s => s.trim()) : []),
];
```

**Hardcoded Origins:**
- ✅ `https://admin.shopify.com` - Shopify admin (for embedded apps)
- ✅ `https://astronote-shopify-frontend.onrender.com` - Legacy frontend (if still used)
- ✅ `https://astronote.onrender.com` - Unified web frontend

**Dynamic Origins:**
- Reads from `CORS_ALLOWLIST` or `ALLOWED_ORIGINS` env var
- CSV parsing: `split(',').map(s => s.trim())`
- ✅ Strict CSV parsing implemented

**Additional Allowances:**
- ✅ All `*.myshopify.com` subdomains (for storefront theme extensions)
- ✅ Requests with no origin (Postman, server-to-server)

**Required Production Setting:**
```bash
CORS_ALLOWLIST=https://astronote.onrender.com
```

**Note:** `https://astronote.onrender.com` is already hardcoded, but setting `CORS_ALLOWLIST` is recommended for clarity.

---

### Retail API CORS

**Location:** `apps/retail-api/src/server.js`

**Configuration:**
```javascript
const allowlist = (env.CORS_ALLOWLIST || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
```

**Default Addition:**
- Adds `http://localhost:5173` if not in allowlist (development only)

**Required Production Setting:**
```bash
CORS_ALLOWLIST=https://astronote.onrender.com
```

**Verification:**
- ✅ Strict CSV parsing implemented
- ✅ Filters empty strings
- ✅ Trims whitespace

---

## Public URL Resolution Strategy

### Shopify API Base URL

**Location:** `apps/shopify-api/utils/baseUrl.js`

**Priority Order:**
1. **Per-tenant override** (from DB `shop.settings.baseUrl`)
2. **Proxy headers** (`X-Forwarded-Proto`, `X-Forwarded-Host`)
3. **PUBLIC_BASE_URL** env var (canonical)
4. **HOST** env var (fallback)
5. **Request-derived** (from `req.secure` and `req.get('Host')`)
6. **Final fallback:** `http://localhost:8080`

**Proxy Header Support:**
- ✅ `app.set('trust proxy', 1)` enabled
- ✅ Validates `X-Forwarded-Proto` (must be `http` or `https`)
- ✅ Validates `X-Forwarded-Host` (hostname validation)
- ✅ Prevents header injection

**Required Production Setting:**
```bash
HOST=https://astronote-shopify.onrender.com
PUBLIC_BASE_URL=https://astronote-shopify.onrender.com
```

**Note:** `PUBLIC_BASE_URL` is canonical, `HOST` is fallback.

---

### Retail API Base URL

**Location:** `apps/retail-api/src/lib/public-url-resolver.js`

**Priority Order:**
1. **PUBLIC_BASE_URL** env var (canonical)
2. **APP_PUBLIC_BASE_URL** env var
3. **HOST** env var
4. **API_URL** or **API_BASE_URL** env var
5. **NODE_ENV-based default:**
   - Production: `https://astronote-retail-backend.onrender.com`
   - Development: `http://localhost:3001`

**Required Production Setting:**
```bash
APP_PUBLIC_BASE_URL=https://astronote-retail.onrender.com
```

**Note:** `APP_PUBLIC_BASE_URL` is canonical for retail-api.

---

## URL Shortener Configuration

### Backend Redirect Strategy

**For backend redirects (database-backed `/r/:token`):**

**Shopify API:**
```bash
URL_SHORTENER_TYPE=custom
URL_SHORTENER_BASE_URL=https://astronote-shopify.onrender.com
```

**Retail API:**
```bash
URL_SHORTENER_TYPE=custom
URL_SHORTENER_BASE_URL=https://astronote-retail.onrender.com
```

**Why `custom` and not `backend`?**
- Retail API Zod schema only allows: `['custom', 'bitly', 'tinyurl', 'none']`
- `'custom'` with `URL_SHORTENER_BASE_URL` pointing to backend = backend redirect implementation
- See `docs/env/plan/url-shortener-strategy.md` for details

**How it works:**
1. Short links created via `POST /short-links` (stored in database)
2. Short links use format: `{URL_SHORTENER_BASE_URL}/r/{token}`
3. The `/r/:token` route performs HTTP redirect
4. Click tracking handled automatically

---

## Redirect Protection

### Open Redirect Protection

**Shopify API:**
- **Location:** `apps/shopify-api/controllers/shortLinks.js`
- **Protection:** `REDIRECT_ALLOWED_HOSTS` env var
- **Format:** Comma-separated list (supports wildcards like `*.myshopify.com`)

**Example:**
```bash
REDIRECT_ALLOWED_HOSTS=https://example.com,*.myshopify.com
```

**Required Production Setting:**
```bash
REDIRECT_ALLOWED_HOSTS=*.myshopify.com,https://astronote.onrender.com
```

**Note:** If not set, redirects may be blocked for security.

---

## Production Environment Variables Summary

### Shopify API

```bash
# CORS
CORS_ALLOWLIST=https://astronote.onrender.com

# Public URLs
HOST=https://astronote-shopify.onrender.com
PUBLIC_BASE_URL=https://astronote-shopify.onrender.com
FRONTEND_URL=https://astronote.onrender.com

# URL Shortener
URL_SHORTENER_TYPE=custom
URL_SHORTENER_BASE_URL=https://astronote-shopify.onrender.com
REDIRECT_ALLOWED_HOSTS=*.myshopify.com,https://astronote.onrender.com
```

### Retail API

```bash
# CORS
CORS_ALLOWLIST=https://astronote.onrender.com

# Public URLs
APP_PUBLIC_BASE_URL=https://astronote-retail.onrender.com
FRONTEND_URL=https://astronote.onrender.com

# URL Shortener
URL_SHORTENER_TYPE=custom
URL_SHORTENER_BASE_URL=https://astronote-retail.onrender.com
```

---

## Verification

### CORS Verification

**Test from browser console:**
```javascript
fetch('https://astronote-shopify.onrender.com/health', {
  method: 'GET',
  headers: { 'Origin': 'https://astronote.onrender.com' }
})
.then(r => r.json())
.then(console.log);
```

**Expected:** Request succeeds (no CORS error)

### Public URL Verification

**Check base URL resolution:**
```bash
# Shopify API
curl https://astronote-shopify.onrender.com/health/config
# Should show correct HOST/PUBLIC_BASE_URL in response

# Retail API
curl https://astronote-retail.onrender.com/healthz
# Should respond with { status: 'ok' }
```

### URL Shortener Verification

**Test short link creation:**
```bash
# Create short link
curl -X POST https://astronote-shopify.onrender.com/short-links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"destinationUrl": "https://example.com"}'

# Should return: { "shortUrl": "https://astronote-shopify.onrender.com/r/<token>" }
```

**Test redirect:**
```bash
curl -I https://astronote-shopify.onrender.com/r/<token>
# Should return: 302 Found with Location: <destinationUrl>
```

---

## Summary

### ✅ CORS Configuration
- ✅ Shopify API: Hardcoded `https://astronote.onrender.com` + CSV parsing
- ✅ Retail API: CSV parsing from `CORS_ALLOWLIST`
- ✅ Strict CSV parsing implemented (trim, filter empty)

### ✅ Public URL Resolution
- ✅ Shopify API: Proxy headers → `PUBLIC_BASE_URL` → `HOST`
- ✅ Retail API: `APP_PUBLIC_BASE_URL` → `HOST` → defaults
- ✅ Proxy header support with validation

### ✅ URL Shortener
- ✅ Use `URL_SHORTENER_TYPE=custom` for backend redirects
- ✅ Set `URL_SHORTENER_BASE_URL` to backend URL
- ✅ Redirect protection via `REDIRECT_ALLOWED_HOSTS`

---

## Next Steps

1. Set `CORS_ALLOWLIST` in Render dashboard for both APIs
2. Set `HOST` and `PUBLIC_BASE_URL` / `APP_PUBLIC_BASE_URL` in Render dashboard
3. Set `URL_SHORTENER_BASE_URL` and `URL_SHORTENER_TYPE=custom` in Render dashboard
4. Set `REDIRECT_ALLOWED_HOSTS` in Render dashboard (shopify-api)
5. Verify CORS and URL resolution after deployment

