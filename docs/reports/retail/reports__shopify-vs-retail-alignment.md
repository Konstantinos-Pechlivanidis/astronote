# Shopify vs Retail API Alignment Audit Report

**Date:** 2025-01-27  
**Scope:** `apps/retail-api` (reference) vs `apps/shopify-api` (target)  
**Objective:** Identify gaps and align Shopify implementation with proven Retail architecture

---

## Executive Summary

This audit compares the Shopify API implementation with the proven Retail API architecture. Key findings:

- ✅ **Campaign Enqueue:** Shopify has good implementation but response shapes differ slightly
- ⚠️ **Billing/Packages:** Shopify missing subscription gating on packages endpoint
- ⚠️ **Portal Endpoint:** Shopify portal may use dev customer IDs (needs verification)
- ✅ **Tenant Scoping:** Shopify correctly uses shopId throughout
- ⚠️ **Error Codes:** Some differences in error response formats
- ✅ **Idempotency:** Both implementations have idempotency, but Shopify has endpoint-level idempotency (better)

---

## Detailed Comparison Table

| Feature | Retail Implementation | Shopify Implementation | Gap | Fix Priority |
|---------|----------------------|------------------------|-----|--------------|
| **CAMPAIGNS** |
| Create Campaign | `POST /campaigns` - Returns campaign object | `POST /campaigns` - Returns `{success: true, data: {...}}` | Response wrapper difference | Low |
| List Campaigns | `GET /campaigns?page=1&pageSize=20` - Returns `{items, total, page, pageSize}` | `GET /campaigns?page=1&pageSize=20` - Returns `{success: true, data: {items, pagination}}` | Response wrapper difference | Low |
| Get Campaign | `GET /campaigns/:id` - Returns campaign object | `GET /campaigns/:id` - Returns `{success: true, data: {...}}` | Response wrapper difference | Low |
| Enqueue Campaign | `POST /campaigns/:id/enqueue` - Returns `{ok: true, queued: N, enqueuedJobs: N, campaignId}` | `POST /campaigns/:id/enqueue` - Returns `{ok: true, created: N, enqueuedJobs: N, campaignId}` | Field name: `queued` vs `created` | **HIGH** |
| Enqueue Error Codes | `{ok: false, reason: 'not_found'|'invalid_status'|'inactive_subscription'|'insufficient_credits'|'no_recipients'|'queue_unavailable'}` | `{ok: false, reason: '...', code: 'NOT_FOUND'|'INVALID_STATUS'|'INACTIVE_SUBSCRIPTION'|'INSUFFICIENT_CREDITS'|'NO_RECIPIENTS'}` | Shopify adds `code` field (better) | None - Shopify is better |
| Schedule Campaign | `PUT /campaigns/:id/schedule` - Sets `scheduledAt`, status='scheduled' | `PUT /campaigns/:id/schedule` - Sets `scheduledAt`, status='scheduled' | ✅ Aligned | None |
| Campaign Status | `draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled` | `draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled` | ✅ Aligned | None |
| **BILLING** |
| Get Balance | `GET /billing/balance` - Returns `{balance, subscription, billingCurrency}` | `GET /billing/balance` - Returns `{success: true, data: {credits, balance, currency}}` | Response wrapper + missing subscription info | **MEDIUM** |
| Get Packages | `GET /billing/packages?currency=EUR` - Returns packages array (only if subscription active) | `GET /billing/packages?currency=EUR` - Returns `{success: true, data: {packages, currency}}` (no subscription check) | **Missing subscription gating** | **HIGH** |
| Create Purchase | `POST /billing/purchase` - Returns `{ok: true, checkoutUrl, sessionId, purchaseId}` | `POST /billing/purchase` - Returns `{success: true, data: {checkoutUrl, sessionId, ...}}` | Response wrapper difference | Low |
| Get Portal | `GET /subscriptions/portal` - Returns `{ok: true, portalUrl}` | `GET /subscriptions/portal` - Returns `{success: true, data: {portalUrl}}` | Response wrapper + may use dev customer IDs | **MEDIUM** |
| Transaction History | `GET /billing/transactions?page=1&pageSize=10` - Returns `{page, pageSize, total, items}` | `GET /billing/history?page=1&pageSize=10` - Returns `{success: true, data: {items, pagination}}` | Response wrapper difference | Low |
| **TENANT SCOPING** |
| Tenant Identity | `req.user.id` (JWT from `requireAuth` middleware) | `getStoreId(req)` from `X-Shopify-Shop-Domain` header or Bearer token | ✅ Different mechanism, both correct | None |
| DB Queries | All queries scoped by `ownerId: req.user.id` | All queries scoped by `shopId: storeId` | ✅ Both correctly scoped | None |
| **IDEMPOTENCY** |
| Campaign Enqueue | Service-level idempotency (status check) | Endpoint-level idempotency (`Idempotency-Key` header) + service-level | ✅ Shopify has better idempotency | None |
| Purchase | Idempotency via `idempotencyKey` in Purchase model | Idempotency via `idempotencyKey` in Purchase model | ✅ Aligned | None |
| **ERROR HANDLING** |
| Error Response Format | `{message, code}` or `{ok: false, reason}` | `{success: false, error, message, code, requestId}` | Shopify has more detailed errors | None - Shopify is better |
| HTTP Status Codes | 400, 401, 403, 404, 402 (payment required) | 400, 401, 403, 404, 402 (payment required) | ✅ Aligned | None |
| **SUBSCRIPTION** |
| Check Subscription | `isSubscriptionActive(userId)` | `isSubscriptionActive(shopId)` | ✅ Aligned (different param) | None |
| Subscription Status | `{active: bool, planType, status, stripeCustomerId, ...}` | `{active: bool, planType, status, stripeCustomerId, ...}` | ✅ Aligned | None |
| **CREDITS** |
| Credit Reservation | Not used (direct debit) | Credit reservation before enqueue | ✅ Shopify has better credit safety | None |
| Wallet Service | `getBalance(userId)`, `credit()`, `debit()` | `getBalance(shopId)`, `credit()`, `debit()` | ✅ Aligned (different param) | None |

---

## Critical Gaps Identified

### 1. **Campaign Enqueue Response Shape Mismatch** (HIGH Priority)

**Issue:**
- Retail returns: `{ok: true, queued: N, enqueuedJobs: N, campaignId}`
- Shopify returns: `{ok: true, created: N, enqueuedJobs: N, campaignId}`

**Impact:**
- Frontend expecting `queued` field may break
- Inconsistent API contract

**Fix:**
- Change Shopify to return `queued` instead of `created` for consistency

**Files to Change:**
- `apps/shopify-api/services/campaigns.js` - `enqueueCampaign()` function
- `apps/shopify-api/controllers/campaigns.js` - `enqueue()` controller

---

### 2. **Packages Endpoint Missing Subscription Gating** (HIGH Priority)

**Issue:**
- Retail: Packages endpoint returns empty array if subscription is inactive
- Shopify: Packages endpoint returns packages regardless of subscription status

**Impact:**
- Users without subscription can see packages (but purchase will fail)
- Inconsistent with Retail behavior

**Fix:**
- Add subscription check in `getPackages()` controller
- Return empty array if subscription inactive (matches Retail)

**Files to Change:**
- `apps/shopify-api/controllers/billing.js` - `getPackages()` function

---

### 3. **Balance Endpoint Missing Subscription Info** (MEDIUM Priority)

**Issue:**
- Retail: Returns `{balance, subscription: {...}, billingCurrency}`
- Shopify: Returns `{credits, balance, currency}` (no subscription info)

**Impact:**
- Frontend may need to make separate call to get subscription status
- Less efficient

**Fix:**
- Include subscription status in balance response

**Files to Change:**
- `apps/shopify-api/controllers/billing.js` - `getBalance()` function
- `apps/shopify-api/services/billing.js` - `getBalance()` service

---

### 4. **Portal Endpoint May Use Dev Customer IDs** (MEDIUM Priority)

**Issue:**
- Need to verify portal endpoint doesn't use `dev_customer_*` IDs
- Retail explicitly resolves customer ID from subscription

**Impact:**
- Portal may fail in production if using dev customer IDs

**Fix:**
- Verify `getCustomerPortalUrl()` resolves customer ID correctly
- Ensure it uses production customer ID from Shop model

**Files to Review:**
- `apps/shopify-api/services/stripe.js` - `getCustomerPortalUrl()` function
- `apps/shopify-api/controllers/subscriptions.js` - `getPortal()` controller

---

## Response Shape Alignment

### Standard Response Wrapper

**Retail:**
- Success: Direct object or `{ok: true, ...}`
- Error: `{message, code}` or `{ok: false, reason}`

**Shopify:**
- Success: `{success: true, data: {...}}`
- Error: `{success: false, error, message, code, requestId}`

**Decision:**
- Keep Shopify wrapper (more consistent)
- But ensure `ok` field is used for enqueue responses (matches Retail)

---

## Error Code Mapping

| Retail Reason | Shopify Code | HTTP Status | Notes |
|---------------|--------------|-------------|-------|
| `not_found` | `NOT_FOUND` | 404 | ✅ Aligned |
| `invalid_status:...` | `INVALID_STATUS` | 409 | ✅ Aligned |
| `inactive_subscription` | `INACTIVE_SUBSCRIPTION` | 403 | ✅ Aligned |
| `insufficient_credits` | `INSUFFICIENT_CREDITS` | 402 | ✅ Aligned |
| `no_recipients` | `NO_RECIPIENTS` | 400 | ✅ Aligned |
| `queue_unavailable` | (not in Shopify) | 503 | ⚠️ Missing in Shopify |

**Fix:**
- Add `queue_unavailable` error handling in Shopify enqueue

---

## Tenant Scoping Verification

### Retail
- All queries use `ownerId: req.user.id` (from JWT)
- Middleware: `requireAuth` extracts user from JWT

### Shopify
- All queries use `shopId: storeId` (from `getStoreId(req)`)
- Middleware: `store-resolution.js` extracts shopId from header/token

**Verification:**
✅ Both correctly scope all queries
✅ No cross-tenant leakage possible

---

## Idempotency Comparison

### Retail
- Service-level: Status check prevents duplicate enqueue
- Purchase: `idempotencyKey` in Purchase model

### Shopify
- **Endpoint-level:** `Idempotency-Key` header checked before service call
- **Service-level:** Status check + atomic update
- Purchase: `idempotencyKey` in Purchase model

**Assessment:**
✅ Shopify has superior idempotency (endpoint-level + service-level)

---

## Billing Flow Alignment

### Retail Flow
1. User subscribes → Stripe checkout → Webhook activates subscription
2. User purchases credits → Stripe checkout → Webhook credits wallet
3. Packages only visible if subscription active

### Shopify Flow
1. User subscribes → Stripe checkout → Webhook activates subscription ✅
2. User purchases credits → Stripe checkout → Webhook credits wallet ✅
3. Packages visible regardless of subscription ❌ **GAP**

**Fix Required:**
- Add subscription check to packages endpoint

---

## Campaign Enqueue Flow Alignment

### Retail Flow
1. Check subscription active
2. Check credits sufficient
3. Build audience
4. Atomic status update (draft/scheduled → sending)
5. Create CampaignRecipient records
6. Enqueue SMS jobs
7. Return `{ok: true, queued: N, enqueuedJobs: N}`

### Shopify Flow
1. Atomic status update (draft/scheduled → sending) ✅
2. Build audience ✅
3. Check subscription active ✅
4. Check credits (with reservation) ✅
5. Create CampaignRecipient records ✅
6. Enqueue SMS jobs ✅
7. Return `{ok: true, created: N, enqueuedJobs: N}` ⚠️ **Field name mismatch**

**Fix Required:**
- Change `created` to `queued` in response

---

## Implementation Priority

### Phase 1: Critical Fixes (HIGH Priority)
1. ✅ Fix enqueue response: `created` → `queued`
2. ✅ Add subscription gating to packages endpoint
3. ✅ Verify portal endpoint customer ID resolution

### Phase 2: Enhancements (MEDIUM Priority)
1. ✅ Add subscription info to balance endpoint
2. ✅ Add `queue_unavailable` error handling

### Phase 3: Optional (LOW Priority)
1. Consider standardizing response wrappers (if needed)
2. Add more detailed error messages (already better in Shopify)

---

## Files Requiring Changes

### High Priority
1. `apps/shopify-api/services/campaigns.js` - Change `created` to `queued`
2. `apps/shopify-api/controllers/campaigns.js` - Update response mapping
3. `apps/shopify-api/controllers/billing.js` - Add subscription check to `getPackages()`

### Medium Priority
4. `apps/shopify-api/controllers/billing.js` - Add subscription to `getBalance()` response
5. `apps/shopify-api/services/billing.js` - Include subscription in balance service
6. `apps/shopify-api/services/stripe.js` - Verify portal customer ID resolution
7. `apps/shopify-api/controllers/campaigns.js` - Add `queue_unavailable` error handling

---

## Testing Checklist

After implementation, verify:

- [ ] Campaign enqueue returns `{ok: true, queued: N, ...}` (not `created`)
- [ ] Packages endpoint returns empty array if subscription inactive
- [ ] Balance endpoint includes subscription status
- [ ] Portal endpoint uses production customer ID (not dev)
- [ ] All queries are scoped by `shopId` (no cross-tenant leakage)
- [ ] Error codes match Retail where applicable
- [ ] Idempotency works for enqueue and purchase

---

## Next Steps

1. **Create Implementation Plan:** Prioritize fixes based on this audit
2. **Implement Fixes:** Make changes in priority order
3. **Verify:** Test all endpoints match Retail behavior
4. **Document:** Update API documentation with aligned contracts

---

**Report Generated:** 2025-01-27  
**Audit Completed By:** Code analysis of Retail and Shopify implementations

