# Shopify Billing Parity Audit Report

**Date:** 2025-01-27  
**Reference:** Retail API (`apps/retail-api/apps/api`) - Source of Truth  
**Target:** Shopify API (`apps/shopify-api`) - Must Match Retail  
**Status:** 🔍 Audit Complete - Gaps Identified

---

## Executive Summary

This audit compares Shopify billing implementation against the Retail billing architecture (canonical reference). The audit identifies gaps in endpoints, Prisma models, response shapes, and business logic that must be addressed to achieve parity.

**Key Findings:**
- ✅ **Subscription endpoints** exist and largely match Retail
- ⚠️ **Purchase endpoint** missing idempotency key support
- ⚠️ **Packages endpoint** missing ETag/304 caching
- ⚠️ **Portal endpoint** doesn't create customer if missing
- ⚠️ **Currency support** needs alignment (EUR/USD)
- ⚠️ **Purchase model** missing `idempotencyKey` field
- ⚠️ **Response shapes** need alignment in some endpoints

---

## Retail Canonical Contract (Source of Truth)

### Billing Endpoints

#### GET `/api/billing/balance`
- **Auth:** Required (`requireAuth`)
- **Response:**
```json
{
  "balance": 500,
  "subscription": {
    "active": true,
    "planType": "starter",
    "status": "active",
    "stripeCustomerId": "cus_xxx",
    "stripeSubscriptionId": "sub_xxx",
    "billingCurrency": "EUR"
  },
  "billingCurrency": "EUR"
}
```

#### GET `/api/billing/packages`
- **Auth:** Required (`requireAuth`)
- **Query:** `currency` (optional, EUR/USD)
- **Subscription Gating:** Returns empty array `[]` if subscription not active
- **ETag/304 Support:** ✅ Returns `ETag` header, supports `If-None-Match` for 304
- **Response:**
```json
[
  {
    "id": 1,
    "name": "Starter 500",
    "displayName": "Starter 500",
    "units": 500,
    "priceCents": 5000,
    "amount": 50.00,
    "price": 50.00,
    "currency": "EUR",
    "priceId": "price_xxx",
    "stripePriceId": "price_xxx",
    "available": true,
    "type": "credit_topup",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
]
```

#### POST `/api/billing/purchase`
- **Auth:** Required (`requireAuth`)
- **Headers:** `Idempotency-Key` or `X-Idempotency-Key` (REQUIRED)
- **Body:**
```json
{
  "packageId": 1,
  "currency": "EUR" // optional
}
```
- **Idempotency:** ✅ Checks for existing purchase by `idempotencyKey`, returns existing session if found
- **Response (new):**
```json
{
  "ok": true,
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_xxx",
  "purchaseId": 123
}
```
- **Response (idempotent):**
```json
{
  "ok": true,
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_xxx",
  "purchaseId": 123,
  "status": "pending",
  "idempotent": true
}
```
- **Error Codes:**
  - `400 VALIDATION_ERROR` - Missing packageId
  - `400 MISSING_IDEMPOTENCY_KEY` - Missing idempotency header
  - `404 RESOURCE_NOT_FOUND` - Package not found
  - `503 STRIPE_NOT_CONFIGURED` - Stripe unavailable
  - `500 CONFIG_ERROR_CODE` - Stripe price ID not configured

#### GET `/api/billing/transactions`
- **Auth:** Required (`requireAuth`)
- **Query:** `page`, `pageSize` (max 100)
- **Response:**
```json
{
  "page": 1,
  "pageSize": 10,
  "total": 50,
  "items": [...]
}
```

#### GET `/api/billing/purchases`
- **Auth:** Required (`requireAuth`)
- **Query:** `page`, `pageSize`, `status` (optional: pending/paid/failed/refunded)
- **Response:**
```json
{
  "page": 1,
  "pageSize": 10,
  "total": 50,
  "items": [...]
}
```

### Subscription Endpoints

#### GET `/api/subscriptions/current`
- **Auth:** Required (`requireAuth`)
- **Response:**
```json
{
  "active": true,
  "planType": "starter",
  "status": "active",
  "stripeCustomerId": "cus_xxx",
  "stripeSubscriptionId": "sub_xxx",
  "lastFreeCreditsAllocatedAt": "2025-01-01T00:00:00Z",
  "plan": {
    "priceEur": 40,
    "freeCredits": 100,
    "stripePriceIdEnv": "STRIPE_PRICE_ID_SUB_STARTER_EUR"
  }
}
```

#### POST `/api/subscriptions/subscribe`
- **Auth:** Required (`requireAuth`)
- **Body:**
```json
{
  "planType": "starter" | "pro",
  "currency": "EUR" // optional
}
```
- **Validation:** Returns `400 ALREADY_SUBSCRIBED` if already subscribed
- **Response:**
```json
{
  "ok": true,
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_xxx",
  "planType": "starter",
  "currency": "EUR"
}
```

#### POST `/api/subscriptions/update`
- **Auth:** Required (`requireAuth`)
- **Body:**
```json
{
  "planType": "starter" | "pro",
  "currency": "EUR" // optional
}
```
- **Idempotency:** ✅ Checks Stripe metadata to prevent duplicate updates
- **Response:**
```json
{
  "ok": true,
  "message": "Subscription updated to starter plan successfully",
  "planType": "starter",
  "currency": "EUR"
}
```

#### POST `/api/subscriptions/cancel`
- **Auth:** Required (`requireAuth`)
- **Response:**
```json
{
  "ok": true,
  "message": "Subscription cancelled successfully"
}
```

#### GET `/api/subscriptions/portal`
- **Auth:** Required (`requireAuth`)
- **Customer Creation:** ✅ Creates Stripe customer if missing (`allowCreate: true`)
- **Response:**
```json
{
  "ok": true,
  "portalUrl": "https://billing.stripe.com/..."
}
```
- **Error Codes:**
  - `400 MISSING_CUSTOMER_ID` - No customer found and creation failed
  - `503 STRIPE_NOT_CONFIGURED` - Stripe unavailable
  - `502 STRIPE_PORTAL_ERROR` - Portal creation failed

### Prisma Models (Retail)

#### `Package`
```prisma
model Package {
  id         Int      @id @default(autoincrement())
  name       String   @unique
  units      Int
  priceCents Int
  priceCentsUsd Int?
  active     Boolean  @default(true)
  stripePriceIdEur String?
  stripePriceIdUsd String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

#### `Purchase`
```prisma
model Purchase {
  id         Int           @id @default(autoincrement())
  ownerId    Int
  packageId  Int
  units      Int
  priceCents Int
  status     PaymentStatus @default(pending)
  currency   String?      @db.VarChar(3)
  stripeSessionId       String? @unique
  stripePaymentIntentId String?
  stripeCustomerId      String?
  stripePriceId         String?
  idempotencyKey        String? @db.VarChar(128) // ✅ REQUIRED
  
  @@unique([ownerId, idempotencyKey])
}
```

---

## Shopify Current Implementation

### Billing Endpoints

#### GET `/api/billing/balance`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Response Shape:** ✅ Matches Retail (includes subscription)
- **Status:** ✅ **PARITY**

#### GET `/api/billing/packages`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Subscription Gating:** ✅ Returns empty array if subscription not active
- **Currency Support:** ✅ Supports EUR/USD via query param
- **ETag/304 Support:** ❌ **MISSING**
- **Response Shape:** ⚠️ Slightly different (missing `displayName`, `type`, `amount` alias)
- **Status:** ⚠️ **NEEDS ETag/304 + Response Shape Alignment**

#### POST `/api/billing/purchase`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Idempotency Key:** ❌ **MISSING** - No header check, no idempotency logic
- **Currency Support:** ✅ Supports EUR/USD
- **Response Shape:** ⚠️ Different (missing `idempotent` flag)
- **Error Codes:** ⚠️ Missing `MISSING_IDEMPOTENCY_KEY`
- **Status:** ❌ **NEEDS IDEMPOTENCY SUPPORT**

#### GET `/api/billing/history`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Response Shape:** ✅ Matches Retail pagination
- **Status:** ✅ **PARITY**

#### GET `/api/billing/billing-history`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Response Shape:** ✅ Matches Retail pagination
- **Status:** ✅ **PARITY**

### Subscription Endpoints

#### GET `/api/subscriptions/status`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Response Shape:** ✅ Matches Retail (but missing `plan` object)
- **Status:** ⚠️ **NEEDS PLAN OBJECT IN RESPONSE**

#### POST `/api/subscriptions/subscribe`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Currency Support:** ❌ **MISSING** - Hardcoded to EUR
- **Validation:** ✅ Returns `400 ALREADY_SUBSCRIBED` if already subscribed
- **Response Shape:** ✅ Matches Retail (but missing `currency`)
- **Status:** ⚠️ **NEEDS CURRENCY SUPPORT**

#### POST `/api/subscriptions/update`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Currency Support:** ❌ **MISSING** - Not passed to Stripe
- **Idempotency:** ✅ Checks Stripe metadata
- **Response Shape:** ⚠️ Missing `currency` in response
- **Status:** ⚠️ **NEEDS CURRENCY SUPPORT**

#### POST `/api/subscriptions/cancel`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Response Shape:** ✅ Matches Retail
- **Status:** ✅ **PARITY**

#### GET `/api/subscriptions/portal`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Customer Creation:** ❌ **MISSING** - Returns error if customer missing
- **Response Shape:** ✅ Matches Retail
- **Status:** ❌ **NEEDS CUSTOMER CREATION**

### Prisma Models (Shopify)

#### `Package`
```prisma
model Package {
  id         String   @id @default(cuid())
  name       String   @unique
  units      Int
  priceCents Int
  active     Boolean  @default(true)
  stripePriceIdEur String?
  stripePriceIdUsd String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```
- **Status:** ✅ **PARITY** (ID type difference is acceptable)

#### `Purchase`
```prisma
model Purchase {
  id         String        @id @default(cuid())
  shopId     String
  packageId  String
  units      Int
  priceCents Int
  status     PaymentStatus @default(pending)
  currency   String?       @db.VarChar(3)
  stripeSessionId       String? @unique
  stripePaymentIntentId String?
  stripeCustomerId      String?
  stripePriceId         String?
  // ❌ MISSING: idempotencyKey field
  // ❌ MISSING: @@unique([shopId, idempotencyKey])
}
```
- **Status:** ❌ **NEEDS IDEMPOTENCY KEY FIELD**

---

## Parity Matrix

| Feature | Retail Behavior | Shopify Current | Gap | Fix Plan | Files Involved |
|---------|---------------|----------------|-----|----------|----------------|
| **Packages Endpoint** |
| ETag/304 caching | ✅ Returns ETag, supports If-None-Match | ❌ No caching | Missing | Add ETag generation + 304 response | `controllers/billing.js`, `routes/billing.js` |
| Response shape | Includes `displayName`, `type`, `amount` | Missing fields | Shape mismatch | Add missing fields to response | `services/billing.js` |
| **Purchase Endpoint** |
| Idempotency key | ✅ Required header, checks existing purchase | ❌ No idempotency | Missing | Add header check, Purchase lookup, return existing session | `controllers/billing.js`, `services/billing.js` |
| Response shape | Includes `idempotent: true` flag | Missing flag | Shape mismatch | Add `idempotent` flag to response | `controllers/billing.js` |
| Error codes | `MISSING_IDEMPOTENCY_KEY` | Missing | Missing error code | Add validation + error response | `controllers/billing.js` |
| **Purchase Model** |
| idempotencyKey field | ✅ String? @db.VarChar(128) | ❌ Missing | Missing field | Add field + unique constraint | `prisma/schema.prisma`, migration |
| Unique constraint | @@unique([ownerId, idempotencyKey]) | ❌ Missing | Missing constraint | Add unique constraint | `prisma/schema.prisma`, migration |
| **Subscription Endpoints** |
| Currency support (subscribe) | ✅ Accepts currency param | ❌ Hardcoded EUR | Missing | Add currency param, pass to Stripe | `controllers/subscriptions.js`, `services/stripe.js` |
| Currency support (update) | ✅ Accepts currency param | ❌ Not passed to Stripe | Missing | Add currency param, pass to updateSubscription | `controllers/subscriptions.js`, `services/stripe.js` |
| Plan object in status | ✅ Returns plan config | ❌ Missing | Missing | Add plan config to response | `controllers/subscriptions.js` |
| **Portal Endpoint** |
| Customer creation | ✅ Creates customer if missing | ❌ Returns error | Missing | Add customer creation logic | `controllers/subscriptions.js`, `services/stripe.js` |
| **Currency Resolution** |
| Currency resolution | ✅ resolveBillingCurrency() | ⚠️ Basic shop.currency | Needs improvement | Add currency resolution service | `services/billing.js`, `services/subscription.js` |

---

## Detailed Gap Analysis

### 1. Purchase Idempotency (CRITICAL)

**Retail Implementation:**
- Requires `Idempotency-Key` or `X-Idempotency-Key` header
- Checks for existing purchase by `ownerId + idempotencyKey`
- Returns existing checkout session if found
- Creates purchase with `idempotencyKey` field

**Shopify Current:**
- No idempotency key header check
- No existing purchase lookup
- No `idempotencyKey` field in Purchase model

**Impact:** High - Duplicate purchases possible, no protection against retries

**Fix Required:**
1. Add `idempotencyKey` field to `Purchase` model
2. Add unique constraint `@@unique([shopId, idempotencyKey])`
3. Add header validation in `createPurchase` controller
4. Add existing purchase lookup logic
5. Return existing session if found

### 2. Packages ETag/304 Caching (IMPORTANT)

**Retail Implementation:**
- Generates ETag from package data hash
- Returns `ETag` header
- Checks `If-None-Match` header
- Returns `304 Not Modified` if ETag matches

**Shopify Current:**
- No ETag generation
- No 304 support
- Always returns full response

**Impact:** Medium - Unnecessary bandwidth usage, no caching benefits

**Fix Required:**
1. Generate ETag hash from package data
2. Set `ETag` header in response
3. Check `If-None-Match` header
4. Return `304` if match

### 3. Portal Customer Creation (IMPORTANT)

**Retail Implementation:**
- Calls `resolveStripeCustomerId` with `allowCreate: true`
- Creates Stripe customer if missing
- Updates user record with customer ID

**Shopify Current:**
- Returns error if customer missing
- No customer creation logic

**Impact:** Medium - Users can't access portal if customer not created

**Fix Required:**
1. Add customer creation logic to `getPortal` controller
2. Create customer with shop metadata
3. Update shop record with customer ID

### 4. Currency Support in Subscriptions (IMPORTANT)

**Retail Implementation:**
- `subscribe` endpoint accepts `currency` param
- `update` endpoint accepts `currency` param
- Passes currency to Stripe checkout/update

**Shopify Current:**
- `subscribe` hardcoded to EUR
- `update` doesn't pass currency to Stripe

**Impact:** Medium - No USD support for subscriptions

**Fix Required:**
1. Add `currency` param to subscribe/update schemas
2. Pass currency to Stripe service functions
3. Include currency in response

### 5. Response Shape Alignment (MINOR)

**Packages Response:**
- Retail includes: `displayName`, `type: "credit_topup"`, `amount` alias
- Shopify missing these fields

**Purchase Response:**
- Retail includes: `idempotent: true` flag for idempotent responses
- Shopify missing this flag

**Subscription Status Response:**
- Retail includes: `plan` object with config
- Shopify missing this

**Impact:** Low - Frontend may need adjustments, but not blocking

**Fix Required:**
1. Add missing fields to package response
2. Add `idempotent` flag to purchase response
3. Add `plan` object to subscription status response

---

## Implementation Priority

### Phase 1: Critical (Must Fix)
1. ✅ Purchase idempotency (header + model + logic)
2. ✅ Portal customer creation

### Phase 2: Important (Should Fix)
3. ✅ Packages ETag/304 caching
4. ✅ Currency support in subscriptions

### Phase 3: Nice to Have (Can Fix)
5. ✅ Response shape alignment

---

## Files to Modify

### Backend (apps/shopify-api)
- `prisma/schema.prisma` - Add `idempotencyKey` to Purchase
- `controllers/billing.js` - Add idempotency, ETag, response shape
- `controllers/subscriptions.js` - Add currency, customer creation, plan object
- `services/billing.js` - Add ETag generation, idempotency lookup
- `services/stripe.js` - Add currency support, customer creation
- `routes/billing.js` - No changes needed
- `routes/subscriptions.js` - No changes needed

### Frontend (apps/astronote-web/app/app/shopify)
- `billing/page.tsx` - May need minor adjustments for response shapes
- Hooks - May need updates for new response fields

### Prisma Migrations
- Create migration for `idempotencyKey` field + unique constraint

---

## Next Steps

1. ✅ Create audit report (this document)
2. ⏳ Implement Phase 1 fixes (idempotency + portal)
3. ⏳ Implement Phase 2 fixes (ETag + currency)
4. ⏳ Implement Phase 3 fixes (response shapes)
5. ⏳ Create verification script
6. ⏳ Create final parity report

---

**Report Status:** ✅ Complete  
**Ready for Implementation:** Yes

