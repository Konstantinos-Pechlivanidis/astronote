# Shopify Auth Callback - Manual Test Steps

**Date:** 2025-01-27  
**Purpose:** Validate the redirect shim route and end-to-end OAuth flow

---

## Test Scenario 1: Valid Token Redirect

### Steps:
1. **Initiate OAuth flow:**
   - Navigate to: `https://astronote.onrender.com/app/shopify/auth/login`
   - Enter shop domain (e.g., `test-shop.myshopify.com`)
   - Click "Connect" or "Log in"

2. **Complete Shopify OAuth:**
   - Complete OAuth flow on Shopify
   - Backend will redirect to: `https://astronote.onrender.com/shopify/auth/callback?token=VALID_JWT`

3. **Verify redirect shim:**
   - ✅ Page should show "Redirecting..." with spinner
   - ✅ Should redirect to: `/app/shopify/auth/callback?token=VALID_JWT`
   - ✅ No 404 errors

4. **Verify token handler:**
   - ✅ Should show "Completing Authentication" message
   - ✅ Should decode JWT and extract `storeId` and `shopDomain`
   - ✅ Should call `/auth/verify` endpoint
   - ✅ Should store token in `localStorage`:
     - Key: `shopify_token` → JWT token
     - Key: `shopify_store` → JSON with `{ id, shopDomain, credits, currency }`

5. **Verify final redirect:**
   - ✅ Should redirect to: `/app/shopify/dashboard`
   - ✅ Dashboard should load with KPIs
   - ✅ No redirect loops

---

## Test Scenario 2: Error Handling

### Steps:
1. **Simulate error:**
   - Navigate to: `https://astronote.onrender.com/shopify/auth/callback?error=Authentication%20failed`

2. **Verify redirect shim:**
   - ✅ Should redirect to: `/app/shopify/auth/callback?error=Authentication%20failed`
   - ✅ No 404 errors

3. **Verify error handler:**
   - ✅ Should show "Authentication Failed" message
   - ✅ Should display error message
   - ✅ Should redirect to: `/app/shopify/auth/login` after 3 seconds

---

## Test Scenario 3: Missing Token/Error

### Steps:
1. **Navigate without params:**
   - Navigate to: `https://astronote.onrender.com/shopify/auth/callback`

2. **Verify redirect:**
   - ✅ Should redirect to: `/app/shopify/auth/login`
   - ✅ No 404 errors

---

## Test Scenario 4: Redirect Loop Prevention

### Steps:
1. **Check browser console:**
   - ✅ No infinite redirect warnings
   - ✅ No "Maximum update depth exceeded" errors

2. **Check network tab:**
   - ✅ Only 2 redirects maximum:
     - `/shopify/auth/callback` → `/app/shopify/auth/callback`
     - `/app/shopify/auth/callback` → `/app/shopify/dashboard`

---

## Expected localStorage State (After Success)

```javascript
// After successful OAuth
localStorage.getItem('shopify_token')
// Should return: JWT token string (e.g., "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")

localStorage.getItem('shopify_store')
// Should return: JSON string (e.g., '{"id":"123","shopDomain":"test-shop.myshopify.com","credits":1000,"currency":"EUR"}')
```

---

## Browser DevTools Checks

### Network Tab:
- ✅ `/shopify/auth/callback?token=...` → 200 OK (redirect shim)
- ✅ `/app/shopify/auth/callback?token=...` → 200 OK (handler)
- ✅ `/api/auth/verify` → 200 OK (token verification)
- ✅ `/app/shopify/dashboard` → 200 OK (final destination)

### Application Tab (Local Storage):
- ✅ `shopify_token` → JWT token
- ✅ `shopify_store` → Store info JSON

### Console:
- ✅ No errors
- ✅ No redirect loop warnings
- ✅ No CORS errors

---

## Edge Cases to Test

1. **Invalid token format:**
   - Navigate to: `/shopify/auth/callback?token=invalid`
   - Should handle gracefully and redirect to login

2. **Expired token:**
   - Use expired JWT token
   - Should fail verification and redirect to login

3. **Malformed query params:**
   - Navigate to: `/shopify/auth/callback?token=&error=`
   - Should redirect to login

---

## Success Criteria

✅ **All scenarios pass:**
- Redirect shim works correctly
- Token is stored in localStorage
- Store info is extracted and stored
- Final redirect to dashboard works
- No redirect loops
- Error handling works correctly

---

## Rollback Plan

If issues occur:
1. Remove: `apps/astronote-web/app/shopify/auth/callback/page.tsx`
2. Update backend `WEB_APP_URL` to point to `/app/shopify/auth/callback` directly
3. Redeploy backend

---

**Status:** Ready for testing

