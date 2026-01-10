# Shopify End-to-End Audit Report

**Date:** 2025-01-27  
**Scope:** `apps/shopify-api` (backend) + `apps/astronote-web/app/app/shopify` (frontend) + Prisma  
**Reference:** `apps/retail-api` (backend) + `apps/astronote-web/app/retail` (frontend)  
**Objective:** Complete audit and alignment with proven Retail architecture

---

## Executive Summary

This audit identifies critical gaps in tenant resolution, Prisma field mismatches, frontend crash points, and alignment issues with Retail API. The audit is organized into 4 phases:

- **Phase 1:** Tenant/Auth foundation (INVALID_SHOP_DOMAIN errors)
- **Phase 2:** Prisma mismatches + crash prevention
- **Phase 3:** Full Retail↔Shopify alignment (campaigns, statuses, unsubscribe)
- **Phase 4:** Verification gates and final reports

**Critical Issues Found:**
1. ⚠️ Some routes may not consistently use tenant resolver middleware
2. ⚠️ Frontend API client may miss shop domain in some edge cases
3. ✅ Unsubscribe routes correctly marked as public
4. ⚠️ Prisma field mismatches already fixed (from previous task)
5. ⚠️ Frontend error boundaries may be missing on some pages

---

## PHASE 1 — TENANT/AUTH (FOUNDATION)

### A) Route Inventory

#### Protected Routes (Require Tenant Identity)

**Routes using `resolveStore` + `requireStore`:**
- ✅ `/api/dashboard` - Dashboard data
- ✅ `/api/contacts` - Contact management
- ✅ `/api/campaigns` - Campaign CRUD + enqueue
- ✅ `/api/automations` - Automation management
- ✅ `/api/reports` - Reports and analytics
- ✅ `/api/discounts` - Discount management
- ✅ `/api/billing` - Billing and credits
- ✅ `/api/subscriptions` - Subscription management
- ✅ `/api/settings` - App settings
- ✅ `/api/audiences` - Audience/segment management
- ✅ `/api/shopify` - Shopify integration endpoints
- ✅ `/api/tracking` - Delivery status tracking
- ✅ `/api/mitto` - Mitto status refresh
- ✅ `/api/admin/templates` - Admin template management

**Routes using `resolveStore` only (may allow optional store):**
- ✅ `/api/templates` - Template browsing (some endpoints require store)

#### Public Routes (MUST NOT Require Tenant Identity)

**Routes with NO auth middleware:**
- ✅ `/api/unsubscribe/:token` - GET/POST unsubscribe (public, token-based)
- ✅ `/api/opt-in` - Public opt-in endpoint
- ✅ `/r/:token` - Short link redirects (public)
- ✅ `/webhooks/mitto/dlr` - Mitto delivery webhook (signature verified)
- ✅ `/webhooks/mitto/inbound` - Mitto inbound webhook (signature verified)
- ✅ `/webhooks/stripe` - Stripe webhook (signature verified)
- ✅ `/automation-webhooks` - Automation webhooks (signature verified)
- ✅ `/api/public/packages` - Public package listing
- ✅ `/api/public/contact` - Public contact form
- ✅ `/health`, `/healthz`, `/readiness` - Health checks
- ✅ `/metrics` - Prometheus metrics

**Routes with special auth (not tenant-based):**
- ✅ `/auth/*` - Authentication endpoints (handle their own auth)

### B) Tenant Resolution Middleware Analysis

**Current Implementation:** `apps/shopify-api/middlewares/store-resolution.js`

**Resolution Order (Current):**
1. ✅ `X-Shopify-Shop-Domain` header (PREFERRED)
2. ✅ `Authorization: Bearer <token>` (JWT token)
3. ✅ Query param `shop` (ONLY for redirect routes: `/auth/callback`, `/auth/shopify`, `/auth/shopify-token`)

**Validation:**
- ✅ Shop domain pattern: `[a-zA-Z0-9-]+\.myshopify\.com`
- ✅ Normalization: adds `.myshopify.com` if missing
- ✅ Error response includes `X-Astronote-Tenant-Required: true` header
- ✅ Request ID included in logs and responses

**Issues Identified:**

1. **Route Registration Inconsistency:**
   - Some routes may be missing `resolveStore` middleware
   - Need to verify ALL protected routes use the middleware

2. **Frontend Shop Domain Resolution:**
   - `resolveShopDomain()` prioritizes JWT token → localStorage → URL param
   - URL param check only on redirect routes (correct)
   - **Potential Issue:** If token expires and localStorage is cleared, shop domain may be lost
   - **Fix:** Ensure callback page stores shop domain immediately

3. **Missing Tenant Context:**
   - Some routes may access `req.ctx.store` without proper middleware
   - Need to verify all protected routes use `requireStore` after `resolveStore`

### C) Frontend API Client Analysis

**Current Implementation:** `apps/astronote-web/src/lib/shopify/api/axios.ts`

**Strengths:**
- ✅ Centralized Axios instance
- ✅ Request interceptor adds `Authorization` header
- ✅ Request interceptor adds `X-Shopify-Shop-Domain` header
- ✅ Response interceptor handles `{ success: false }` responses
- ✅ Error handling for `INVALID_SHOP_DOMAIN` redirects to login

**Potential Issues:**

1. **Shop Domain Resolution:**
   - Uses `resolveShopDomain()` from `shop-domain.ts`
   - Priority: JWT token → localStorage → URL param (redirect routes only)
   - **Issue:** If token is invalid/expired and localStorage cleared, shop domain may be null
   - **Fix:** Ensure callback page stores shop domain before token verification

2. **Missing Header on Some Requests:**
   - Need to verify ALL API calls use `shopifyApi` instance
   - Direct `axios` calls would bypass interceptors

3. **Public Endpoints:**
   - Unsubscribe endpoints should NOT use `shopifyApi` (would add tenant headers)
   - Need separate client or conditional header attachment

### D) Root Causes of INVALID_SHOP_DOMAIN

**Identified Causes:**

1. **Frontend:**
   - Token expired and shop domain not stored in localStorage
   - Callback page doesn't store shop domain before token verification
   - Some pages may make API calls before shop domain is available

2. **Backend:**
   - Routes missing `resolveStore` middleware (need verification)
   - Query param `shop` not available on non-redirect routes
   - Token doesn't contain shopDomain (should be fixed in token generation)

3. **Edge Cases:**
   - Embedded app initial load (no shop domain in URL)
   - Standalone mode redirects (shop domain may be lost)
   - Token refresh scenarios

**Planned Fixes:**

1. ✅ Ensure callback page stores shop domain immediately
2. ✅ Verify all protected routes use `resolveStore` + `requireStore`
3. ✅ Add fallback shop domain storage in frontend
4. ✅ Ensure token always contains shopDomain
5. ✅ Add public API client for unsubscribe endpoints

---

## PHASE 2 — PRISMA MISMATCH + CRASH PREVENTION

### A) Prisma Schema Analysis

**Schema Location:** `apps/shopify-api/prisma/schema.prisma`

**Field Name Patterns:**
- ✅ `UserAutomation.isActive` (Boolean) - NOT `active`
- ✅ `Segment.isActive` (Boolean) - NOT `active`
- ✅ `SmsPackage.isActive` (Boolean) - NOT `active`
- ✅ `Package.active` (Boolean) - Uses `active` (correct)
- ✅ `Wallet.active` (Boolean) - Uses `active` (correct)

**Previous Fixes (Already Applied):**
- ✅ `services/dashboard.js` - Fixed `active` → `isActive` in `getActiveAutomationsCount()`

**Remaining Checks:**
- Need to verify no other `active` → `isActive` mismatches
- Verification script already created: `scripts/check-shopify-prisma.mjs`

### B) Backend Error Handling

**Current State:**
- ✅ Global error handler exists: `utils/errors.js`
- ✅ Standardized error responses: `{ success: false, error, message, code, requestId }`
- ✅ Query param validation added to campaigns and billing controllers

**Issues:**
- ⚠️ Some controllers may leak raw Prisma errors
- ⚠️ Missing validation for optional filters
- ⚠️ Need consistent error codes across all endpoints

**Planned Fixes:**
- Add validation middleware for query params
- Ensure all controllers use `sendError()` helper
- Add `INVALID_FILTER` error code for unsupported filters

### C) Frontend Crash Prevention

**Current State:**
- ✅ Dashboard page has error handling
- ✅ Settings page has error handling
- ✅ Layout has auth error handling
- ✅ Axios interceptor handles `{ success: false }` responses

**Potential Issues:**
- ⚠️ Some pages may not have error boundaries
- ⚠️ API response parsing may assume fields exist
- ⚠️ Missing loading states on some pages

**Planned Fixes:**
- Add React Error Boundary wrapper
- Add defensive parsing for all API responses
- Ensure all pages have loading/error states

---

## PHASE 3 — FULL RETAIL↔SHOPIFY ALIGNMENT

### Comparison Matrix

| Feature | Retail API Behavior | Shopify API Behavior | Gap | Fix Plan |
|---------|---------------------|----------------------|-----|----------|
| **CAMPAIGNS** |
| Create Campaign | `POST /campaigns` - Returns campaign object | `POST /campaigns` - Returns `{success: true, data: {...}}` | Response wrapper | ✅ Keep Shopify wrapper |
| List Campaigns | `GET /campaigns?page=1&pageSize=20` - Returns `{items, total, page, pageSize}` | `GET /campaigns?page=1&pageSize=20` - Returns `{success: true, data: {items, pagination}}` | Response wrapper | ✅ Keep Shopify wrapper |
| Get Campaign | `GET /campaigns/:id` - Returns campaign | `GET /campaigns/:id` - Returns `{success: true, data: {...}}` | Response wrapper | ✅ Keep Shopify wrapper |
| Enqueue Campaign | `POST /campaigns/:id/enqueue` - Returns `{ok: true, queued: N, enqueuedJobs: N, campaignId}` | `POST /campaigns/:id/enqueue` - Returns `{ok: true, queued: N, enqueuedJobs: N, campaignId}` | ✅ **FIXED** | ✅ Already aligned |
| Enqueue Error Codes | `{ok: false, reason: '...'}` | `{ok: false, reason: '...', code: '...'}` | ✅ Shopify better | None |
| Schedule Campaign | `PUT /campaigns/:id/schedule` - Sets `scheduledAt` | `PUT /campaigns/:id/schedule` - Sets `scheduleAt` | ✅ Aligned | None |
| Campaign Status | `draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled` | `draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled` | ✅ Aligned | None |
| Campaign Stats | `GET /campaigns/:id/stats` - Returns metrics | `GET /campaigns/:id/status` - Returns status + metrics | Endpoint name | ✅ Keep Shopify name |
| **UNSUBSCRIBE** |
| Unsubscribe Route | `POST /contacts/unsubscribe` (public) | `GET/POST /api/unsubscribe/:token` (public) | Route format | ✅ Shopify format is better |
| Unsubscribe Auth | No auth required (token-based) | No auth required (token-based) | ✅ Aligned | None |
| Unsubscribe Token | Encodes `contactId` + `storeId` | Encodes `contactId` + `shopId` + `phoneE164` | Token format | ✅ Shopify format is better |
| Unsubscribe DB Update | Updates `smsConsent` to `opted_out` | Updates `smsConsent` to `opted_out` | ✅ Aligned | None |
| Unsubscribe Tenant Safety | Token verified, scoped by storeId | Token verified, scoped by shopId | ✅ Aligned | None |
| **BILLING** |
| Get Balance | `GET /billing/balance` - Returns `{balance, subscription, billingCurrency}` | `GET /billing/balance` - Returns `{credits, balance, currency, subscription}` | ✅ **FIXED** | ✅ Already aligned |
| Get Packages | `GET /billing/packages` - Returns packages (only if subscription active) | `GET /billing/packages` - Returns packages (only if subscription active) | ✅ **FIXED** | ✅ Already aligned |
| Create Purchase | `POST /billing/purchase` - Returns `{ok: true, checkoutUrl, sessionId}` | `POST /billing/purchase` - Returns `{success: true, data: {checkoutUrl, sessionId}}` | Response wrapper | ✅ Keep Shopify wrapper |
| Get Portal | `GET /subscriptions/portal` - Returns `{ok: true, portalUrl}` | `GET /subscriptions/portal` - Returns `{success: true, data: {portalUrl}}` | Response wrapper | ✅ Keep Shopify wrapper |
| **IDEMPOTENCY** |
| Campaign Enqueue | Service-level (status check) | Endpoint-level (`Idempotency-Key`) + service-level | ✅ Shopify better | None |
| Purchase | `idempotencyKey` in Purchase model | `idempotencyKey` in Purchase model | ✅ Aligned | None |
| **TENANT SCOPING** |
| Tenant Identity | `req.user.id` (JWT from `requireAuth`) | `getStoreId(req)` from header/token | ✅ Different mechanism, both correct | None |
| DB Queries | All scoped by `ownerId: req.user.id` | All scoped by `shopId: storeId` | ✅ Both correct | None |
| **ERROR HANDLING** |
| Error Format | `{message, code}` or `{ok: false, reason}` | `{success: false, error, message, code, requestId}` | ✅ Shopify better | None |
| HTTP Status Codes | 400, 401, 403, 404, 402 | 400, 401, 403, 404, 402 | ✅ Aligned | None |

### Key Findings

**✅ Already Aligned:**
- Campaign enqueue response shape (`queued` field)
- Packages subscription gating
- Balance subscription info
- Unsubscribe flow (public, token-based, tenant-safe)
- Error codes and status codes
- Tenant scoping (both use correct mechanisms)

**⚠️ Minor Differences (Intentional):**
- Response wrapper format (Shopify uses `{success, data}` - more consistent)
- Endpoint naming (Shopify uses `/status` vs Retail `/stats` - both valid)

**✅ Shopify Improvements:**
- Better idempotency (endpoint-level + service-level)
- More detailed error responses
- Better unsubscribe token format (includes phoneE164)

---

## PHASE 4 — VERIFICATION REQUIREMENTS

### Static Checks Needed

1. **Tenant Resolution:**
   - All protected routes use `resolveStore` + `requireStore`
   - Public routes (unsubscribe, webhooks) do NOT use tenant middleware
   - Frontend API client always includes `X-Shopify-Shop-Domain` header

2. **Prisma Field Usage:**
   - No `active` field used for `UserAutomation`, `Segment`, `SmsPackage`
   - All Prisma queries use correct field names from schema

3. **Frontend API Usage:**
   - All API calls use `shopifyApi` instance (not raw axios)
   - Public endpoints (unsubscribe) use separate client or skip headers
   - No direct API calls bypassing interceptors

4. **Route Registration:**
   - No duplicate route collisions
   - All routes properly registered in `app.js`
   - Public routes clearly marked

5. **Import Validation:**
   - No broken imports in Shopify pages
   - All API client imports use correct paths
   - No circular dependencies

---

## Implementation Plan

### Phase 1 Fixes (HIGH Priority)

1. **Verify Route Middleware Usage:**
   - Audit all route files to ensure `resolveStore` + `requireStore` on protected routes
   - Ensure public routes (unsubscribe, webhooks) have NO tenant middleware

2. **Frontend Shop Domain Storage:**
   - Ensure callback page stores shop domain immediately
   - Add fallback shop domain resolution
   - Verify token always contains shopDomain

3. **Public API Client:**
   - Create separate client for public endpoints (unsubscribe)
   - Or add conditional header attachment in interceptor

### Phase 2 Fixes (MEDIUM Priority)

1. **Prisma Verification:**
   - Run existing verification script
   - Fix any remaining mismatches

2. **Error Handling:**
   - Add query param validation middleware
   - Ensure all controllers use standardized errors

3. **Frontend Crash Prevention:**
   - Add Error Boundary wrapper
   - Add defensive parsing for API responses
   - Ensure all pages have error states

### Phase 3 Fixes (LOW Priority - Mostly Already Done)

1. **Campaign Alignment:**
   - ✅ Already aligned (from previous task)

2. **Unsubscribe Verification:**
   - Verify unsubscribe flow works end-to-end
   - Test tenant safety (no cross-tenant leakage)

### Phase 4 Implementation

1. **Create Audit Script:**
   - `scripts/audit-shopify-e2e.mjs`
   - Static checks for all verification requirements
   - Exit non-zero on failures

2. **Create Implementation Report:**
   - Document all changes made
   - Endpoint inventory table
   - Remaining TODOs (if any)

---

## Files Requiring Changes

### Phase 1 (Tenant/Auth)
1. `apps/shopify-api/app.js` - Verify route middleware usage
2. `apps/astronote-web/app/app/shopify/auth/callback/page.tsx` - Ensure shop domain storage
3. `apps/astronote-web/src/lib/shopify/api/axios.ts` - Add public endpoint handling
4. `apps/astronote-web/src/lib/shopify/api/shop-domain.ts` - Improve fallback resolution

### Phase 2 (Prisma + Crash Prevention)
1. `apps/shopify-api/controllers/*.js` - Add query param validation
2. `apps/astronote-web/app/app/shopify/**/*.tsx` - Add error boundaries
3. `apps/astronote-web/app/app/shopify/**/*.tsx` - Add defensive parsing

### Phase 3 (Alignment)
1. ✅ Mostly complete (from previous alignment task)

### Phase 4 (Verification)
1. `scripts/audit-shopify-e2e.mjs` - **NEW** Verification script
2. `package.json` - Add audit script
3. `reports/shopify-e2e-implemented.md` - **NEW** Implementation report

---

## Risk Assessment

**Low Risk:**
- Frontend shop domain storage improvements
- Error boundary additions
- Query param validation

**Medium Risk:**
- Route middleware verification (may need to add middleware to some routes)
- Public API client separation

**High Risk:**
- None identified (all changes are defensive improvements)

---

## Testing Checklist

After implementation:

- [ ] All protected routes require tenant identity
- [ ] Public routes (unsubscribe) work without tenant headers
- [ ] Frontend always includes shop domain header on protected calls
- [ ] No Prisma field mismatches
- [ ] No frontend crashes on API errors
- [ ] Unsubscribe flow is tenant-safe
- [ ] Campaign enqueue works with idempotency
- [ ] Audit script passes all checks

---

**Report Generated:** 2025-01-27  
**Next Step:** Implement fixes in priority order, then create verification script and final report.

