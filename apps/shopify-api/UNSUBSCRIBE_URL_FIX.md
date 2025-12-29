# Unsubscribe URL Fix

**Date**: December 13, 2025  
**Issue**: Unsubscribe links leading to 404 errors

## Problem

The unsubscribe URL generation was creating incorrect URLs when the `FRONTEND_URL` environment variable included the `/shopify` suffix.

### Root Cause

1. **Frontend Route**: `/shopify/unsubscribe/:token` (defined in `App.jsx`)
2. **Backend URL Generation**: `${baseUrl}/shopify/unsubscribe/${token}`
3. **Issue**: If `FRONTEND_URL` was set to `https://astronote-shopify-frontend.onrender.com/shopify`, the code would create:
   - `https://astronote-shopify-frontend.onrender.com/shopify/shopify/unsubscribe/${token}` (double `/shopify`)
4. **Expected**: `https://astronote-shopify-frontend.onrender.com/shopify/unsubscribe/${token}`

## Solution

### 1. Created Frontend URL Utility (`utils/frontendUrl.js`)

- **`normalizeFrontendBaseUrl(baseUrl)`**: Removes trailing `/shopify` suffix if present
- **`getFrontendBaseUrl()`**: Gets and normalizes frontend URL from environment variables
- **`buildFrontendUrl(path, baseUrl)`**: Builds frontend URLs consistently, ensuring `/shopify` prefix is added correctly

### 2. Updated Unsubscribe URL Generation

**File**: `utils/unsubscribe.js`

- Now uses `normalizeFrontendBaseUrl()` to handle base URLs with or without `/shopify`
- Always generates: `${normalizedBaseUrl}/shopify/unsubscribe/${token}`

### 3. Updated Subscription URLs

**File**: `controllers/subscriptions.js`

- Updated billing success/cancel URLs to use `buildFrontendUrl()`
- Updated customer portal return URL to use `buildFrontendUrl()`
- Prevents double `/shopify` paths in subscription redirects

## Testing

### Test Cases

1. **FRONTEND_URL without /shopify**:
   - Input: `https://astronote-shopify-frontend.onrender.com`
   - Output: `https://astronote-shopify-frontend.onrender.com/shopify/unsubscribe/${token}` ✅

2. **FRONTEND_URL with /shopify**:
   - Input: `https://astronote-shopify-frontend.onrender.com/shopify`
   - Normalized: `https://astronote-shopify-frontend.onrender.com`
   - Output: `https://astronote-shopify-frontend.onrender.com/shopify/unsubscribe/${token}` ✅

3. **FRONTEND_URL with trailing slash**:
   - Input: `https://astronote-shopify-frontend.onrender.com/`
   - Normalized: `https://astronote-shopify-frontend.onrender.com`
   - Output: `https://astronote-shopify-frontend.onrender.com/shopify/unsubscribe/${token}` ✅

## Files Changed

1. ✅ `utils/frontendUrl.js` - **NEW** - Frontend URL utilities
2. ✅ `utils/unsubscribe.js` - Updated to use URL normalization
3. ✅ `controllers/subscriptions.js` - Updated to use `buildFrontendUrl()`

## Environment Variables

**Recommended**: Set `FRONTEND_URL` to the root domain (without `/shopify`):
```env
FRONTEND_URL=https://astronote-shopify-frontend.onrender.com
```

The code now handles both cases correctly, but using the root domain is recommended for consistency.

## Verification

After deployment, verify unsubscribe links work by:
1. Sending a test campaign
2. Checking the SMS message for the unsubscribe link
3. Clicking the link - should navigate to `/shopify/unsubscribe/${token}` (not 404)

## Related Routes

- **Backend**: `/unsubscribe/:token` (public, no auth)
- **Frontend**: `/shopify/unsubscribe/:token` (public page)
- **CORS**: `https://astronote-shopify-frontend.onrender.com` is allowed in `app.js`
