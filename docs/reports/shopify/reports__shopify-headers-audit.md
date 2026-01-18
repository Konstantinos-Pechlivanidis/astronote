# Shopify Headers Audit Report

**Date:** 2025-01-27  
**Scope:** `apps/astronote-web/app/app/shopify/**` (frontend) vs `apps/shopify-api/**` (backend)  
**Goal:** Ensure Shopify frontend ALWAYS sends correct headers to shopify-api  
**Status:** 🔍 **AUDIT COMPLETE**

---

## Executive Summary

This audit verifies that the Shopify frontend always sends the correct headers (`X-Shopify-Shop-Domain` and `Authorization: Bearer`) to the backend API, and that no page/component bypasses this requirement.

**Key Findings:**
- ✅ Centralized API client exists and injects headers automatically
- ✅ Shop domain resolver exists with validation
- ⚠️ **Gap:** Shop domain resolver priority doesn't match requirements (should check App Bridge first)
- ⚠️ **Gap:** Missing `Accept: application/json` header
- ⚠️ **Gap:** Shop domain resolver should use sessionStorage as fallback
- ✅ No direct fetch calls bypassing the client (except auth token exchange, which is correct)

---

## Phase 1: Backend Header Requirements

### Backend Tenant Resolution Policy

**Location:** `apps/shopify-api/middlewares/store-resolution.js`

**Header Priority (Backend):**
1. **X-Shopify-Shop-Domain** header (PREFERRED - highest priority)
2. **Authorization: Bearer <token>** (JWT token with storeId/shopDomain)
3. Query param `shop` (LAST RESORT - only for redirect/callback routes)

**Protected Routes:**
- All routes under `/dashboard`, `/contacts`, `/campaigns`, `/templates`, `/automations`, `/billing`, `/subscriptions`, `/settings`
- Require: `X-Shopify-Shop-Domain` header
- Require: `Authorization: Bearer <token>` (if backend expects it)

**Public Routes:**
- `/auth/shopify-token` - Public (no tenant headers)
- `/auth/shopify` - Public (no tenant headers)
- `/unsubscribe` - Public (no tenant headers)
- `/r/:token` - Public (no tenant headers)
- `/opt-in` - Public (no tenant headers)
- `/webhooks/*` - Public (no tenant headers)

**Header Validation:**
- Shop domain must match: `^[a-zA-Z0-9-]+\.myshopify\.com$`
- Must be lowercase
- Backend normalizes and validates

---

## Phase 2: Frontend Header Usage Inventory

### Centralized API Client

**Location:** `apps/astronote-web/src/lib/shopify/api/axios.ts`

**Current Implementation:**
- ✅ Base URL from env: `SHOPIFY_API_BASE_URL`
- ✅ Automatic `Authorization: Bearer <token>` header injection
- ✅ Automatic `X-Shopify-Shop-Domain` header injection
- ✅ `Content-Type: application/json` header set
- ⚠️ Missing `Accept: application/json` header
- ✅ Public endpoint detection (skips tenant headers)
- ✅ Response interceptor handles errors
- ✅ Auto-redirect to login on auth errors

**Shop Domain Resolver:**

**Location:** `apps/astronote-web/src/lib/shopify/api/shop-domain.ts`

**Current Priority:**
1. JWT token payload (`shopify_token`) - shopDomain field
2. localStorage `shopify_store.shopDomain`
3. URL query param `shop` (for redirect flows only)

**Required Priority (per user requirements):**
1. Embedded context / App Bridge (if available)
2. URL query param `shop` (validated, *.myshopify.com)
3. sessionStorage/localStorage fallback (validated)

**Gap:** Current implementation doesn't check App Bridge context first.

### Direct API Calls Found

1. **`apps/astronote-web/src/lib/shopify/api/auth.ts`**
   - `exchangeShopifyToken()` uses direct `axios.post()` to `/auth/shopify-token`
   - ✅ **CORRECT** - This is a public endpoint, doesn't need tenant headers
   - ✅ **CORRECT** - Sets `Content-Type: application/json`

2. **`apps/astronote-web/app/app/shopify/auth/login/page.tsx`**
   - Uses `SHOPIFY_API_BASE_URL` for OAuth redirect
   - ✅ **CORRECT** - This is a redirect URL, not an API call

**No other direct fetch/axios calls found** - All other API calls go through centralized client.

---

## Phase 3: Issues Identified

### Blockers (Must Fix)

**None found** - All critical functionality works.

### Reliability Issues

1. **Missing Accept Header**
   - **Issue:** `Accept: application/json` header not set
   - **Impact:** Low - backend still works, but not following best practices
   - **Fix:** Add `Accept: application/json` to default headers

2. **Shop Domain Resolver Priority**
   - **Issue:** Doesn't check App Bridge context first
   - **Impact:** Medium - May not get shop domain from embedded context
   - **Fix:** Update resolver to check App Bridge first, then query param, then storage

3. **SessionStorage Fallback**
   - **Issue:** Only uses localStorage, not sessionStorage
   - **Impact:** Low - localStorage works, but sessionStorage is more secure for temporary storage
   - **Fix:** Add sessionStorage check as fallback

### Maintainability Issues

1. **Public Endpoint Detection**
   - **Status:** ✅ Already implemented
   - **Note:** Uses URL pattern matching, which is correct

2. **Error Handling**
   - **Status:** ✅ Already robust
   - **Note:** Handles `INVALID_SHOP_DOMAIN` and 401 errors correctly

---

## Implementation Plan

### Step 1: Update Shop Domain Resolver
- Add App Bridge context check (priority 1)
- Keep URL query param check (priority 2)
- Add sessionStorage check (priority 3)
- Keep localStorage as final fallback (priority 4)

### Step 2: Add Accept Header
- Add `Accept: application/json` to default headers in axios instance

### Step 3: Enhance Public Endpoint Detection
- Ensure all public routes are properly detected
- Verify `/auth/*` routes are handled correctly

### Step 4: Add Verification Script
- Create `scripts/audit-shopify-headers.mjs`
- Check for direct fetch calls
- Verify header injection
- Check shop domain resolver usage

---

## Summary

**Overall Status:** ✅ **GOOD** - Headers are mostly correct, minor improvements needed

**Strengths:**
- ✅ Centralized API client with automatic header injection
- ✅ Shop domain validation and normalization
- ✅ Public endpoint detection
- ✅ No direct fetch calls bypassing client (except correct auth endpoint)

**Areas for Improvement:**
- ⚠️ Add `Accept: application/json` header
- ⚠️ Update shop domain resolver priority (App Bridge first)
- ⚠️ Add sessionStorage fallback

**Next Step:** Proceed to implementation to fix the identified issues.

---

**Report Generated:** 2025-01-27  
**Next Step:** Begin implementation fixes

