# Shopify Subscription Gating & Allowance Audit Report

**Date:** 2025-01-27  
**Reference:** Retail API (`apps/retail-api/apps/api`) - Source of Truth  
**Target:** Shopify API (`apps/shopify-api`) - Must Match Retail Behavior  
**Status:** 🔍 **AUDIT COMPLETE**

---

## Executive Summary

This audit compares Shopify subscription and billing implementation against the Retail billing architecture to identify gaps in subscription gating, free SMS allowance tracking, and subscription management features.

**Key Findings:**
- ✅ Subscription status tracking exists (Shop model has subscriptionStatus, planType)
- ✅ Free credits allocation exists (allocateFreeCredits function)
- ⚠️ **Gap:** No allowance tracking per billing period (usedSmsThisPeriod, includedSmsPerPeriod)
- ⚠️ **Gap:** No subscription gating in campaign enqueue/send endpoints
- ⚠️ **Gap:** No monthly/yearly interval tracking
- ⚠️ **Gap:** No billing summary endpoint with allowance info
- ⚠️ **Gap:** No subscription switch endpoint (monthly/yearly)
- ⚠️ **Gap:** Frontend billing page doesn't show allowance or subscription management

---

## Phase 1: Retail Reference (Source of Truth)

### A) Retail Subscription Gating

**Location:** `apps/retail-api/apps/api/src/services/sms.service.js`

**Gating Logic:**
```javascript
// 1. Check subscription status first
const subscriptionActive = await isSubscriptionActive(ownerId);
if (!subscriptionActive) {
  return {
    sent: false,
    reason: 'inactive_subscription',
    error: 'Active subscription required to send SMS. Please subscribe to a plan.',
  };
}

// 2. Check balance before sending
const balance = await getBalance(ownerId);
if (balance < 1) {
  return {
    sent: false,
    reason: 'insufficient_credits',
    error: 'Not enough credits to send SMS. Please purchase credits.',
  };
}
```

**Key Points:**
- ✅ Subscription check happens BEFORE balance check
- ✅ Returns 403-like error with reason 'inactive_subscription'
- ✅ Blocks sending even if user has paid credits

### B) Retail Allowance Tracking

**Plan Configuration:**
- Starter: 100 free credits/month
- Pro: 500 free credits/year

**Allocation:**
- Credits allocated on billing cycle renewal (invoice.paid webhook)
- Idempotent (checks invoice ID to prevent duplicates)

**Consumption:**
- Free allowance used first, then paid credits
- No explicit allowance tracking table (uses wallet balance)

### C) Retail Subscription Management

**Endpoints:**
- GET `/api/subscriptions/status` - Get subscription status
- POST `/api/subscriptions/subscribe` - Create subscription
- POST `/api/subscriptions/update` - Update plan (starter/pro)
- POST `/api/subscriptions/cancel` - Cancel subscription
- GET `/api/subscriptions/portal` - Get Stripe portal URL

**Features:**
- Plan switching (starter ↔ pro)
- Subscription cancellation
- Payment method management (via Stripe portal)

---

## Phase 2: Shopify Current State

### A) Prisma Schema

**Shop Model (Current):**
```prisma
model Shop {
  // Subscription fields
  stripeCustomerId           String?
  stripeSubscriptionId       String?
  planType                   SubscriptionPlanType?
  subscriptionStatus         SubscriptionStatus    @default(inactive)
  lastFreeCreditsAllocatedAt DateTime?
}
```

**Gaps:**
- ⚠️ No `interval` field (monthly/yearly)
- ⚠️ No `currentPeriodStart` / `currentPeriodEnd`
- ⚠️ No `cancelAtPeriodEnd` flag
- ⚠️ No allowance tracking fields (usedSmsThisPeriod, includedSmsPerPeriod)

**Recommendation:**
- Option 1: Add fields to Shop model (simpler)
- Option 2: Create SubscriptionState table (more normalized)

**Decision:** Add fields to Shop model for simplicity (aligned with Retail approach).

### B) Backend Endpoints

**Current Endpoints:**
- ✅ GET `/api/subscriptions/status` - Exists
- ✅ POST `/api/subscriptions/subscribe` - Exists
- ✅ POST `/api/subscriptions/update` - Exists (planType only, no interval)
- ✅ POST `/api/subscriptions/cancel` - Exists
- ✅ GET `/api/subscriptions/portal` - Exists

**Missing Endpoints:**
- ⚠️ GET `/api/billing/summary` - Missing (should return subscription + allowance + credits)
- ⚠️ POST `/api/subscriptions/switch` - Missing (should handle monthly/yearly switch)

**Current Behavior:**
- `update` endpoint only changes planType (starter/pro), doesn't handle interval
- No allowance tracking in responses

### C) Campaign Enqueue/Send

**Location:** `apps/shopify-api/controllers/campaigns.js` (enqueue endpoint)

**Current State:**
- ✅ Credit validation exists
- ⚠️ **Missing:** Subscription status check
- ⚠️ **Missing:** Allowance tracking (free credits first, then paid)

**Gap:** No subscription gating - campaigns can be sent without active subscription.

### D) Frontend Billing Page

**Location:** `apps/astronote-web/app/app/shopify/billing/page.tsx`

**Current State:**
- ✅ Shows balance
- ✅ Shows subscription status
- ✅ Shows packages
- ⚠️ **Missing:** Allowance display (free SMS remaining)
- ⚠️ **Missing:** Monthly/yearly switch UI
- ⚠️ **Missing:** Subscription management actions (switch interval, cancel)

---

## Phase 3: Implementation Plan

### Step 1: Prisma Schema Updates

**Add to Shop model:**
```prisma
// Subscription interval (monthly/yearly)
subscriptionInterval String? // 'month' | 'year'

// Billing period tracking
currentPeriodStart DateTime?
currentPeriodEnd DateTime?
cancelAtPeriodEnd Boolean @default(false)

// Allowance tracking
includedSmsPerPeriod Int? // 100 for monthly, 500 for yearly
usedSmsThisPeriod Int @default(0)
lastPeriodResetAt DateTime?
```

**Migration:** Create migration to add these fields.

### Step 2: Backend Service Updates

**A) Subscription Service (`services/subscription.js`):**
- Add `getBillingSummary(shopId)` function
- Add `switchSubscriptionInterval(shopId, interval)` function
- Update `allocateFreeCredits` to track allowance
- Add `trackSmsUsage(shopId, count)` function
- Add `resetAllowanceForNewPeriod(shopId)` function

**B) Campaign Service (`services/campaigns.js`):**
- Add subscription gating check in `enqueueCampaign`
- Add allowance consumption logic (free first, then paid)
- Return 403 SUBSCRIPTION_REQUIRED if subscription inactive
- Return 402 INSUFFICIENT_BALANCE if allowance + credits insufficient

**C) Controllers:**
- Add `GET /api/billing/summary` endpoint
- Add `POST /api/subscriptions/switch` endpoint
- Update existing subscription endpoints to handle interval

### Step 3: Stripe Webhook Updates

**Location:** `apps/shopify-api/controllers/stripe-webhooks.js`

**Updates Needed:**
- `customer.subscription.updated` - Update interval, period dates, cancelAtPeriodEnd
- `invoice.paid` - Reset allowance for new period, allocate free credits
- `customer.subscription.deleted` - Deactivate subscription

### Step 4: Frontend Updates

**A) Billing Page (`billing/page.tsx`):**
- Add allowance display (free SMS remaining)
- Add monthly/yearly switch buttons
- Add cancel subscription button
- Show subscription status (active/cancelled/past_due)
- Show next renewal date

**B) API Client (`src/lib/shopify/api/billing.ts`):**
- Add `getBillingSummary()` function
- Add `switchSubscriptionInterval()` function

**C) Send UI:**
- Add subscription warning banner if inactive
- Disable send buttons if subscription inactive (UI-only, backend enforces)

---

## Phase 4: Requirements Matrix

| Feature | Retail Behavior | Shopify Current | Gap | Fix Plan |
|---------|----------------|-----------------|-----|----------|
| Subscription gating | ✅ Blocks sending if inactive | ❌ No gating | **CRITICAL** | Add check in enqueue endpoint |
| Allowance tracking | ✅ 100/month or 500/year | ❌ No tracking | **MAJOR** | Add fields + tracking logic |
| Free credits first | ✅ Uses allowance first | ❌ Not implemented | **MAJOR** | Implement consumption order |
| Monthly/yearly switch | ✅ Supported | ❌ No interval tracking | **MAJOR** | Add interval field + switch endpoint |
| Billing summary | ✅ Returns subscription + allowance | ❌ Missing | **MAJOR** | Create endpoint |
| Cancel subscription | ✅ Supported | ✅ Exists | ✅ | No change needed |
| Portal access | ✅ Supported | ✅ Exists | ✅ | No change needed |

---

## Phase 5: Implementation Checklist

### Backend (Priority: High)

- [ ] Add Prisma fields for allowance tracking
- [ ] Create migration for new fields
- [ ] Add subscription gating to campaign enqueue
- [ ] Add allowance consumption logic (free first, then paid)
- [ ] Add `getBillingSummary()` service function
- [ ] Add `switchSubscriptionInterval()` service function
- [ ] Add `trackSmsUsage()` service function
- [ ] Add `resetAllowanceForNewPeriod()` service function
- [ ] Create `GET /api/billing/summary` endpoint
- [ ] Create `POST /api/subscriptions/switch` endpoint
- [ ] Update Stripe webhooks to handle interval and period reset
- [ ] Update scheduled send jobs to check subscription at execution time

### Frontend (Priority: High)

- [ ] Add allowance display to billing page
- [ ] Add monthly/yearly switch UI
- [ ] Add cancel subscription button
- [ ] Add subscription warning banner
- [ ] Update API client with new endpoints
- [ ] Add loading/error states for subscription actions

### Verification (Priority: Medium)

- [ ] Create audit script for gating enforcement
- [ ] Add tests for subscription gating
- [ ] Add tests for allowance tracking
- [ ] Verify webhook idempotency

---

## Summary

**Overall Status:** ⚠️ **NEEDS IMPLEMENTATION** - Core gating and allowance tracking missing

**Critical Gaps:**
- ❌ No subscription gating in campaign enqueue
- ❌ No allowance tracking per billing period
- ❌ No monthly/yearly interval support
- ❌ No billing summary endpoint

**Next Step:** Implement all missing features to match Retail behavior.

---

**Report Generated:** 2025-01-27  
**Next Step:** Begin implementation

