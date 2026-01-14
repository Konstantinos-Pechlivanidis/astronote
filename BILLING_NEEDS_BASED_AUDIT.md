# Minimal Billing Data Model - Needs-Based Audit

**Date**: 2025-02-06  
**Purpose**: Define what we MUST store vs what we MUST derive from Stripe

---

## Core Principle

**Stripe is the authoritative source of truth for subscription state.**  
**Our DB is a cache/snapshot that must always be synced to match Stripe.**

---

## MUST STORE (DB as System-of-Record)

### 1. Stripe Identifiers (Required for Lookups)
- ✅ `Shop.stripeCustomerId` (String, unique)
  - **Why**: Required to fetch customer/subscription from Stripe
  - **Source**: Created by Stripe, stored after checkout/webhook
  - **Must be unique**: One customer per shop

- ✅ `Shop.stripeSubscriptionId` (String, unique)
  - **Why**: Required to fetch subscription from Stripe
  - **Source**: Created by Stripe, stored after checkout/webhook
  - **Must be unique**: One active subscription per shop

### 2. Pending Changes (Only for Scheduled Downgrades)
- ✅ `Subscription.pendingChangePlanCode` (String?)
- ✅ `Subscription.pendingChangeInterval` (String?)
- ✅ `Subscription.pendingChangeCurrency` (String?)
- ✅ `Subscription.pendingChangeEffectiveAt` (DateTime?)
  - **Why**: Special rule: Pro Yearly downgrades are scheduled at period end
  - **Source**: Set by backend when scheduling a downgrade
  - **Must be cleared**: When change takes effect or is canceled

### 3. Wallet/Credits Ledger (Product Feature)
- ✅ `Wallet.balance` (Int)
- ✅ `Wallet.totalUsed` (Int)
- ✅ `Wallet.totalBought` (Int)
- ✅ `CreditTransaction` records (immutable ledger)
  - **Why**: Credits are part of the product (SMS credits)
  - **Source**: Internal system (purchases, usage, allocations)
  - **Must be accurate**: Used for billing and quota enforcement

### 4. Billing Profile Snapshot (Optional but Useful)
- ✅ `ShopBillingProfile` (email, name, address, VAT/AFM)
  - **Why**: Useful for pre-filling checkout, displaying in UI
  - **Source**: Synced from Stripe Checkout/Customer after payment
  - **Can be derived**: But storing it improves UX and reduces Stripe API calls

### 5. Webhook Event Deduplication
- ✅ `WebhookEvent.providerEventId` (String, unique)
  - **Why**: Prevent duplicate processing (idempotency)
  - **Source**: Stripe webhook event ID
  - **Must be unique**: One event processed once

### 6. Reconciliation Metadata
- ✅ `Subscription.lastSyncedAt` (DateTime?)
- ✅ `Subscription.sourceOfTruth` (String?) // "webhook" | "reconcile" | "finalize"
  - **Why**: Track when DB was last synced and how
  - **Source**: Set by StripeSyncService
  - **Useful for**: Debugging and audit trails

---

## MUST NOT STORE (Derive from Stripe)

### 1. Raw Stripe Objects
- ❌ **Never store** full Stripe subscription objects in scalar fields
- ❌ **Never assign** `stripeSubscription` object to `subscriptionInterval` or `planType`
- ✅ **Use**: `stripe-mapping.js` helpers to extract canonical fields

### 2. Plan/Interval Derived from Metadata
- ❌ **Don't trust** `subscription.metadata.planType` as source of truth
- ✅ **Always derive** from Stripe `priceId` via Plan Catalog reverse lookup
- ✅ **Use**: `plan-catalog.resolvePlanFromPriceId(priceId)`

### 3. Invoice Details (Optional Cache)
- ⚠️ **Can cache** `InvoiceRecord` for performance, but not required
- ✅ **Can fetch live** from Stripe API when needed
- ✅ **If cached**: Must be synced via webhooks or periodic job

### 4. Subscription Status (Derive from Stripe)
- ❌ **Don't store** status without syncing from Stripe
- ✅ **Always sync** via StripeSyncService after any Stripe operation
- ✅ **Use**: `getSubscriptionStatusWithStripeSync()` which fetches from Stripe

---

## Architecture Rules

### Rule 1: Stripe is Truth
- All subscription state comes from Stripe
- DB is a cache that must match Stripe
- If DB and Stripe differ, Stripe wins

### Rule 2: Sync Points
DB is synced to Stripe via:
1. **Webhooks** (primary, idempotent)
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

2. **Immediate reconcile** (after user actions)
   - After `subscribe` → call `finalize` → sync
   - After `change` → call StripeSyncService
   - After `cancel` → call StripeSyncService
   - After `resume` → call StripeSyncService

3. **Manual reconcile** (fallback)
   - `POST /subscriptions/reconcile` endpoint
   - Used when webhooks are delayed or missed

### Rule 3: Canonical Field Mapping
- **planCode**: Derived from `priceId` via Plan Catalog reverse lookup
- **interval**: Extracted from `subscription.items.data[0].price.recurring.interval`
- **currency**: From `subscription.currency` or `price.currency`
- **status**: From `subscription.status`
- **currentPeriodEnd**: From `subscription.current_period_end`
- **cancelAtPeriodEnd**: From `subscription.cancel_at_period_end`

### Rule 4: Change Behavior
- **Upgrades**: Immediate (proration via Stripe)
- **Downgrades**: Immediate EXCEPT Pro Yearly → schedule at period end
- **Interval switch (month↔year)**: Immediate (proration via Stripe)
- **Cancel**: `cancel_at_period_end: true` (professional behavior)

### Rule 5: Tenant Isolation
- Every billing record must be scoped by `shopId`
- `stripeCustomerId` must be unique (one per shop)
- Webhook events must resolve to `shopId` before processing

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Storing Stripe Objects in Scalar Fields
```javascript
// BAD
await prisma.shop.update({
  data: {
    subscriptionInterval: stripeSubscription, // ❌ Object in scalar field
  },
});

// GOOD
const { mapStripeSubscriptionToShopUpdate } = await import('./stripe-mapping.js');
const updateData = mapStripeSubscriptionToShopUpdate(stripeSubscription);
await prisma.shop.update({
  data: updateData, // ✅ Only scalar values
});
```

### ❌ Anti-Pattern 2: Trusting Metadata Over PriceId
```javascript
// BAD
const planType = subscription.metadata.planType; // ❌ May be stale

// GOOD
const planCatalog = await import('./plan-catalog.js');
const priceId = subscription.items.data[0].price.id;
const { planCode } = planCatalog.resolvePlanFromPriceId(priceId); // ✅ Source of truth
```

### ❌ Anti-Pattern 3: Not Syncing After Stripe Operations
```javascript
// BAD
await stripe.subscriptions.update(subscriptionId, { ... });
// ❌ DB not updated

// GOOD
await stripe.subscriptions.update(subscriptionId, { ... });
const { fetchStripeSubscription, deriveCanonicalFields, syncDbToStripe } = await import('./stripe-sync.js');
const updatedSub = await fetchStripeSubscription(subscriptionId);
const canonicalFields = await deriveCanonicalFields(updatedSub);
await syncDbToStripe(shopId, canonicalFields, 'subscription_change'); // ✅ DB synced
```

### ❌ Anti-Pattern 4: Storing Invoice Details Without Sync
```javascript
// BAD
await prisma.invoiceRecord.create({
  data: invoiceData, // ❌ May become stale
});

// GOOD (if caching)
// Sync via webhook `invoice.paid` or periodic job
// OR fetch live from Stripe when needed
```

---

## Current Implementation Status

### ✅ Correctly Implemented
1. **StripeSyncService**: `apps/shopify-api/services/stripe-sync.js`
   - Fetches from Stripe
   - Derives canonical fields
   - Syncs to DB

2. **Stripe Mapping Helpers**: `apps/shopify-api/services/stripe-mapping.js`
   - `mapStripeSubscriptionToShopUpdate()`: Extracts scalar values
   - `extractIntervalFromStripeSubscription()`: Normalizes interval

3. **Plan Catalog**: `apps/shopify-api/services/plan-catalog.js`
   - Forward: `(planCode, interval, currency) -> priceId`
   - Reverse: `priceId -> (planCode, interval, currency)`

4. **Webhook Idempotency**: `WebhookEvent` table with `providerEventId UNIQUE`

5. **Tenant Isolation**: All queries scoped by `shopId`

### ⚠️ Areas to Verify
1. **All `activateSubscription` calls** use `stripe-mapping.js` helpers
2. **All `updateSubscription` calls** sync via StripeSyncService
3. **No direct Stripe object assignments** to Prisma scalar fields
4. **Invoice caching** (if used) is synced via webhooks

---

## Summary

**Store in DB:**
- Stripe identifiers (customerId, subscriptionId)
- Pending changes (scheduled downgrades only)
- Wallet/credits ledger (product feature)
- Billing profile snapshot (optional, for UX)
- Webhook deduplication (idempotency)
- Reconciliation metadata (audit trail)

**Derive from Stripe:**
- Plan code, interval, currency (from priceId reverse lookup)
- Subscription status (from Stripe API)
- Invoice details (fetch live or cache with sync)
- All subscription state (via StripeSyncService)

**Never store:**
- Raw Stripe objects in scalar fields
- Stale metadata-derived values
- Subscription state without syncing from Stripe

