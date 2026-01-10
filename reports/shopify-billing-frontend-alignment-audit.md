# Shopify Billing Frontend Alignment Audit Report

**Date:** 2025-01-27  
**Scope:** Shopify billing page and subscription management frontend alignment with backend

## Executive Summary

This audit examines the Shopify billing frontend implementation for:
1. **Backend contract compliance** - Endpoint usage, response parsing, error handling
2. **Frontend architecture** - Centralized API client usage, tenant headers, hooks
3. **UI/UX completeness** - Subscription status display, allowance tracking, actions (switch/cancel/portal)
4. **Prisma/backend/frontend contract harmony** - Field access, optional field guards

**Status:** ✅ **FULLY ALIGNED** - Frontend correctly uses backend endpoints with proper tenant safety

---

## A) Backend Billing Endpoints Inventory

### GET /api/billing/summary

**Route:** `GET /api/billing/summary`  
**Controller:** `apps/shopify-api/controllers/billing.js::getSummary`  
**Service:** `apps/shopify-api/services/subscription.js::getBillingSummary`

**Auth Requirements:**
- `Authorization: Bearer <token>` (JWT from `shopify_token` localStorage)
- `X-Shopify-Shop-Domain: <shop-domain>` (from `shopify_store` localStorage)

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "active": true,
      "planType": "starter" | "pro" | null,
      "status": "active" | "trialing" | "past_due" | "unpaid" | "incomplete" | "paused" | "inactive" | "cancelled",
      "interval": "month" | "year" | null,
      "currentPeriodStart": "2025-01-01T00:00:00Z" | null,
      "currentPeriodEnd": "2025-02-01T00:00:00Z" | null,
      "cancelAtPeriodEnd": false,
      "includedSmsPerPeriod": 100,
      "usedSmsThisPeriod": 25,
      "remainingSmsThisPeriod": 75,
      "billingCurrency": "EUR",
      "lastBillingError": null | string,
      "stripeCustomerId": "cus_xxx" | null,
      "stripeSubscriptionId": "sub_xxx" | null
    },
    "allowance": {
      "includedPerPeriod": 100,
      "usedThisPeriod": 25,
      "remainingThisPeriod": 75,
      "currentPeriodStart": "2025-01-01T00:00:00Z" | null,
      "currentPeriodEnd": "2025-02-01T00:00:00Z" | null,
      "interval": "month" | "year" | null
    },
    "credits": {
      "balance": 500,
      "currency": "EUR"
    },
    "billingCurrency": "EUR"
  }
}
```

**Error Codes:**
- `INVALID_SHOP_DOMAIN` (401) - Missing or invalid shop domain
- `401` - Missing or invalid JWT token

**Notes:**
- Returns complete billing state in single call
- Subscription, allowance, and credits all included
- All fields are optional/nullable for inactive subscriptions

---

### GET /api/billing/balance

**Route:** `GET /api/billing/balance`  
**Controller:** `apps/shopify-api/controllers/billing.js::getBalance`

**Auth Requirements:** Same as summary endpoint

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "credits": 500,
    "balance": 500,
    "currency": "EUR",
    "subscription": { ... } // Optional subscription status
  }
}
```

**Notes:**
- Used as fallback if summary not available
- Returns credit balance and optional subscription info

---

### GET /api/subscriptions/status

**Route:** `GET /api/subscriptions/status`  
**Controller:** `apps/shopify-api/controllers/subscriptions.js::getStatus`

**Auth Requirements:** Same as summary endpoint

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "active": true,
    "planType": "starter" | "pro" | null,
    "status": "active" | ...,
    "interval": "month" | "year" | null,
    "currentPeriodStart": "2025-01-01T00:00:00Z" | null,
    "currentPeriodEnd": "2025-02-01T00:00:00Z" | null,
    "cancelAtPeriodEnd": false,
    "includedSmsPerPeriod": 100,
    "usedSmsThisPeriod": 25,
    "remainingSmsThisPeriod": 75,
    "billingCurrency": "EUR",
    "lastBillingError": null | string,
    "plan": { ... } // Plan config object
  }
}
```

**Notes:**
- Returns subscription status with plan config
- Used as fallback if summary subscription not available

---

### POST /api/subscriptions/switch

**Route:** `POST /api/subscriptions/switch`  
**Controller:** `apps/shopify-api/controllers/subscriptions.js::switchInterval`

**Auth Requirements:** Same as summary endpoint

**Request Body:**
```json
{
  "interval": "month" | "year",
  "currency": "EUR" | "USD" // Optional
}
```

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "interval": "month" | "year",
    "planType": "starter" | "pro", // Optional
    "alreadyUpdated": false // Optional
  }
}
```

**Error Codes:**
- `VALIDATION_ERROR` (400) - Missing interval or planType
- `NO_ACTIVE_SUBSCRIPTION` (400) - No active subscription found
- `INVALID_SHOP_DOMAIN` (401) - Missing or invalid shop domain
- `401` - Missing or invalid JWT token

**Notes:**
- Switches subscription interval (monthly ↔ yearly)
- Can also update plan type if provided
- Requires active subscription

---

### POST /api/subscriptions/cancel

**Route:** `POST /api/subscriptions/cancel`  
**Controller:** `apps/shopify-api/controllers/subscriptions.js::cancel`

**Auth Requirements:** Same as summary endpoint

**Request Body:** None (empty object)

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "cancelledAt": "2025-01-27T10:00:00Z" // Optional
  }
}
```

**Error Codes:**
- `NO_ACTIVE_SUBSCRIPTION` (400) - No active subscription found
- `INVALID_SHOP_DOMAIN` (401) - Missing or invalid shop domain
- `401` - Missing or invalid JWT token

**Notes:**
- Cancels subscription (sets `cancelAtPeriodEnd: true`)
- Subscription remains active until period end

---

### GET /api/subscriptions/portal

**Route:** `GET /api/subscriptions/portal`  
**Controller:** `apps/shopify-api/controllers/subscriptions.js::getPortal`

**Auth Requirements:** Same as summary endpoint

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "portalUrl": "https://billing.stripe.com/session/xxx"
  }
}
```

**Error Codes:**
- `MISSING_CUSTOMER_ID` (400) - No Stripe customer ID found
- `INVALID_SHOP_DOMAIN` (401) - Missing or invalid shop domain
- `401` - Missing or invalid JWT token

**Notes:**
- Returns Stripe Customer Portal URL
- Opens in new window for payment method management

---

### POST /api/subscriptions/subscribe

**Route:** `POST /api/subscriptions/subscribe`  
**Controller:** `apps/shopify-api/controllers/subscriptions.js::subscribe`

**Auth Requirements:** Same as summary endpoint

**Request Body:**
```json
{
  "planType": "starter" | "pro",
  "currency": "EUR" | "USD" // Optional
}
```

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/xxx",
    "sessionId": "cs_xxx",
    "planType": "starter",
    "currency": "EUR"
  }
}
```

**Error Codes:**
- `ALREADY_SUBSCRIBED` (400) - Already has active subscription
- `MISSING_PRICE_ID` (400) - Payment configuration error
- `INVALID_PLAN_TYPE` (400) - Invalid plan type
- `INVALID_SHOP_DOMAIN` (401) - Missing or invalid shop domain
- `401` - Missing or invalid JWT token

**Notes:**
- Creates Stripe checkout session
- Redirects to checkout URL

---

### Other Endpoints (Credit Management)

- **GET /api/billing/packages** - List credit packages (requires subscription)
- **GET /api/billing/history** - Transaction history
- **POST /api/billing/purchase** - Purchase credit package
- **GET /api/billing/topup/calculate** - Calculate top-up price
- **POST /api/billing/topup** - Create top-up checkout session

---

## B) Frontend Billing Usage Inventory

### Billing Page

**File:** `apps/astronote-web/app/app/shopify/billing/page.tsx`

**Hooks Used:**
- ✅ `useBillingSummary()` - Gets billing summary (subscription + allowance + credits)
- ✅ `useBillingBalance()` - Fallback for credit balance
- ✅ `useSubscriptionStatus()` - Fallback for subscription status
- ✅ `useBillingPackages()` - Lists credit packages
- ✅ `useBillingHistory()` - Transaction history
- ✅ `useCalculateTopup()` - Calculate top-up price
- ✅ `useCreatePurchase()` - Purchase credit package
- ✅ `useCreateTopup()` - Create top-up checkout
- ✅ `useSubscribe()` - Subscribe to plan
- ✅ `useCancelSubscription()` - Cancel subscription
- ✅ `useGetPortal()` - Get Stripe portal URL
- ✅ `useSwitchInterval()` - Switch subscription interval

**API Calls:**
- ✅ All calls go through React Query hooks
- ✅ No direct `fetch` or `axios` calls
- ✅ All hooks use `shopifyBillingApi` wrapper

**UI Features:**
- ✅ Subscription status card (plan, interval, period dates, renewal date)
- ✅ Allowance display (included/used/remaining)
- ✅ Credits balance display
- ✅ Subscription actions:
  - ✅ Switch to Monthly/Yearly buttons
  - ✅ Cancel subscription button (with confirmation)
  - ✅ Manage payment method button (opens portal)
- ✅ Subscription required banner (when inactive)
- ✅ Credit top-up section
- ✅ Credit packages section (when subscription active)
- ✅ Transaction history table
- ✅ Loading states for all sections
- ✅ Error handling with toast notifications
- ✅ Payment failure display (`lastBillingError`)

**Data Normalization:**
- ✅ Prefers `billingSummary` if available
- ✅ Falls back to individual calls (`balance`, `subscriptionStatus`)
- ✅ Handles optional/nullable fields safely
- ✅ Type guards for subscription object (string vs object)

---

### Billing API Wrapper

**File:** `apps/astronote-web/src/lib/shopifyBillingApi.ts`

**Functions:**
- ✅ `getBillingSummary()` - GET /billing/summary
- ✅ `getBalance()` - GET /billing/balance
- ✅ `getSubscriptionStatus()` - GET /subscriptions/status
- ✅ `switchSubscription()` - POST /subscriptions/switch
- ✅ `cancelSubscription()` - POST /subscriptions/cancel
- ✅ `getBillingPortalUrl()` - GET /subscriptions/portal
- ✅ `subscribe()` - POST /subscriptions/subscribe
- ✅ `listCreditPackages()` - GET /billing/packages
- ✅ `getHistory()` - GET /billing/history
- ✅ `calculateTopup()` - GET /billing/topup/calculate
- ✅ `createTopup()` - POST /billing/topup
- ✅ `createPurchase()` - POST /billing/purchase

**Architecture:**
- ✅ Uses centralized `shopifyApi` axios instance
- ✅ Tenant headers injected automatically via axios interceptor
- ✅ Error normalization: `{ success: false, code, message, requestId? }`
- ✅ Runtime validation with Zod schemas for billing summary
- ✅ Safe parsing with default fallbacks

**Exports:**
- ✅ `shopifyBillingApi` - Main API object
- ✅ `billingApi` - Alias for backward compatibility
- ✅ `subscriptionsApi` - Subscription-specific functions

---

### React Query Hooks

**Location:** `apps/astronote-web/src/features/shopify/billing/hooks/`

**Hooks:**
- ✅ `useBillingSummary.ts` - Uses `billingApi.getSummary()`
- ✅ `useBillingBalance.ts` - Uses `billingApi.getBalance()`
- ✅ `useSubscriptionStatus.ts` - Uses `subscriptionsApi.getStatus()`
- ✅ `useBillingPackages.ts` - Uses `billingApi.getPackages()`
- ✅ `useBillingHistory.ts` - Uses `billingApi.getHistory()`
- ✅ `useCalculateTopup.ts` - Uses `billingApi.calculateTopup()`
- ✅ `useBillingMutations.ts` - Uses `billingApi.createPurchase()` and `billingApi.createTopup()`
- ✅ `useSubscriptionMutations.ts` - Uses `subscriptionsApi.*` functions

**All hooks:**
- ✅ Import from `shopifyBillingApi` (centralized wrapper)
- ✅ No direct API client usage
- ✅ Proper error handling with toast notifications
- ✅ Query invalidation on mutations

---

## C) Frontend Usage Table

| Endpoint | Method | Frontend Usage | Status |
|----------|--------|----------------|--------|
| GET /billing/summary | `getBillingSummary()` | `useBillingSummary()` hook | ✅ Correct |
| GET /billing/balance | `getBalance()` | `useBillingBalance()` hook (fallback) | ✅ Correct |
| GET /subscriptions/status | `getSubscriptionStatus()` | `useSubscriptionStatus()` hook (fallback) | ✅ Correct |
| POST /subscriptions/switch | `switchSubscription()` | `useSwitchInterval()` hook | ✅ Correct |
| POST /subscriptions/cancel | `cancelSubscription()` | `useCancelSubscription()` hook | ✅ Correct |
| GET /subscriptions/portal | `getBillingPortalUrl()` | `useGetPortal()` hook | ✅ Correct |
| POST /subscriptions/subscribe | `subscribe()` | `useSubscribe()` hook | ✅ Correct |
| GET /billing/packages | `listCreditPackages()` | `useBillingPackages()` hook | ✅ Correct |
| GET /billing/history | `getHistory()` | `useBillingHistory()` hook | ✅ Correct |
| GET /billing/topup/calculate | `calculateTopup()` | `useCalculateTopup()` hook | ✅ Correct |
| POST /billing/topup | `createTopup()` | `useCreateTopup()` hook | ✅ Correct |
| POST /billing/purchase | `createPurchase()` | `useCreatePurchase()` hook | ✅ Correct |

**Tenant Header Injection:**
- ✅ All calls use `shopifyApi` axios instance
- ✅ Request interceptor injects `Authorization: Bearer <token>`
- ✅ Request interceptor injects `X-Shopify-Shop-Domain: <shop-domain>`
- ✅ No direct `fetch` or `axios` calls bypassing headers

---

## D) UI Features Matrix

| Feature | Status | Implementation |
|---------|--------|----------------|
| **Subscription Display** |
| Plan type (starter/pro) | ✅ | Displayed in subscription card |
| Interval (month/year) | ✅ | Displayed with plan |
| Status badge | ✅ | Color-coded (active/warning/danger) |
| Period start/end dates | ✅ | Formatted dates displayed |
| Renewal date | ✅ | Shows "Renews on" or "Cancels on" |
| Cancel at period end | ✅ | Displayed in renewal message |
| Payment failure error | ✅ | `lastBillingError` displayed in banner |
| **Allowance Display** |
| Included per period | ✅ | From `allowance.includedPerPeriod` |
| Used this period | ✅ | From `allowance.usedThisPeriod` |
| Remaining this period | ✅ | From `allowance.remainingThisPeriod` |
| Period dates | ✅ | From `allowance.currentPeriodStart/End` |
| Interval | ✅ | From `allowance.interval` |
| **Credits Display** |
| Current balance | ✅ | Large display with currency |
| Low balance warning | ✅ | Red banner if balance < 100 |
| Currency display | ✅ | Shows billing currency |
| **Actions** |
| Switch to Monthly | ✅ | Button (disabled if already monthly) |
| Switch to Yearly | ✅ | Button (disabled if already yearly) |
| Cancel subscription | ✅ | Button with confirmation dialog |
| Manage payment method | ✅ | Opens Stripe portal in new window |
| Subscribe to plan | ✅ | Starter/Pro plan cards with subscribe buttons |
| **Credit Management** |
| Top-up calculator | ✅ | Real-time price calculation |
| Top-up purchase | ✅ | Creates checkout session |
| Credit packages | ✅ | Grid of packages (subscription required) |
| Package purchase | ✅ | Creates checkout session |
| Transaction history | ✅ | Paginated table |
| **UX** |
| Loading states | ✅ | Spinners for all async operations |
| Error handling | ✅ | Toast notifications for errors |
| Disabled states | ✅ | Buttons disabled during mutations |
| Confirmation dialogs | ✅ | Cancel subscription confirmation |
| Subscription required banner | ✅ | Shown when subscription inactive |
| Empty states | ✅ | For packages, history when empty |

---

## E) Mismatches and Fix Plan

### No Critical Mismatches Found ✅

**All checks passing:**
- ✅ Backend endpoints exist and match frontend usage
- ✅ Frontend uses centralized API wrapper
- ✅ Tenant headers injected correctly
- ✅ Response shapes match frontend expectations
- ✅ Optional fields guarded with fallbacks
- ✅ Error handling implemented correctly

### Minor Observations (Non-Blocking)

1. **Data Normalization Complexity**
   - **Current:** Billing page has complex normalization logic to handle multiple data sources (summary, balance, subscriptionStatus)
   - **Impact:** Low - Works correctly, but could be simplified if always using summary
   - **Recommendation:** Prefer `billingSummary` as single source of truth (already implemented)

2. **Subscription Type Handling**
   - **Current:** Handles subscription as both string and object
   - **Impact:** Low - Type guards prevent crashes
   - **Recommendation:** Backend should always return object (already does in summary)

3. **Allowance Display Logic**
   - **Current:** Shows allowance from `summary.allowance` if available
   - **Impact:** None - Correctly displays allowance data
   - **Recommendation:** Keep current implementation

---

## F) Prisma/Backend/Frontend Contract Harmony

### Field Access Verification

**Subscription Fields:**
- ✅ `active` - Boolean, always present
- ✅ `planType` - `'starter' | 'pro' | null`, guarded
- ✅ `status` - String enum, guarded
- ✅ `interval` - `'month' | 'year' | null`, guarded
- ✅ `currentPeriodStart` - ISO string or null, guarded
- ✅ `currentPeriodEnd` - ISO string or null, guarded
- ✅ `cancelAtPeriodEnd` - Boolean, defaults to false
- ✅ `includedSmsPerPeriod` - Number, defaults to 0
- ✅ `usedSmsThisPeriod` - Number, defaults to 0
- ✅ `remainingSmsThisPeriod` - Number, calculated
- ✅ `billingCurrency` - String, defaults to 'EUR'
- ✅ `lastBillingError` - String or null, guarded
- ✅ `stripeCustomerId` - String or null, guarded
- ✅ `stripeSubscriptionId` - String or null, guarded

**Allowance Fields:**
- ✅ `includedPerPeriod` - Number, defaults to 0
- ✅ `usedThisPeriod` - Number, defaults to 0
- ✅ `remainingThisPeriod` - Number, calculated
- ✅ `currentPeriodStart` - ISO string or null, guarded
- ✅ `currentPeriodEnd` - ISO string or null, guarded
- ✅ `interval` - `'month' | 'year' | null`, guarded

**Credits Fields:**
- ✅ `balance` - Number, defaults to 0
- ✅ `currency` - String, defaults to 'EUR'

**All fields:**
- ✅ Optional/nullable fields guarded with `|| null` or `|| 0` or `|| 'EUR'`
- ✅ No direct property access without guards
- ✅ Type guards for subscription object (string vs object)
- ✅ Runtime validation with Zod schemas in API wrapper

---

## G) Critical Rules Validation

### ✅ Tenant Safety
- All API calls use centralized `shopifyApi` client
- Tenant headers (`Authorization`, `X-Shopify-Shop-Domain`) injected automatically
- Backend queries scoped by `shopId: storeId`
- No direct fetch/axios calls bypassing tenant headers

### ✅ Error Handling
- Centralized error handling via axios interceptors
- React Query hooks handle errors with toast notifications
- Error codes properly mapped to user-friendly messages
- Normalized error shape: `{ success: false, code, message, requestId? }`

### ✅ UI/UX Completeness
- All subscription status fields displayed
- Allowance tracking displayed (included/used/remaining)
- Credits balance displayed
- All actions wired (switch/cancel/portal)
- Loading states for all async operations
- Error states with toast notifications
- Confirmation dialogs for destructive actions
- Subscription required banner when inactive

### ✅ Code Quality
- No direct API calls in pages (all via hooks)
- Centralized API wrapper with error normalization
- Runtime validation with Zod schemas
- Safe field access with guards and fallbacks
- TypeScript types for all API responses

---

## H) Recommendations

1. **Keep current architecture** - Centralized API client with tenant headers is correct
2. **Prefer billing summary** - Use `getBillingSummary()` as single source of truth (already implemented)
3. **Maintain field guards** - Continue guarding optional/nullable fields
4. **No changes needed** - Implementation is fully aligned with backend

---

## Conclusion

**Overall Status:** ✅ **FULLY ALIGNED**

The Shopify billing frontend is correctly implemented with:
- ✅ Proper endpoint usage via centralized API client
- ✅ Automatic tenant header injection
- ✅ Complete UI features (subscription, allowance, credits, actions)
- ✅ Robust error handling and loading states
- ✅ Safe field access with guards
- ✅ All verification gates passing

**No fixes required** - Frontend is production-ready and fully aligned with backend billing/subscription implementation.
