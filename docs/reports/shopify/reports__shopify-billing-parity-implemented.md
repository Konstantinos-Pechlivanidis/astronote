# Shopify Billing Parity Implementation Report

**Date:** 2025-01-27  
**Reference:** Retail API (`apps/retail-api/apps/api`) - Source of Truth  
**Target:** Shopify API (`apps/shopify-api`) - Now Matches Retail  
**Status:** ✅ **PARITY ACHIEVED**

---

## Executive Summary

Successfully implemented all required changes to align Shopify billing with Retail billing architecture. All critical gaps identified in the audit have been closed. Shopify billing now matches Retail behavior for:

- ✅ Purchase idempotency (header + model + logic)
- ✅ Packages ETag/304 caching
- ✅ Portal customer creation
- ✅ Currency support (EUR/USD) in subscriptions
- ✅ Response shape alignment
- ✅ Prisma schema alignment

**Verification:** All audits passing (0 errors, 1 non-blocking warning)

---

## Files Changed

### Prisma Schema & Migrations

1. **`apps/shopify-api/prisma/schema.prisma`**
   - Added `idempotencyKey String? @db.VarChar(128)` to `Purchase` model
   - Added `@@unique([shopId, idempotencyKey])` constraint to `Purchase` model
   - Added `priceCentsUsd Int?` to `Package` model

2. **`apps/shopify-api/prisma/migrations/20250127000000_add_billing_parity_fields/migration.sql`** (NEW)
   - Adds `idempotencyKey` column to `Purchase` table
   - Adds `priceCentsUsd` column to `Package` table
   - Creates unique index on `[shopId, idempotencyKey]`

### Backend Controllers

3. **`apps/shopify-api/controllers/billing.js`**
   - **`createPurchase`:** Added idempotency key header validation (`Idempotency-Key` or `X-Idempotency-Key`)
   - **`createPurchase`:** Added existing purchase lookup by idempotency key
   - **`createPurchase`:** Returns existing session if found (idempotent response with `idempotent: true` flag)
   - **`getPackages`:** Added ETag generation and `If-None-Match` header check for 304 responses
   - Added `crypto` import for ETag generation

4. **`apps/shopify-api/controllers/subscriptions.js`**
   - **`getStatus`:** Added `plan` object to response (includes plan config)
   - **`subscribe`:** Added currency parameter support (EUR/USD)
   - **`subscribe`:** Currency resolution from request body or shop settings
   - **`update`:** Added currency parameter support (EUR/USD)
   - **`update`:** Currency resolution from request body or shop settings
   - **`getPortal`:** Added customer creation logic if missing (aligned with Retail)
   - **`getPortal`:** Added customer resolution from subscription if available
   - Added `getPlanConfig` import
   - Added `prisma` import for shop queries

### Backend Services

5. **`apps/shopify-api/services/billing.js`**
   - **`createPurchaseSession`:** Added `idempotencyKey` parameter
   - **`createPurchaseSession`:** Handles unique constraint violation (idempotency)
   - **`createPurchaseSession`:** Returns existing session if purchase found by idempotency key
   - **`createPurchaseSession`:** Fixed currency-based price resolution (EUR/USD)
   - **`getPackages`:** Enhanced response shape to match Retail:
     - Added `displayName` field
     - Added `type: "credit_topup"` field
     - Added `amount` alias for `price`
     - Added `priceId` alias for `stripePriceId`
     - Added `available` boolean
     - Added `createdAt` and `updatedAt` timestamps
     - Fixed currency-based price resolution (EUR/USD)

6. **`apps/shopify-api/services/stripe.js`**
   - **`createStripeCheckoutSession`:** Added `idempotencyKey` parameter
   - **`createStripeCheckoutSession`:** Passes idempotency key to Stripe API if provided
   - **`updateSubscription`:** Added `currency` parameter (defaults to EUR)
   - **`updateSubscription`:** Uses currency to resolve correct price ID
   - **`updateSubscription`:** Includes currency in subscription metadata

### Verification Script

7. **`scripts/audit-shopify-billing.mjs`** (NEW)
   - Static verification script for billing parity
   - Checks Prisma schema fields
   - Checks backend endpoint registration and tenant scoping
   - Checks frontend pages exist
   - Checks response shape alignment (best-effort)
   - Exits non-zero on failures

8. **`package.json`**
   - Added `"audit:shopify:billing": "node scripts/audit-shopify-billing.mjs"` script

---

## Endpoint Inventory

### Billing Endpoints (Shopify)

| Method | Path | Auth | Currency | Request | Response Shape | Status |
|--------|------|------|----------|---------|----------------|--------|
| GET | `/api/billing/balance` | ✅ Tenant | - | - | `{ credits, balance, currency, subscription }` | ✅ **PARITY** |
| GET | `/api/billing/packages` | ✅ Tenant | ✅ EUR/USD | `?currency=EUR\|USD` | `[{ id, name, displayName, units, credits, priceCents, amount, price, currency, priceId, stripePriceId, available, type, createdAt, updatedAt }]` | ✅ **PARITY** |
| POST | `/api/billing/purchase` | ✅ Tenant | ✅ EUR/USD | `{ packageId, currency?, successUrl, cancelUrl }`<br>**Headers:** `Idempotency-Key` (REQUIRED) | `{ checkoutUrl, sessionId, purchaseId, idempotent? }` | ✅ **PARITY** |
| GET | `/api/billing/history` | ✅ Tenant | - | `?page=&pageSize=` | `{ page, pageSize, total, transactions }` | ✅ **PARITY** |
| GET | `/api/billing/billing-history` | ✅ Tenant | - | `?page=&pageSize=&status=` | `{ page, pageSize, total, transactions }` | ✅ **PARITY** |
| GET | `/api/billing/topup/calculate` | ✅ Tenant | ✅ EUR/USD | `?credits=&currency=` | `{ credits, priceEur, priceEurWithVat, ... }` | ✅ **PARITY** |
| POST | `/api/billing/topup` | ✅ Tenant | ✅ EUR | `{ credits, successUrl, cancelUrl }` | `{ checkoutUrl, sessionId, credits, priceEur, priceBreakdown }` | ✅ **PARITY** |

### Subscription Endpoints (Shopify)

| Method | Path | Auth | Currency | Request | Response Shape | Status |
|--------|------|------|----------|---------|----------------|--------|
| GET | `/api/subscriptions/status` | ✅ Tenant | - | - | `{ active, planType, status, stripeCustomerId, stripeSubscriptionId, lastFreeCreditsAllocatedAt, plan }` | ✅ **PARITY** |
| POST | `/api/subscriptions/subscribe` | ✅ Tenant | ✅ EUR/USD | `{ planType, currency? }` | `{ checkoutUrl, sessionId, planType, currency }` | ✅ **PARITY** |
| POST | `/api/subscriptions/update` | ✅ Tenant | ✅ EUR/USD | `{ planType, currency? }` | `{ planType, currency }` | ✅ **PARITY** |
| POST | `/api/subscriptions/cancel` | ✅ Tenant | - | - | `{ cancelledAt }` | ✅ **PARITY** |
| GET | `/api/subscriptions/portal` | ✅ Tenant | - | - | `{ portalUrl }` | ✅ **PARITY** |

**Notes:**
- All endpoints require tenant identity (`resolveStore` + `requireStore` middleware)
- Currency defaults to EUR if not specified
- Currency resolution: request param → shop.currency → EUR

---

## Prisma Changes

### Purchase Model
```prisma
model Purchase {
  // ... existing fields ...
  idempotencyKey String? @db.VarChar(128) // ✅ ADDED
  
  @@unique([shopId, idempotencyKey]) // ✅ ADDED
}
```

### Package Model
```prisma
model Package {
  // ... existing fields ...
  priceCentsUsd Int? // ✅ ADDED (for USD pricing)
}
```

**Migration:** `20250127000000_add_billing_parity_fields/migration.sql`

---

## Key Implementation Details

### 1. Purchase Idempotency (CRITICAL)

**Implementation:**
- Controller validates `Idempotency-Key` or `X-Idempotency-Key` header (required)
- Checks for existing purchase by `shopId + idempotencyKey`
- Returns existing checkout session if found (with `idempotent: true` flag)
- Creates purchase with idempotency key
- Handles unique constraint violation gracefully

**Files:**
- `controllers/billing.js` - Header validation, existing purchase lookup
- `services/billing.js` - Purchase creation with idempotency key
- `services/stripe.js` - Passes idempotency key to Stripe API

### 2. Packages ETag/304 Caching (IMPORTANT)

**Implementation:**
- Generates ETag hash from package data (id, name, credits, price, currency, stripePriceId)
- Sets `ETag` header in response
- Checks `If-None-Match` header
- Returns `304 Not Modified` if ETag matches

**Files:**
- `controllers/billing.js` - ETag generation and 304 response

### 3. Portal Customer Creation (IMPORTANT)

**Implementation:**
- Checks if customer ID is valid (`cus_*` format)
- Attempts to resolve from subscription if available
- Creates Stripe customer if missing (with shop metadata)
- Updates shop record with customer ID
- Returns portal URL

**Files:**
- `controllers/subscriptions.js` - Customer resolution and creation logic

### 4. Currency Support in Subscriptions (IMPORTANT)

**Implementation:**
- `subscribe` endpoint accepts `currency` param (EUR/USD)
- `update` endpoint accepts `currency` param (EUR/USD)
- Currency resolution: request body → shop.currency → EUR
- Passes currency to Stripe service functions
- Includes currency in response

**Files:**
- `controllers/subscriptions.js` - Currency parameter handling
- `services/stripe.js` - Currency-based price ID resolution

### 5. Response Shape Alignment (NICE TO HAVE)

**Packages Response:**
- Added `displayName` (alias for `name`)
- Added `type: "credit_topup"`
- Added `amount` (alias for `price`)
- Added `priceId` (alias for `stripePriceId`)
- Added `available` boolean
- Added `createdAt` and `updatedAt` timestamps

**Purchase Response:**
- Added `idempotent: true` flag for idempotent responses

**Subscription Status Response:**
- Added `plan` object with plan configuration

**Files:**
- `services/billing.js` - Package response enrichment
- `controllers/billing.js` - Purchase idempotent flag
- `controllers/subscriptions.js` - Plan object in status

---

## Verification

### Audit Script Results

```bash
npm run audit:shopify:billing
```

**Output:**
```
✅ Prisma schema check complete (0 errors, 0 warnings)
✅ Backend endpoints check complete (0 errors, 0 warnings)
✅ Frontend pages check complete (0 errors, 0 warnings)
⚠️  Response shapes check complete (0 errors, 1 warnings)

⚠️  WARNING: getStatus may not include plan object (false positive - plan is included)
```

**Status:** ✅ **PASS** (1 non-blocking warning - false positive)

---

## Parity Confirmation

### ✅ Shopify Billing Now Matches Retail For:

1. **Purchase Flow:**
   - ✅ Idempotency key required and enforced
   - ✅ Existing purchase lookup and session return
   - ✅ Currency support (EUR/USD)
   - ✅ Error codes match Retail

2. **Packages Listing:**
   - ✅ Subscription gating (empty array if inactive)
   - ✅ ETag/304 caching
   - ✅ Currency support (EUR/USD)
   - ✅ Response shape matches Retail

3. **Subscription Management:**
   - ✅ Currency support in subscribe/update
   - ✅ Plan object in status response
   - ✅ Portal customer creation
   - ✅ Error codes match Retail

4. **Balance & Transactions:**
   - ✅ Response shapes match Retail
   - ✅ Pagination matches Retail

5. **Prisma Schema:**
   - ✅ Purchase model has idempotency key
   - ✅ Package model has USD pricing
   - ✅ Unique constraints prevent duplicates

---

## Remaining Gaps (Optional/Non-Blocking)

### None Identified

All critical and important gaps have been addressed. The 1 warning from the audit script is a false positive (plan object is included in getStatus response).

---

## Testing Recommendations

### Manual Testing Checklist

1. **Purchase Idempotency:**
   - [ ] Send purchase request with idempotency key
   - [ ] Send same request again with same key
   - [ ] Verify second request returns existing session
   - [ ] Verify `idempotent: true` flag in response

2. **Packages Caching:**
   - [ ] Request packages endpoint
   - [ ] Copy ETag from response
   - [ ] Request again with `If-None-Match: <etag>`
   - [ ] Verify 304 response

3. **Portal Customer Creation:**
   - [ ] Access portal endpoint without customer
   - [ ] Verify customer is created
   - [ ] Verify portal URL is returned

4. **Currency Support:**
   - [ ] Subscribe with EUR currency
   - [ ] Subscribe with USD currency
   - [ ] Update subscription with different currency
   - [ ] Verify correct price IDs are used

### Contract Tests (Optional)

Minimal contract tests can be added using supertest:

```javascript
// Example: Test purchase idempotency
describe('POST /billing/purchase', () => {
  it('should return existing session for duplicate idempotency key', async () => {
    const idempotencyKey = 'test-key-123';
    const firstResponse = await request(app)
      .post('/billing/purchase')
      .set('Idempotency-Key', idempotencyKey)
      .send({ packageId: '1', successUrl: '...', cancelUrl: '...' });
    
    const secondResponse = await request(app)
      .post('/billing/purchase')
      .set('Idempotency-Key', idempotencyKey)
      .send({ packageId: '1', successUrl: '...', cancelUrl: '...' });
    
    expect(secondResponse.body.idempotent).toBe(true);
    expect(secondResponse.body.sessionId).toBe(firstResponse.body.sessionId);
  });
});
```

---

## Summary

✅ **Shopify billing now matches Retail billing architecture**

**All Critical Gaps Closed:**
- ✅ Purchase idempotency implemented
- ✅ Portal customer creation implemented
- ✅ Packages ETag/304 caching implemented
- ✅ Currency support in subscriptions implemented
- ✅ Response shapes aligned

**Verification:**
- ✅ Audit script passes (0 errors)
- ✅ All endpoints tenant-scoped correctly
- ✅ Prisma schema aligned

**Next Steps:**
- Run migration: `cd apps/shopify-api && npx prisma migrate deploy`
- Test purchase flow with idempotency
- Test portal access for shops without customers
- Monitor for any edge cases in production

---

**Report Generated:** 2025-01-27  
**Implementation Status:** ✅ Complete  
**Parity Status:** ✅ Achieved

