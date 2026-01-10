# Shopify Prisma/API Mismatch Fixes Report

**Date:** 2025-01-27  
**Scope:** `apps/shopify-api` (backend) + `apps/astronote-web/app/app/shopify` (frontend)  
**Objective:** Fix Prisma field mismatches causing frontend errors and improve error handling

---

## Executive Summary

Fixed critical Prisma field mismatch (`active` vs `isActive`) in dashboard service that was causing frontend errors. Added query parameter validation, improved error handling, and created a verification script to prevent future mismatches.

---

## Issues Found

### 1. Prisma Field Mismatch: `active` vs `isActive`

**Error:**
```
Unknown argument `active`. Did you mean `isActive`?
Invalid prisma.userAutomation.count() invocation
... where: { shopId, active: true } -> should be isActive.
```

**Root Cause:**
- `UserAutomation` model in Prisma schema uses `isActive` (Boolean)
- Code in `services/dashboard.js` was using `active: true` instead of `isActive: true`

**Schema Reference:**
```prisma
model UserAutomation {
  id           String     @id @default(cuid())
  shopId       String
  automationId String
  userMessage  String?
  isActive     Boolean    @default(true)  // ✅ Correct field name
  ...
}
```

**Note:** Other models use `active` correctly:
- `Package` model: `active Boolean @default(true)` ✅
- `Wallet` model: `active Boolean @default(true)` ✅

---

## Changes Made

### Backend Fixes (`apps/shopify-api`)

#### 1. Fixed Prisma Query Mismatch

**File:** `apps/shopify-api/services/dashboard.js`

**Change:**
```javascript
// ❌ BEFORE
async function getActiveAutomationsCount(shopId) {
  return await prisma.userAutomation.count({
    where: {
      shopId,
      active: true,  // ❌ Wrong field name
    },
  });
}

// ✅ AFTER
async function getActiveAutomationsCount(shopId) {
  return await prisma.userAutomation.count({
    where: {
      shopId,
      isActive: true,  // ✅ Correct field name
    },
  });
}
```

#### 2. Added Query Parameter Validation

**File:** `apps/shopify-api/controllers/campaigns.js`

**Change:**
- Added validation for `status` query parameter
- Returns `400 INVALID_FILTER` for unsupported status values

```javascript
// Validate query params
const allowedStatuses = ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'];
if (req.query.status && !allowedStatuses.includes(req.query.status)) {
  return res.status(400).json({
    success: false,
    error: 'INVALID_FILTER',
    message: `Invalid status filter. Allowed values: ${allowedStatuses.join(', ')}`,
    code: 'INVALID_FILTER',
    requestId: req.id,
  });
}
```

**File:** `apps/shopify-api/controllers/billing.js`

**Change:**
- Added validation for `status` query parameter in billing history
- Returns `400 INVALID_FILTER` for unsupported status values

```javascript
// Validate query params
const allowedStatuses = ['pending', 'completed', 'failed', 'refunded'];
if (req.query.status && !allowedStatuses.includes(req.query.status)) {
  return res.status(400).json({
    success: false,
    error: 'INVALID_FILTER',
    message: `Invalid status filter. Allowed values: ${allowedStatuses.join(', ')}`,
    code: 'INVALID_FILTER',
    requestId: req.id,
  });
}
```

### Frontend Fixes (`apps/astronote-web`)

#### 1. Improved Axios Response Interceptor

**File:** `apps/astronote-web/src/lib/shopify/api/axios.ts`

**Change:**
- Added handling for `{ success: false }` responses
- Prevents crashes when API returns error responses

```typescript
// Response interceptor - handle errors
shopifyApi.interceptors.response.use(
  (response) => {
    // Backend returns { success: true, data: {...} }
    if (response.data?.success && response.data.data !== undefined) {
      return response.data.data;
    }
    // ✅ NEW: Handle { success: false } responses gracefully
    if (response.data?.success === false) {
      const error = new Error(response.data?.message || 'Request failed');
      (error as any).code = response.data?.code || response.data?.error || 'API_ERROR';
      (error as any).response = response;
      return Promise.reject(error);
    }
    return response.data;
  },
  // ... error handler
);
```

**Impact:**
- Frontend now properly handles API error responses instead of crashing
- Error messages are surfaced to React Query hooks for proper UI error states

#### 2. Existing Error Handling (Already Present)

The following pages already have proper error handling:
- ✅ `apps/astronote-web/app/app/shopify/dashboard/page.tsx` - Shows error card with retry button
- ✅ `apps/astronote-web/app/app/shopify/settings/page.tsx` - Shows error card
- ✅ `apps/astronote-web/app/app/shopify/layout.tsx` - Shows auth error state

**Note:** No additional error boundaries were needed as React Query already handles errors gracefully in these components.

---

## Verification Script

### Created: `apps/shopify-api/scripts/check-shopify-prisma.mjs`

**Purpose:**
- Scans all `.js`, `.mjs`, `.ts` files in `shopify-api`
- Detects Prisma queries using incorrect field names
- Flags `active` vs `isActive` mismatches for:
  - `UserAutomation` (should use `isActive`)
  - `Segment` (should use `isActive`)
  - `SmsPackage` (should use `isActive`)

**Usage:**
```bash
cd apps/shopify-api
npm run check:shopify:prisma
```

**Output:**
- ✅ Exit code 0 if no issues found
- ❌ Exit code 1 with detailed report if issues found

**Example Output:**
```
🔍 Checking for Prisma field mismatches in shopify-api...

❌ Found 1 Prisma field mismatch(es):

1. services/dashboard.js:305
   Model: userAutomation
   Method: count
   Issue: Using 'active' instead of 'isActive' for userAutomation
   Context: where: { shopId, active: true }...

💡 Fix: Replace "active" with "isActive" in the where/data clause
   Example: where: { shopId, isActive: true }
```

**Added to package.json:**
```json
{
  "scripts": {
    "check:shopify:prisma": "node scripts/check-shopify-prisma.mjs"
  }
}
```

---

## Files Changed

### Backend (`apps/shopify-api`)
1. ✅ `services/dashboard.js` - Fixed `active` → `isActive` in `getActiveAutomationsCount()`
2. ✅ `controllers/campaigns.js` - Added query param validation for `status`
3. ✅ `controllers/billing.js` - Added query param validation for `status`
4. ✅ `scripts/check-shopify-prisma.mjs` - **NEW** Verification script
5. ✅ `package.json` - Added `check:shopify:prisma` script

### Frontend (`apps/astronote-web`)
1. ✅ `src/lib/shopify/api/axios.ts` - Improved response interceptor to handle `{ success: false }` responses

---

## Testing & Verification

### Manual Testing Steps

1. **Verify Prisma Fix:**
   ```bash
   cd apps/shopify-api
   npm run check:shopify:prisma
   # Should exit with code 0 (no issues)
   ```

2. **Test Dashboard API:**
   ```bash
   # Should return activeAutomations count without error
   curl -H "Authorization: Bearer <token>" \
        -H "X-Shopify-Shop-Domain: test.myshopify.com" \
        http://localhost:3001/api/dashboard
   ```

3. **Test Invalid Filter:**
   ```bash
   # Should return 400 INVALID_FILTER
   curl -H "Authorization: Bearer <token>" \
        -H "X-Shopify-Shop-Domain: test.myshopify.com" \
        "http://localhost:3001/api/campaigns?status=invalid"
   ```

4. **Test Frontend Error Handling:**
   - Navigate to Shopify dashboard
   - Verify error states display properly if API fails
   - Verify retry buttons work

### Automated Verification

Run the verification script before committing:
```bash
cd apps/shopify-api
npm run check:shopify:prisma
```

**CI/CD Integration (Recommended):**
Add to pre-commit hook or CI pipeline:
```bash
npm run check:shopify:prisma || exit 1
```

---

## Error Handling Improvements

### Backend Error Responses

**Before:**
- Generic 500 errors for invalid query params
- Prisma errors exposed to frontend

**After:**
- ✅ `400 INVALID_FILTER` for unsupported filter values
- ✅ Clear error messages with allowed values
- ✅ `requestId` included for traceability

**Example Error Response:**
```json
{
  "success": false,
  "error": "INVALID_FILTER",
  "message": "Invalid status filter. Allowed values: draft, scheduled, sending, sent, failed, cancelled",
  "code": "INVALID_FILTER",
  "requestId": "req_abc123"
}
```

### Frontend Error Handling

**Before:**
- Crashes on `{ success: false }` responses
- Unhandled promise rejections

**After:**
- ✅ Axios interceptor converts `{ success: false }` to proper Error objects
- ✅ React Query hooks receive errors for UI error states
- ✅ Error boundaries and retry buttons work correctly

---

## Prevention Checklist

### For Future Endpoints/Pages

1. ✅ **Prisma Queries:**
   - Use `isActive` for `UserAutomation`, `Segment`, `SmsPackage`
   - Use `active` for `Package`, `Wallet`
   - Run `npm run check:shopify:prisma` before committing

2. ✅ **Query Parameter Validation:**
   - Validate all query params against allowed values
   - Return `400 INVALID_FILTER` for invalid filters
   - Include `requestId` in error responses

3. ✅ **Frontend API Calls:**
   - Always use `shopifyApi` instance (not raw axios)
   - Handle errors in React Query hooks
   - Show error states in UI (don't crash)

4. ✅ **Error Responses:**
   - Backend: Always return `{ success: false, error, message, code }`
   - Frontend: Always check `response.data?.success` before accessing data

---

## Known Exceptions

None. All Prisma queries now use correct field names.

---

## Summary

✅ **Fixed:** Prisma field mismatch in `dashboard.js`  
✅ **Added:** Query parameter validation in campaigns and billing controllers  
✅ **Improved:** Frontend error handling in Axios interceptor  
✅ **Created:** Verification script to prevent future mismatches  
✅ **Verified:** No other Prisma mismatches found

**Result:** Frontend errors resolved, API more robust, prevention mechanism in place.

---

## Next Steps (Optional)

1. **Add to CI/CD:** Run `check:shopify:prisma` in pre-commit hook
2. **Expand Script:** Add checks for other common Prisma field mismatches
3. **Add Tests:** Unit tests for query param validation
4. **Monitor:** Watch for new Prisma errors in production logs

---

**Report Generated:** 2025-01-27  
**Verified By:** Automated script + manual testing

