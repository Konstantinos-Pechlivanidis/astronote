# Stripe Subscription "Not a valid URL" Fix

**Date:** 2025-01-30  
**Status:** PASS **FIXED**

## Problem

Stripe checkout session creation was failing with:
- **Error:** `400 STRIPE_ERROR "Stripe error: Not a valid URL"`
- **Endpoint:** `POST /subscriptions/subscribe`
- **Payload:** `{ planType: "pro" }`

## Root Cause

The issue was in `apps/shopify-api/utils/frontendUrl.js`:
1. **Line 73:** `buildFrontendUrl()` was calling `getFrontendBaseUrl()` without `await` and without the required `req` parameter
2. **Result:** `getFrontendBaseUrl()` returned `undefined` or an invalid value
3. **URL Construction:** Invalid base URL led to invalid `success_url` and `cancel_url` passed to Stripe
4. **Stripe Rejection:** Stripe requires absolute URLs with `https://` protocol

## Solution

### 1. Created URL Helper Utilities (`apps/shopify-api/utils/url-helpers.js`)

**New Functions:**
- `normalizeBaseUrl(input)` - Normalizes base URLs, adds `https://` if missing
- `buildUrl(base, path, query)` - Builds valid absolute URLs using URL constructor
- `isValidAbsoluteUrl(url)` - Validates URLs are absolute with protocol
- `validateUrlConfig(url, envVarName)` - Validates and logs URL config at startup

**Key Features:**
- Automatically adds `https://` to domains without protocol
- Uses `URL` constructor for robust URL building
- Validates absolute URLs before passing to Stripe
- Provides clear error messages

### 2. Fixed `buildFrontendUrl()` (`apps/shopify-api/utils/frontendUrl.js`)

**Changes:**
- Now uses `getFrontendBaseUrlSync()` instead of async `getFrontendBaseUrl()`
- Validates base URL using `normalizeBaseUrl()` and `isValidAbsoluteUrl()`
- Uses `buildUrl()` for robust URL construction
- Throws clear errors if base URL is invalid

**Before:**
```javascript
export function buildFrontendUrl(path, baseUrl = null) {
  const normalizedBase = baseUrl
    ? normalizeFrontendBaseUrl(baseUrl)
    : getFrontendBaseUrl(); // FAIL Missing await, missing req parameter
  return `${normalizedBase}${finalPath}`; // FAIL Could be undefined
}
```

**After:**
```javascript
export function buildFrontendUrl(path, baseUrl = null, query = null) {
  const base = baseUrl || getFrontendBaseUrlSync(); // PASS Sync function
  const validBase = normalizeBaseUrl(normalizedBase); // PASS Validates
  return buildUrl(validBase, finalPath, query); // PASS Robust construction
}
```

### 3. Updated Subscribe Controller (`apps/shopify-api/controllers/subscriptions.js`)

**Changes:**
- Uses `buildFrontendUrl()` with query parameters object
- Validates URLs before passing to Stripe (fail fast)
- Enhanced error handling for URL configuration errors
- Returns `500 CONFIG_ERROR` for invalid URLs (not `400 STRIPE_ERROR`)

**Before:**
```javascript
const baseUrl = buildFrontendUrl(
  '/app/billing/success?session_id={CHECKOUT_SESSION_ID}&type=subscription',
); // FAIL Query string in path
const successUrl = baseUrl; // FAIL Could be invalid
```

**After:**
```javascript
const successUrl = buildFrontendUrl('/app/billing/success', null, {
  session_id: '{CHECKOUT_SESSION_ID}',
  type: 'subscription',
}); // PASS Query as object
// PASS Validated before Stripe call
```

### 4. Enhanced Stripe Service (`apps/shopify-api/services/stripe.js`)

**Changes:**
- Validates `successUrl` and `cancelUrl` before Stripe API call
- Enhanced error logging with URL diagnostics
- Specific error handling for "Not a valid URL" errors
- Logs frontend URL config (without secrets) for debugging

**Error Handling:**
```javascript
if (err.message?.includes('Not a valid URL') || err.param?.includes('url')) {
  throw new Error(
    `Stripe error: Invalid URL in ${err.param || 'redirect URL'}. Success URL: ${successUrl}, Cancel URL: ${cancelUrl}. Please check FRONTEND_URL configuration.`,
  );
}
```

### 5. Added Startup Validation (`apps/shopify-api/config/env-validation.js`)

**Changes:**
- Validates `FRONTEND_URL` at startup (fail fast)
- Checks for missing Stripe price IDs
- Logs clear warnings/errors for configuration issues
- Production: errors for invalid URLs
- Development: warnings only

### 6. Added Unit Tests

**Files:**
- `apps/shopify-api/tests/unit/url-helpers.test.js` - URL helper functions
- `apps/shopify-api/tests/unit/stripe-subscription.test.js` - Price ID resolution

**Coverage:**
- URL normalization (adds https://, removes trailing slashes)
- URL building with query parameters
- Absolute URL validation
- Price ID resolution (planType + currency -> env var)

## Files Changed

### Created
1. `apps/shopify-api/utils/url-helpers.js` - URL helper utilities
2. `apps/shopify-api/tests/unit/url-helpers.test.js` - URL helper tests
3. `apps/shopify-api/tests/unit/stripe-subscription.test.js` - Subscription tests

### Modified
1. `apps/shopify-api/utils/frontendUrl.js` - Fixed `buildFrontendUrl()` to use sync function and validate URLs
2. `apps/shopify-api/controllers/subscriptions.js` - Enhanced URL validation and error handling
3. `apps/shopify-api/services/stripe.js` - Added URL validation before Stripe calls
4. `apps/shopify-api/config/env-validation.js` - Added startup URL validation

## Environment Variables

### Required for Stripe Subscriptions

**Frontend URL (one of these):**
- `FRONTEND_URL` (preferred)
- `FRONTEND_BASE_URL`
- `WEB_APP_URL`

**Example:**
```bash
FRONTEND_URL=https://astronote.onrender.com
```

**Stripe Price IDs:**
- `STRIPE_PRICE_ID_SUB_STARTER_EUR` (required)
- `STRIPE_PRICE_ID_SUB_PRO_EUR` (required)
- `STRIPE_PRICE_ID_SUB_STARTER_USD` (optional)
- `STRIPE_PRICE_ID_SUB_PRO_USD` (optional)

**Example:**
```bash
STRIPE_PRICE_ID_SUB_STARTER_EUR=price_starter_eur_123
STRIPE_PRICE_ID_SUB_PRO_EUR=price_pro_eur_456
```

## Error Messages

### Before Fix
- Generic: `"Stripe error: Not a valid URL"`
- No indication of which URL was invalid
- No guidance on how to fix

### After Fix
- **Config Error:** `"Invalid frontend URL configuration. Success URL is not valid: [url]. Please set FRONTEND_URL environment variable to a valid absolute URL (e.g., https://astronote.onrender.com)."`
- **Stripe Error:** `"Stripe error: Invalid URL in success_url. Success URL: [url], Cancel URL: [url]. Please check FRONTEND_URL configuration."`
- **Startup Warning:** `"FRONTEND_URL is invalid: "[url]". Stripe checkout will fail. Please set a valid absolute URL."`

## Testing

### Unit Tests
- PASS URL normalization (adds https://, removes trailing slashes)
- PASS URL building with query parameters
- PASS Absolute URL validation
- PASS Price ID resolution (pro + EUR -> STRIPE_PRICE_ID_SUB_PRO_EUR)

### Manual Testing
1. **Valid FRONTEND_URL:** Should create checkout session successfully
2. **Missing FRONTEND_URL:** Should return 500 CONFIG_ERROR with clear message
3. **Invalid FRONTEND_URL (no https://):** Should normalize to https://
4. **Invalid FRONTEND_URL (empty):** Should return 500 CONFIG_ERROR

## Expected Behavior After Fix

### Success Case
```bash
POST /subscriptions/subscribe
Body: { "planType": "pro" }

Response: 201
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_test_...",
  "planType": "pro",
  "currency": "EUR"
}
```

### Error Cases

**Missing FRONTEND_URL:**
```json
{
  "success": false,
  "error": "CONFIG_ERROR",
  "message": "Invalid frontend URL configuration. Success URL is not valid: undefined. Please set FRONTEND_URL environment variable..."
}
```

**Invalid FRONTEND_URL:**
```json
{
  "success": false,
  "error": "CONFIG_ERROR",
  "message": "Frontend base URL is not a valid absolute URL: \"astronote.onrender.com\". Must include protocol (https://) and hostname."
}
```

## Verification

### Check Environment Variables
```bash
# Check if FRONTEND_URL is set and valid
echo $FRONTEND_URL
# Should output: https://astronote.onrender.com (or similar)

# Check Stripe price IDs
echo $STRIPE_PRICE_ID_SUB_PRO_EUR
# Should output: price_... (Stripe price ID)
```

### Test Endpoint
```bash
curl -X POST https://astronote-shopify.onrender.com/subscriptions/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "X-Shopify-Shop-Domain: <shop>.myshopify.com" \
  -d '{"planType": "pro"}'
```

## Summary

PASS **Root Cause:** `buildFrontendUrl()` was calling async function without await, returning invalid URLs  
PASS **Fix:** Use sync function, validate URLs, normalize base URLs  
PASS **Validation:** Startup validation catches config errors early  
PASS **Error Handling:** Clear error messages with diagnostics  
PASS **Tests:** Unit tests for URL helpers and price ID resolution  

**The Stripe subscription endpoint now validates URLs before sending to Stripe and provides clear error messages for configuration issues.**

