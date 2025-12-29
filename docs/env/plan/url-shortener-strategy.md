# URL Shortener Strategy

## Date
2025-01-23

## Overview
This document explains the URL shortener configuration strategy, particularly for backend-driven redirects.

---

## URL_SHORTENER_TYPE Enum Values

The `URL_SHORTENER_TYPE` environment variable accepts the following values:
- `'custom'` - Custom shortener (base64url encoding) OR backend redirects
- `'bitly'` - Bitly API integration
- `'tinyurl'` - TinyURL API integration
- `'none'` - Disabled (returns original URLs)

**Note**: `'backend'` is NOT a valid enum value. Use `'custom'` for backend redirects.

---

## Backend Redirect Implementation

### What is "Backend Redirect"?
Backend redirects use the database-backed `/r/:token` route to redirect short links. This is the recommended approach for production.

### Configuration for Backend Redirects

To use backend redirects (database-backed `/r/:token`):

1. **Set URL_SHORTENER_TYPE to 'custom'**:
   ```bash
   URL_SHORTENER_TYPE=custom
   ```

2. **Set URL_SHORTENER_BASE_URL to your backend URL**:
   ```bash
   # Production
   URL_SHORTENER_BASE_URL=https://astronote-shopify.onrender.com
   
   # Local development
   URL_SHORTENER_BASE_URL=http://localhost:3000
   ```

3. **How it works**:
   - Short links are created in the database via `POST /short-links`
   - Short links use format: `{URL_SHORTENER_BASE_URL}/r/{token}`
   - The `/r/:token` route performs the HTTP redirect
   - Click tracking is handled automatically

### Why "custom" and not "backend"?

The enum validation in `apps/retail-api/src/config/env.js` only allows:
```javascript
URL_SHORTENER_TYPE: z.enum(['custom', 'bitly', 'tinyurl', 'none'])
```

The code in `apps/shopify-api/utils/urlShortener.js` supports `'backend'` as a value, but:
- Retail API Zod schema does NOT allow `'backend'`
- To maintain consistency and avoid validation errors, use `'custom'` for backend redirects
- The implementation is the same: `'custom'` with `URL_SHORTENER_BASE_URL` pointing to backend = backend redirect

---

## Configuration Examples

### Backend Redirects (Recommended)
```bash
URL_SHORTENER_TYPE=custom
URL_SHORTENER_BASE_URL=https://astronote-shopify.onrender.com
```

### Bitly Integration
```bash
URL_SHORTENER_TYPE=bitly
BITLY_API_TOKEN=your_bitly_token
```

### TinyURL Integration
```bash
URL_SHORTENER_TYPE=tinyurl
TINYURL_API_KEY=your_tinyurl_key
```

### Disabled
```bash
URL_SHORTENER_TYPE=none
```

---

## Implementation Details

### Shopify API
- **File**: `apps/shopify-api/utils/urlShortener.js`
- **Supports**: `'backend'`, `'custom'`, `'bitly'`, `'tinyurl'`, `'none'`
- **Note**: Code supports `'backend'` but env.example should use `'custom'` for compatibility

### Retail API
- **File**: `apps/retail-api/src/config/env.js`
- **Schema**: Only allows `['custom', 'bitly', 'tinyurl', 'none']`
- **Validation**: Zod enum validation (strict)

---

## Migration from 'backend' to 'custom'

If you have `URL_SHORTENER_TYPE=custom` in your environment:

1. **Change to `custom`**:
   ```bash
   URL_SHORTENER_TYPE=custom
   ```

2. **Ensure URL_SHORTENER_BASE_URL is set**:
   ```bash
   URL_SHORTENER_BASE_URL=https://astronote-shopify.onrender.com
   ```

3. **No code changes needed** - The behavior is identical

---

## Summary

- ✅ **Use `URL_SHORTENER_TYPE=custom`** for backend redirects
- ✅ **Set `URL_SHORTENER_BASE_URL`** to your backend URL
- ❌ **Do NOT use `URL_SHORTENER_TYPE=custom`** (not validated by retail-api)
- ✅ **Backend redirect = `custom` + base URL pointing to backend**

