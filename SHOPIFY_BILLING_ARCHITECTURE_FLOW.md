# Shopify Billing Solution - Complete Architecture & Implementation Flow

**Ημερομηνία**: 2025-02-06  
**Κατάσταση**: ✅ Production-Ready  
**Version**: 2.0

---

## 📋 Περιεχόμενα

1. [Architecture Overview](#architecture-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Webhook Processing Flow](#webhook-processing-flow)
6. [Credit Granting Flow](#credit-granting-flow)
7. [Invoice & Purchase History Flow](#invoice--purchase-history-flow)
8. [Database Schema](#database-schema)
9. [Frontend-Backend Interaction](#frontend-backend-interaction)
10. [Error Handling & Idempotency](#error-handling--idempotency)
11. [Plan Catalog System](#plan-catalog-system)
12. [Stripe Sync Service](#stripe-sync-service)
13. [Subscription Lifecycle](#subscription-lifecycle)

---

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
│  (apps/astronote-web/app/app/shopify/billing/page.tsx)          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ React Query  │  │ Action Matrix│  │ UI Components│          │
│  │   Hooks      │  │   Utils      │  │   (Cards)    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                  │
│         └─────────────────┴──────────────────┘                 │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │ HTTP/REST API
                             │ (X-Shopify-Shop-Domain header)
┌────────────────────────────┼─────────────────────────────────────┐
│                        BACKEND LAYER                             │
│  (apps/shopify-api)                                               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MIDDLEWARE LAYER                             │   │
│  │  ┌──────────────────┐  ┌──────────────────┐            │   │
│  │  │ Store Resolution │  │  Authentication   │            │   │
│  │  │  (Tenant Truth)  │  │  (JWT/Header)     │            │   │
│  │  └──────────────────┘  └──────────────────┘            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              CONTROLLER LAYER                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ Subscriptions│  │    Billing   │  │   Webhooks   │   │   │
│  │  │  Controller  │  │  Controller │  │   Handler    │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │   │
│  └─────────┼──────────────────┼──────────────────┼──────────┘   │
│            │                  │                  │                │
│  ┌─────────┼──────────────────┼──────────────────┼──────────┐   │
│  │         │                  │                  │          │   │
│  │  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐ │   │
│  │  │ Subscription │  │    Billing   │  │   Stripe     │ │   │
│  │  │   Service    │  │   Service    │  │   Service    │ │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │   │
│  │         │                  │                  │          │   │
│  │  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐ │   │
│  │  │ Plan Catalog │  │ Wallet       │  │ Stripe Sync  │ │   │
│  │  │   Service    │  │ Service     │  │   Service    │ │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │   │
│  │         │                  │                  │          │   │
│  └─────────┼──────────────────┼──────────────────┼──────────┘   │
│            │                  │                  │                │
└────────────┼──────────────────┼──────────────────┼───────────────┘
             │                  │                  │
             │                  │                  │
┌────────────┼──────────────────┼──────────────────┼───────────────┐
│            │                  │                  │               │
│  ┌─────────▼──────────┐  ┌───▼──────────┐  ┌───▼──────────┐  │
│  │   Prisma ORM       │  │   Stripe API  │  │   Logger     │  │
│  │   (PostgreSQL)     │  │   (External)  │  │   (Pino)     │  │
│  └────────────────────┘  └───────────────┘  └──────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Stripe as Source of Truth**: Stripe είναι η μόνη πηγή αλήθειας για subscriptions, invoices, και payments
2. **DB as Cache/Mirror**: Η βάση δεδομένων είναι mirror του Stripe state για performance
3. **Idempotency Everywhere**: Όλες οι operations είναι idempotent (webhooks, credit grants, transactions)
4. **Tenant Isolation**: Κάθε shop (tenant) είναι απομονωμένο με `shopId` scoping
5. **Plan Catalog Centralization**: Single source of truth για plan → priceId mapping

---

## 🧩 Component Architecture

### Backend Services

#### 1. Plan Catalog Service (`services/plan-catalog.js`)

**Ρόλος**: Single source of truth για subscription plan mapping

**Key Functions**:
- `getPriceId(planCode, interval, currency)` → Stripe priceId
- `resolvePlanFromPriceId(priceId)` → {planCode, interval, currency}
- `getPlanChangeType(currentPlan, targetPlan)` → 'upgrade' | 'downgrade' | 'same'
- `validateCatalog()` → {valid: boolean, missing: string[]}

**Configuration**:
```javascript
PLAN_CATALOG_CONFIG = {
  starter: {
    month: { EUR: 'STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR', USD: '...' },
    year: { EUR: 'STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR', USD: '...' }
  },
  pro: {
    month: { EUR: 'STRIPE_PRICE_ID_SUB_PRO_MONTH_EUR', USD: '...' },
    year: { EUR: 'STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR', USD: '...' }
  }
}
```

**Usage**:
- Όλα τα subscription endpoints χρησιμοποιούν Plan Catalog
- Webhooks χρησιμοποιούν reverse lookup για να derive plan από priceId
- Frontend δεν έχει hardcoded priceIds

#### 2. Stripe Sync Service (`services/stripe-sync.js`)

**Ρόλος**: Εξασφαλίζει absolute transparency μεταξύ Stripe ↔ DB

**Key Functions**:
- `fetchStripeSubscription(subscriptionId)` → Stripe subscription object
- `deriveCanonicalFields(stripeSubscription)` → {planCode, interval, currency, status, ...}
- `syncDbToStripe(shopId, canonicalFields, sourceOfTruth)` → Updates DB
- `getSubscriptionStatusWithStripeSync(shopId)` → Always fetches from Stripe, updates DB if mismatch

**Flow**:
```
1. Read DB (for cached fields like SMS usage)
2. Fetch from Stripe (source of truth)
3. Derive canonical fields via Plan Catalog
4. Compare DB vs Stripe
5. If mismatch → Update DB immediately
6. Return canonical DTO (always from Stripe truth)
```

**Mismatch Detection**:
- Compares: planCode, interval, currency, status, cancelAtPeriodEnd
- Logs warning on mismatch
- Auto-corrects DB to match Stripe

#### 3. Subscription Service (`services/subscription.js`)

**Ρόλος**: Core business logic για subscription management

**Key Functions**:
- `getSubscriptionStatus(shopId)` → Subscription DTO
- `activateSubscription(shopId, customerId, subscriptionId, planType, interval)` → Activates subscription
- `allocateFreeCredits(shopId, planType, idempotencyKey, stripeSubscription)` → Grants credits
- `switchSubscriptionInterval(shopId, interval, behavior)` → Switches monthly/yearly
- `reconcileSubscriptionFromStripe(shopId)` → Manual reconciliation

**Credit Granting Policy**:
- Starter Monthly: 100 credits per billing cycle
- Starter Yearly: 100 credits per billing cycle
- Pro Monthly: 500 credits per billing cycle
- Pro Yearly: 500 credits per billing cycle

**Idempotency**:
- Uses `idempotencyKey` format: `sub_{subscriptionId}` or `stripe:invoice:{invoiceId}`
- Checks `CreditTransaction` table before granting
- Prevents duplicate grants for same period

#### 4. Wallet Service (`services/wallet.js`)

**Ρόλος**: Atomic credit management

**Key Functions**:
- `credit(shopId, amount, type, reason, idempotencyKey)` → Adds credits
- `debit(shopId, amount, type, reason, idempotencyKey)` → Removes credits
- `getBalance(shopId)` → Current balance

**Atomicity**:
- Uses Prisma transactions
- Updates `Wallet.balance` and creates `CreditTransaction` atomically
- Prevents race conditions with `idempotencyKey` UNIQUE constraint

#### 5. Billing Service (`services/billing.js`)

**Ρόλος**: Billing history and transaction management

**Key Functions**:
- `getBillingHistory(shopId, filters)` → Unified purchase history
- Transforms `BillingTransaction` records to frontend-friendly DTOs
- Includes transaction types: `subscription_charge`, `credit_pack_purchase`, `subscription_included_credits`

#### 6. Invoices Service (`services/invoices.js`)

**Ρόλος**: Invoice management with Stripe fallback

**Key Functions**:
- `listInvoices(shopId, filters)` → Invoice list (DB-first, Stripe fallback)
- `upsertInvoiceRecord(shopId, stripeInvoice)` → Stores invoice in DB
- `recordFreeCreditsGrant(shopId, planType, credits, invoiceId, periodInfo)` → Records free credits in purchase history
- `recordSubscriptionInvoiceTransaction(shopId, invoice, options)` → Records subscription charge

**Stripe Fallback**:
- If DB is empty → Fetches from Stripe API
- Syncs invoices to DB for future requests
- Ensures UI always has data even if webhooks missed

#### 7. Stripe Service (`services/stripe.js`)

**Ρόλος**: Stripe API wrapper

**Key Functions**:
- `createSubscriptionCheckoutSession({shopId, planType, interval, currency, ...})` → Creates checkout session
- `updateSubscription(subscriptionId, newPlanType, currency, interval, behavior)` → Updates subscription
- `cancelSubscription(subscriptionId)` → Cancels subscription
- `resumeSubscription(subscriptionId)` → Resumes cancelled subscription
- `ensureStripeCustomer({shopId, shopDomain, billingProfile})` → Creates/updates Stripe customer

**Checkout Configuration**:
- `billing_address_collection: 'required'`
- `tax_id_collection: { enabled: true }`
- `automatic_tax: { enabled: true }`
- `customer_email` from billing profile (if available)

#### 8. Billing Profile Service (`services/billing-profile.js`)

**Ρόλος**: Billing profile management

**Key Functions**:
- `getBillingProfile(shopId)` → Billing profile
- `upsertBillingProfile(shopId, data)` → Creates/updates profile
- `syncBillingProfileFromStripe(shopId, stripeCustomer)` → Syncs from Stripe customer
- `validateBillingProfileForCheckout(profile)` → Validates completeness

**VAT/AFM Rules**:
- Required: billingEmail, legalName, country, address.line1
- If country=GR and isBusiness=true → VAT number required

---

## 🔄 Data Flow Diagrams

### 1. Subscription Subscribe Flow

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │ POST /subscriptions/subscribe
       │ { planType: 'pro', interval: 'year', currency: 'EUR' }
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Middleware: Store Resolution                               │
│  - Extracts shopId from X-Shopify-Shop-Domain header       │
│  - Validates shop domain format                            │
│  - Sets req.ctx.store = { id: shopId, shopDomain: ... }    │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller: subscriptions.subscribe()                      │
│  1. Validates request body (planType, interval, currency)    │
│  2. Checks if shop already has active subscription         │
│  3. Resolves interval (defaults: starter=month, pro=year)  │
│  4. Resolves currency (from shop or request)               │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: Plan Catalog                                       │
│  - getPriceId('pro', 'year', 'EUR')                         │
│  - Returns: 'price_xxx' (from env var)                      │
│  - Validates priceId exists in Stripe                       │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: Stripe.createSubscriptionCheckoutSession()         │
│  1. Creates Stripe customer (if not exists)                 │
│  2. Creates checkout session with:                          │
│     - priceId (from Plan Catalog)                           │
│     - success_url: .../success?session_id={CHECKOUT_SESSION_ID}
│     - cancel_url: .../cancel                                │
│     - billing_address_collection: 'required'                 │
│     - tax_id_collection: { enabled: true }                  │
│     - metadata: { shopId, planType, interval, currency }   │
│  3. Returns checkout session URL                            │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Frontend  │
│  Redirects  │
│  to Stripe  │
└─────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Stripe Checkout                                             │
│  - User enters payment details                               │
│  - User enters billing address                               │
│  - User enters VAT/AFM (if applicable)                       │
│  - Payment processed                                         │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Webhook: checkout.session.completed                         │
│  (See Webhook Processing Flow)                               │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Frontend  │
│  Success    │
│  Page       │
└─────────────┘
```

### 2. Subscription Status Flow

```
┌─────────────┐
│   Frontend  │
│  GET /subscriptions/status
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller: subscriptions.getStatus()                       │
│  1. Gets shopId from middleware                              │
│  2. Calls getSubscriptionStatus(shopId)                      │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: stripe-sync.getSubscriptionStatusWithStripeSync()  │
│                                                              │
│  1. Read DB (Shop + Subscription records)                    │
│     - planType, interval, currency, status                   │
│     - currentPeriodEnd, cancelAtPeriodEnd                    │
│     - pendingChange fields                                   │
│                                                              │
│  2. Fetch from Stripe (if stripeSubscriptionId exists)       │
│     - stripe.subscriptions.retrieve(subscriptionId)          │
│                                                              │
│  3. Derive canonical fields                                  │
│     - Extract priceId from subscription.items[0].price.id    │
│     - Plan Catalog: resolvePlanFromPriceId(priceId)          │
│       → { planCode: 'pro', interval: 'year', currency: 'EUR' }
│     - Extract status, dates, cancelAtPeriodEnd               │
│                                                              │
│  4. Compare DB vs Stripe                                     │
│     - If mismatch → syncDbToStripe(shopId, canonicalFields)  │
│     - Logs warning if mismatch detected                     │
│                                                              │
│  5. Return canonical DTO                                     │
│     - Always from Stripe truth                               │
│     - Includes pendingChange if scheduled                    │
│     - Includes mismatchDetected flag (dev only)              │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: subscription-actions.computeAllowedActions()        │
│  - Computes allowed actions based on subscription state      │
│  - Returns: ['changePlan', 'switchInterval', ...]            │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Frontend  │
│  Receives:  │
│  {          │
│    planCode: 'pro',                                          │
│    interval: 'year',                                         │
│    status: 'active',                                         │
│    currentPeriodEnd: '2025-03-01',                           │
│    cancelAtPeriodEnd: false,                                 │
│    pendingChange: null,                                      │
│    allowedActions: [...],                                    │
│    mismatchDetected: false                                   │
│  }                                                           │
└─────────────┘
```

### 3. Subscription Change Flow (Upgrade/Downgrade/Interval Switch)

```
┌─────────────┐
│   Frontend  │
│  POST /subscriptions/switch
│  { interval: 'year' } or { planType: 'pro' }
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller: subscriptions.switchInterval() or update()      │
│  1. Gets current subscription (with Stripe sync)              │
│  2. Validates target plan/interval                          │
│  3. Determines change type (upgrade/downgrade/same)          │
│  4. Determines behavior:                                     │
│     - Upgrades: immediate                                    │
│     - Downgrades: immediate (except Pro Yearly → period_end) │
│     - Interval switch: immediate                             │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: Plan Catalog                                       │
│  - getPriceId(targetPlanCode, targetInterval, currency)     │
│  - Returns new priceId                                       │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: Stripe.updateSubscription()                       │
│  1. Retrieves current subscription from Stripe               │
│  2. Updates subscription item price to new priceId           │
│  3. Sets proration_behavior:                                │
│     - 'always_invoice' for immediate                         │
│     - 'none' for period_end                                 │
│  4. Updates metadata: { planType, interval, currency }       │
│  5. Returns updated subscription                            │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: stripe-sync.syncDbToStripe()                       │
│  - Updates Shop and Subscription records                     │
│  - If scheduled (period_end): stores pendingChange          │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Webhook: customer.subscription.updated                       │
│  (See Webhook Processing Flow)                               │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Frontend  │
│  Refreshes  │
│  Status     │
└─────────────┘
```

### 4. Credit Granting Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Trigger: checkout.session.completed (initial)               │
│  OR invoice.paid (renewal)                                   │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Webhook Handler: handleCheckoutSessionCompleted()            │
│  OR handleInvoicePaymentSucceeded()                          │
│                                                              │
│  1. Resolves shopId from Stripe event                       │
│     - From metadata.shopId OR                               │
│     - From stripeCustomerId lookup                          │
│                                                              │
│  2. Gets planType from subscription                          │
│     - From Plan Catalog reverse lookup (priceId → planCode) │
│     - OR from subscription.metadata.planType (fallback)     │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: subscription.allocateFreeCredits()                  │
│                                                              │
│  1. Gets free credits for plan:                             │
│     - Starter: 100 credits                                  │
│     - Pro: 500 credits                                      │
│                                                              │
│  2. Checks idempotency:                                     │
│     - idempotencyKey: 'sub_{subscriptionId}' (initial)      │
│     - OR 'stripe:invoice:{invoiceId}' (renewal)              │
│     - Queries CreditTransaction table                        │
│     - If exists → returns { allocated: false, reason: ... }  │
│                                                              │
│  3. If not allocated:                                        │
│     - Calls wallet.credit(shopId, credits, ...)              │
│     - Creates CreditTransaction record                      │
│     - Updates Wallet.balance atomically                      │
│     - Returns { allocated: true, credits: 500 }              │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: invoices.recordFreeCreditsGrant()                   │
│                                                              │
│  1. Creates BillingTransaction record:                       │
│     - type: 'subscription_included_credits'                  │
│     - amount: 0 (free credits)                              │
│     - creditsAdded: 500                                     │
│     - packageType: 'subscription_included_pro'               │
│     - idempotencyKey: 'free_credits:invoice:{invoiceId}'     │
│                                                              │
│  2. Idempotency check:                                       │
│     - UNIQUE constraint on (shopId, idempotencyKey)          │
│     - If duplicate → returns existing record                 │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Database Updated:                                           │
│  - Wallet.balance += 500                                     │
│  - CreditTransaction created                                 │
│  - BillingTransaction created (for purchase history)         │
└─────────────────────────────────────────────────────────────┘
```

### 5. Invoice & Purchase History Flow

```
┌─────────────┐
│   Frontend  │
│  GET /billing/invoices
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller: billing.getInvoices()                           │
│  1. Gets shopId from middleware                              │
│  2. Calls listInvoices(shopId, filters)                      │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: invoices.listInvoices()                            │
│                                                              │
│  1. Query InvoiceRecord table (shopId scoped)                │
│     - If records exist → return from DB                      │
│                                                              │
│  2. If DB is empty:                                          │
│     - Fetch shop.stripeCustomerId                            │
│     - Call Stripe: invoices.list({ customer: ... })          │
│     - For each invoice: upsertInvoiceRecord()                │
│     - Re-query from DB after sync                            │
│                                                              │
│  3. Return paginated list with:                              │
│     - invoiceNumber, status, total, currency                 │
│     - hostedInvoiceUrl, pdfUrl                                │
│     - issuedAt                                               │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Frontend  │
│  Displays   │
│  Invoices   │
└─────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Purchase History Flow                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────┐
│   Frontend  │
│  GET /billing/billing-history
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller: billing.getBillingHistory()                     │
│  1. Gets shopId from middleware                              │
│  2. Calls getBillingHistory(shopId, filters)                │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: billing.getBillingHistory()                        │
│                                                              │
│  1. Query BillingTransaction table (shopId scoped)          │
│     - Filters by status if provided                          │
│     - Orders by createdAt DESC                               │
│                                                              │
│  2. Transform each transaction:                             │
│     - Determine type:                                        │
│       * 'subscription' → 'subscription_charge'                │
│       * 'subscription_included_*' → 'subscription_included_credits'
│       * Otherwise → 'credit_pack_purchase'                   │
│     - Set title/subtitle based on type                       │
│     - Lookup invoice URL if subscription_charge               │
│     - Convert amount from cents to currency                  │
│                                                              │
│  3. Return unified ledger:                                   │
│     - All transaction types in one list                      │
│     - Includes credits, amounts, links                        │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Frontend  │
│  Displays   │
│  Unified    │
│  History    │
└─────────────┘
```

---

## 🌐 API Endpoints Reference

### Subscription Endpoints

#### `GET /subscriptions/status`
**Description**: Get current subscription status with Stripe sync

**Response**:
```json
{
  "success": true,
  "data": {
    "active": true,
    "planCode": "pro",
    "planType": "pro",
    "interval": "year",
    "currency": "EUR",
    "status": "active",
    "stripeCustomerId": "cus_xxx",
    "stripeSubscriptionId": "sub_xxx",
    "currentPeriodStart": "2025-02-01T00:00:00Z",
    "currentPeriodEnd": "2026-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "pendingChange": null,
    "includedSmsPerPeriod": 500,
    "usedSmsThisPeriod": 150,
    "remainingSmsThisPeriod": 350,
    "lastSyncedAt": "2025-02-06T10:00:00Z",
    "sourceOfTruth": "stripe_verified",
    "derivedFrom": "stripe_priceId",
    "mismatchDetected": false,
    "allowedActions": [
      "changePlan",
      "switchInterval",
      "cancelAtPeriodEnd",
      "updatePaymentMethod",
      "viewInvoices",
      "refreshFromStripe"
    ],
    "plan": {
      "priceEur": 240,
      "freeCredits": 500,
      "stripePriceIdEnv": "STRIPE_PRICE_ID_SUB_PRO_EUR"
    }
  }
}
```

#### `POST /subscriptions/subscribe`
**Description**: Create subscription checkout session

**Request**:
```json
{
  "planType": "pro",
  "interval": "year",
  "currency": "EUR"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/...",
    "sessionId": "cs_xxx",
    "planType": "pro",
    "currency": "EUR"
  }
}
```

#### `POST /subscriptions/switch`
**Description**: Switch subscription interval (monthly/yearly) or plan

**Request**:
```json
{
  "interval": "year"
}
```
OR
```json
{
  "planType": "pro"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "interval": "year",
    "subscription": { /* updated subscription status */ }
  }
}
```

#### `POST /subscriptions/update`
**Description**: Update subscription plan (upgrade/downgrade)

**Request**:
```json
{
  "planType": "pro",
  "interval": "year",
  "currency": "EUR"
}
```

**Behavior**:
- Upgrades: Immediate with proration
- Downgrades: Immediate (except Pro Yearly → scheduled at period end)
- Updates Stripe subscription item price
- Syncs DB to Stripe

#### `POST /subscriptions/cancel`
**Description**: Cancel subscription at period end

**Response**:
```json
{
  "success": true,
  "data": {
    "cancelAtPeriodEnd": true,
    "subscription": { /* updated subscription status */ }
  }
}
```

#### `POST /subscriptions/resume`
**Description**: Resume cancelled subscription

**Response**:
```json
{
  "success": true,
  "data": {
    "cancelAtPeriodEnd": false,
    "subscription": { /* updated subscription status */ }
  }
}
```

#### `POST /subscriptions/reconcile`
**Description**: Manual reconciliation against Stripe

**Response**:
```json
{
  "success": true,
  "data": {
    "reconciled": true,
    "reason": "Subscription reconciled with Stripe",
    "subscription": { /* subscription status */ }
  }
}
```

#### `POST /subscriptions/finalize`
**Description**: Finalize subscription from checkout session

**Request**:
```json
{
  "sessionId": "cs_xxx",
  "type": "subscription"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "subscription": { /* subscription status */ }
  }
}
```

#### `GET /subscriptions/portal`
**Description**: Get Stripe Customer Portal URL

**Response**:
```json
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/p/session/..."
  }
}
```

### Billing Endpoints

#### `GET /billing/invoices`
**Description**: Get Stripe invoices (DB-first, Stripe fallback)

**Query Params**:
- `page` (default: 1)
- `pageSize` (default: 20)
- `status` (optional: 'paid', 'open', 'void', 'uncollectible')

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "record_xxx",
      "stripeInvoiceId": "in_xxx",
      "invoiceNumber": "INV-001",
      "status": "paid",
      "total": 240.00,
      "currency": "EUR",
      "issuedAt": "2025-02-01T00:00:00Z",
      "hostedInvoiceUrl": "https://invoice.stripe.com/i/in_xxx",
      "pdfUrl": "https://invoice.stripe.com/pdf/in_xxx"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

#### `GET /billing/billing-history`
**Description**: Get unified purchase history

**Query Params**:
- `page` (default: 1)
- `pageSize` (default: 20)
- `status` (optional: 'pending', 'completed', 'failed')

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "bt_xxx",
      "type": "subscription_charge",
      "title": "Subscription Payment",
      "subtitle": "Recurring subscription charge",
      "amount": 240.00,
      "currency": "EUR",
      "creditsGranted": 0,
      "status": "completed",
      "createdAt": "2025-02-01T00:00:00Z",
      "linkUrl": "https://invoice.stripe.com/i/in_xxx"
    },
    {
      "id": "bt_yyy",
      "type": "subscription_included_credits",
      "title": "Included Credits",
      "subtitle": "Free credits included with pro subscription",
      "amount": 0,
      "currency": "EUR",
      "creditsGranted": 500,
      "status": "completed",
      "createdAt": "2025-02-01T00:00:00Z"
    },
    {
      "id": "bt_zzz",
      "type": "credit_pack_purchase",
      "title": "Credit Pack Purchase",
      "subtitle": "1000 credits",
      "amount": 45.00,
      "currency": "EUR",
      "creditsGranted": 1000,
      "status": "completed",
      "createdAt": "2025-01-15T00:00:00Z"
    }
  ],
  "pagination": { /* same as invoices */ }
}
```

#### `GET /billing/balance`
**Description**: Get current credit balance

**Response**:
```json
{
  "success": true,
  "data": {
    "balance": 850,
    "currency": "EUR"
  }
}
```

#### `GET /billing/profile`
**Description**: Get billing profile

**Response**:
```json
{
  "success": true,
  "data": {
    "billingEmail": "merchant@example.com",
    "legalName": "Example Shop Ltd",
    "vatNumber": "EL123456789",
    "vatCountry": "GR",
    "isBusiness": true,
    "vatValidated": true,
    "billingAddress": {
      "line1": "123 Main St",
      "city": "Athens",
      "postalCode": "12345",
      "country": "GR"
    }
  }
}
```

#### `PUT /billing/profile`
**Description**: Update billing profile

**Request**:
```json
{
  "billingEmail": "merchant@example.com",
  "legalName": "Example Shop Ltd",
  "vatNumber": "EL123456789",
  "vatCountry": "GR",
  "isBusiness": true,
  "billingAddress": {
    "line1": "123 Main St",
    "city": "Athens",
    "postalCode": "12345",
    "country": "GR"
  }
}
```

#### `POST /billing/profile/sync-from-stripe`
**Description**: Sync billing profile from Stripe customer

**Response**:
```json
{
  "success": true,
  "data": {
    "billingProfile": { /* updated profile */ },
    "synced": true
  }
}
```

---

## 🔔 Webhook Processing Flow

### Webhook Handler Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Stripe Webhook Event                                        │
│  POST /webhooks/stripe                                       │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Middleware: verifyWebhookSignature()                        │
│  - Verifies Stripe signature                                 │
│  - Extracts event object                                     │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller: stripe-webhooks.handleWebhook()                  │
│                                                              │
│  1. Checks WebhookEvent table for idempotency                │
│     - providerEventId UNIQUE constraint                      │
│     - If exists → returns 200 (already processed)            │
│                                                              │
│  2. Resolves shopId from event:                              │
│     - From metadata.shopId OR                                │
│     - From stripeCustomerId lookup                           │
│     - If cannot resolve → stores as unmatched, returns 200   │
│                                                              │
│  3. Routes to specific handler based on event type           │
└─────────────────────────────────────────────────────────────┘
       │
       ├───────────────────────────────────────────────────────┐
       │                                                       │
       ▼                                                       ▼
┌──────────────────────────┐                    ┌──────────────────────────┐
│ checkout.session.completed│                    │ invoice.paid              │
│                          │                    │                          │
│ 1. Resolves shopId       │                    │ 1. Resolves shopId        │
│ 2. Gets subscription     │                    │ 2. Gets subscription      │
│ 3. Derives planType      │                    │ 3. Checks billing_reason  │
│    (Plan Catalog)        │                    │    - subscription_create  │
│ 4. Activates subscription│                    │    - subscription_cycle   │
│ 5. Allocates free credits│                    │ 4. Stores invoice record  │
│ 6. Records in purchase   │                    │ 5. Allocates free credits │
│    history               │                    │ 6. Records in purchase    │
│ 7. Syncs billing profile │                    │    history                │
│    from Stripe           │                    │ 7. Records subscription   │
│                          │                    │    charge                 │
└──────────────────────────┘                    └──────────────────────────┘
       │                                                       │
       └───────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ customer.subscription.    │
                    │ updated                  │
                    │                          │
                    │ 1. Resolves shopId       │
                    │ 2. Derives canonical     │
                    │    fields (Plan Catalog) │
                    │ 3. Syncs DB to Stripe    │
                    │ 4. Updates pendingChange │
                    │    if scheduled           │
                    └──────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ customer.subscription.    │
                    │ deleted                  │
                    │                          │
                    │ 1. Resolves shopId       │
                    │ 2. Deactivates           │
                    │    subscription          │
                    │ 3. Clears subscription   │
                    │    fields in DB          │
                    └──────────────────────────┘
```

### Webhook Event Handlers

#### 1. `checkout.session.completed`

**Handler**: `handleCheckoutSessionCompleted()`

**Flow**:
1. **Resolve shopId**:
   - From `session.metadata.shopId` OR
   - From `session.customer` → lookup `Shop.stripeCustomerId`

2. **Determine checkout type**:
   - `session.mode === 'subscription'` → Subscription checkout
   - `session.mode === 'payment'` → Credit pack topup

3. **For subscription checkout**:
   - Get subscription from Stripe: `stripe.subscriptions.retrieve(session.subscription)`
   - Derive planType from priceId (Plan Catalog reverse lookup)
   - Call `activateSubscription(shopId, customerId, subscriptionId, planType, interval)`
   - Call `allocateFreeCredits(shopId, planType, 'sub_{subscriptionId}', subscription)`
   - Call `recordFreeCreditsGrant()` to record in purchase history
   - Sync billing profile from Stripe customer

4. **For credit pack topup**:
   - Get credits from `session.metadata.credits`
   - Call `wallet.credit(shopId, credits, 'topup', ...)`
   - Create `BillingTransaction` with type `credit_pack_purchase`

5. **Idempotency**:
   - Stores `WebhookEvent` record with `providerEventId = event.id`
   - UNIQUE constraint prevents duplicate processing

#### 2. `invoice.paid`

**Handler**: `handleInvoicePaymentSucceeded()`

**Flow**:
1. **Resolve shopId**:
   - From `invoice.customer` → lookup `Shop.stripeCustomerId`

2. **Check billing_reason**:
   - `subscription_create`: Only store invoice (credits already handled by checkout)
   - `subscription_cycle`: Full processing (renewal)

3. **For subscription_cycle**:
   - Store invoice record: `upsertInvoiceRecord(shopId, invoice)`
   - Get subscription: `stripe.subscriptions.retrieve(invoice.subscription)`
   - Derive planType from priceId (Plan Catalog)
   - Call `allocateFreeCredits(shopId, planType, invoice.id, subscription)`
   - Call `recordFreeCreditsGrant()` to record in purchase history
   - Call `recordSubscriptionInvoiceTransaction()` to record charge
   - Sync billing profile from Stripe customer
   - Reset SMS allowance for new period (if applicable)

4. **Idempotency**:
   - `idempotencyKey = 'stripe:invoice:{invoice.id}'`
   - UNIQUE constraint on `CreditTransaction(shopId, idempotencyKey)`
   - UNIQUE constraint on `BillingTransaction(shopId, idempotencyKey)`

#### 3. `customer.subscription.updated`

**Handler**: `handleSubscriptionUpdated()`

**Flow**:
1. **Resolve shopId**:
   - From `subscription.customer` → lookup `Shop.stripeCustomerId`

2. **Derive canonical fields**:
   - Extract priceId from `subscription.items.data[0].price.id`
   - Plan Catalog: `resolvePlanFromPriceId(priceId)` → {planCode, interval, currency}
   - Extract status, dates, cancelAtPeriodEnd

3. **Sync DB to Stripe**:
   - Call `syncDbToStripe(shopId, canonicalFields, 'webhook')`
   - Updates `Shop` and `Subscription` records

4. **Handle pending changes**:
   - If subscription schedule exists → update `pendingChange` fields
   - If change effective → clear `pendingChange` fields

#### 4. `customer.subscription.deleted`

**Handler**: `handleSubscriptionDeleted()`

**Flow**:
1. **Resolve shopId**: Same as above

2. **Deactivate subscription**:
   - Call `deactivateSubscription(shopId)`
   - Clears subscription fields in `Shop` record
   - Sets `subscriptionStatus = 'cancelled'`

#### 5. `invoice.payment_failed`

**Handler**: `handleInvoicePaymentFailed()`

**Flow**:
1. **Resolve shopId**: Same as above

2. **Handle payment failure**:
   - Logs warning
   - Optionally sends notification
   - Updates subscription status if needed

---

## 💳 Credit Granting Flow

### Credit Granting Policy

| Plan | Interval | Credits per Period | Idempotency Key Format |
|------|----------|-------------------|------------------------|
| Starter | Month | 100 | `sub_{subscriptionId}` (initial)<br>`stripe:invoice:{invoiceId}` (renewal) |
| Starter | Year | 100 | Same as above |
| Pro | Month | 500 | Same as above |
| Pro | Year | 500 | Same as above |

### Credit Granting Process

```
┌─────────────────────────────────────────────────────────────┐
│  Trigger Event                                               │
│  - checkout.session.completed (initial subscription)        │
│  - invoice.paid (subscription_cycle)                        │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: subscription.allocateFreeCredits()                 │
│                                                              │
│  1. Get free credits for plan:                              │
│     - getFreeCreditsForPlan(planType)                       │
│     - Returns: 100 (starter) or 500 (pro)                   │
│                                                              │
│  2. Build idempotency key:                                  │
│     - Initial: 'sub_{subscriptionId}'                       │
│     - Renewal: 'stripe:invoice:{invoiceId}'                 │
│                                                              │
│  3. Check if already allocated:                             │
│     - Query CreditTransaction:                              │
│       WHERE shopId = ?                                      │
│       AND reason = 'subscription:{planType}:cycle'          │
│       AND meta->>'invoiceId' = ? (for renewals)             │
│     - If exists → return { allocated: false, reason: ... }    │
│                                                              │
│  4. If not allocated:                                       │
│     - Get current period from subscription:                 │
│       periodStart = subscription.current_period_start       │
│       periodEnd = subscription.current_period_end           │
│     - Check if credits already allocated for this period:   │
│       WHERE shopId = ?                                      │
│       AND reason = 'subscription:{planType}:cycle'          │
│       AND meta->>'periodStart' = ?                          │
│       AND meta->>'periodEnd' = ?                            │
│     - If exists → return { allocated: false, reason: ... }  │
│                                                              │
│  5. Allocate credits:                                       │
│     - Call wallet.credit(shopId, credits, 'subscription',   │
│       'subscription:{planType}:cycle',                       │
│       { invoiceId, periodStart, periodEnd },                │
│       idempotencyKey)                                       │
│     - Returns { allocated: true, credits: 500 }              │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: wallet.credit()                                    │
│                                                              │
│  1. Check idempotency:                                      │
│     - Query CreditTransaction:                              │
│       WHERE shopId = ? AND idempotencyKey = ?               │
│     - If exists → return existing balance                   │
│                                                              │
│  2. Atomic transaction:                                     │
│     - BEGIN TRANSACTION                                     │
│     - UPDATE Wallet SET balance = balance + credits         │
│       WHERE shopId = ?                                      │
│     - INSERT CreditTransaction:                             │
│       { shopId, type: 'credit', amount: credits,            │
│         reason, idempotencyKey, meta }                      │
│     - COMMIT                                                │
│                                                              │
│  3. Returns: { balance: newBalance, txn: transaction }      │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Service: invoices.recordFreeCreditsGrant()                   │
│                                                              │
│  1. Creates BillingTransaction record:                      │
│     - shopId                                                │
│     - creditsAdded: 500                                     │
│     - amount: 0 (free credits)                              │
│     - currency: 'EUR'                                       │
│     - packageType: 'subscription_included_pro'              │
│     - stripeSessionId: invoice.id (for renewals)            │
│     - idempotencyKey: 'free_credits:invoice:{invoiceId}'     │
│     - status: 'completed'                                   │
│     - type: 'subscription_included_credits'                 │
│                                                              │
│  2. Idempotency:                                            │
│     - UNIQUE constraint on (shopId, idempotencyKey)          │
│     - If duplicate → returns existing record                 │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Database State:                                             │
│  - Wallet.balance += 500                                     │
│  - CreditTransaction created (for wallet ledger)             │
│  - BillingTransaction created (for purchase history)        │
└─────────────────────────────────────────────────────────────┘
```

### Credit Pack Purchase Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend: POST /billing/topup                               │
│  { credits: 1000, currency: 'EUR' }                         │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller: billing.createTopup()                           │
│  1. Calculates price: credits * CREDIT_PRICE_EUR             │
│  2. Creates Stripe checkout session                          │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Webhook: checkout.session.completed (mode: 'payment')       │
│                                                              │
│  1. Gets credits from session.metadata.credits                │
│  2. Calls wallet.credit(shopId, credits, 'topup', ...)      │
│  3. Creates BillingTransaction:                              │
│     - type: 'credit_pack_purchase'                            │
│     - amount: session.amount_total (in cents)                │
│     - creditsAdded: credits                                  │
│     - idempotencyKey: 'stripe:topup:{sessionId}'             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📄 Invoice & Purchase History Flow

### Invoice Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Stripe Invoice Created                                      │
│  (subscription_create or subscription_cycle)                 │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Webhook: invoice.paid                                       │
│                                                              │
│  1. Handler: handleInvoicePaymentSucceeded()                 │
│  2. Calls upsertInvoiceRecord(shopId, invoice)              │
│     - Creates/updates InvoiceRecord in DB                    │
│     - Stores: invoiceNumber, total, status, URLs             │
│     - UNIQUE on stripeInvoiceId                              │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: GET /billing/invoices                             │
│                                                              │
│  1. Service: listInvoices(shopId, filters)                   │
│  2. Query InvoiceRecord table (shopId scoped)                │
│  3. If DB empty → Stripe fallback:                           │
│     - Fetch from Stripe: invoices.list({ customer: ... })    │
│     - Sync each invoice to DB                                │
│     - Re-query from DB                                       │
│  4. Return paginated list                                    │
└─────────────────────────────────────────────────────────────┘
```

### Purchase History Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Purchase History Sources                                    │
│                                                              │
│  1. Subscription Charges:                                    │
│     - Created by: recordSubscriptionInvoiceTransaction()     │
│     - Trigger: invoice.paid (subscription_cycle)            │
│     - Type: 'subscription_charge'                            │
│     - Amount: invoice.total                                  │
│     - Credits: 0                                             │
│                                                              │
│  2. Free Credits Grants:                                     │
│     - Created by: recordFreeCreditsGrant()                   │
│     - Trigger: checkout.session.completed OR invoice.paid    │
│     - Type: 'subscription_included_credits'                 │
│     - Amount: 0                                              │
│     - Credits: 500 (pro) or 100 (starter)                    │
│                                                              │
│  3. Credit Pack Purchases:                                   │
│     - Created by: checkout.session.completed (topup)          │
│     - Type: 'credit_pack_purchase'                           │
│     - Amount: session.amount_total                           │
│     - Credits: from metadata.credits                         │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: GET /billing/billing-history                       │
│                                                              │
│  1. Service: getBillingHistory(shopId, filters)              │
│  2. Query BillingTransaction table (shopId scoped)           │
│  3. Transform each transaction:                              │
│     - Determine type from packageType                        │
│     - Set title/subtitle based on type                       │
│     - Lookup invoice URL if subscription_charge               │
│     - Convert amount from cents to currency                  │
│  4. Return unified ledger (all types in one list)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### Core Models

#### `Shop`
```prisma
model Shop {
  id                    String   @id @default(cuid())
  shopDomain            String   @unique
  // Subscription fields
  stripeCustomerId      String?  @unique
  stripeSubscriptionId  String?  @unique
  planType              SubscriptionPlanType?
  subscriptionStatus    SubscriptionStatus @default(inactive)
  subscriptionInterval  String?  // 'month' | 'year'
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  cancelAtPeriodEnd     Boolean  @default(false)
  // Allowance tracking
  includedSmsPerPeriod  Int?
  usedSmsThisPeriod     Int      @default(0)
  lastPeriodResetAt     DateTime?
  lastFreeCreditsAllocatedAt DateTime?
  // Credits
  credits               Int      @default(0)
  // Relations
  billingProfile        ShopBillingProfile?
  subscriptionRecord    Subscription?
  invoiceRecords        InvoiceRecord[]
  billingTransactions   BillingTransaction[]
  wallet                Wallet?
  creditTransactions    CreditTransaction[]
}
```

#### `Subscription`
```prisma
model Subscription {
  id                   String   @id @default(cuid())
  shopId               String   @unique
  stripeCustomerId     String?
  stripeSubscriptionId String?  @unique
  planCode             String?  // 'starter' | 'pro'
  interval             String?  // 'month' | 'year'
  status               String?  // 'active' | 'trialing' | ...
  currency             String?  // 'EUR' | 'USD'
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean  @default(false)
  // Pending change tracking
  pendingChangePlanCode     String?
  pendingChangeInterval     String?
  pendingChangeCurrency     String?
  pendingChangeEffectiveAt  DateTime?
  // Reconciliation
  lastSyncedAt         DateTime?
  sourceOfTruth        String?  // 'webhook' | 'reconcile' | 'finalize'
}
```

#### `ShopBillingProfile`
```prisma
model ShopBillingProfile {
  id             String   @id @default(cuid())
  shopId         String   @unique
  billingEmail   String?
  legalName      String?
  vatNumber      String?
  vatCountry     String?
  isBusiness     Boolean  @default(false)
  vatValidated   Boolean?
  validatedAt    DateTime?
  validationSource String? // 'stripe' | 'manual' | 'api'
  taxTreatment   String?  // 'domestic_vat' | 'eu_reverse_charge' | ...
  billingAddress Json?
}
```

#### `InvoiceRecord`
```prisma
model InvoiceRecord {
  id                   String   @id @default(cuid())
  shopId               String
  stripeInvoiceId      String   @unique
  stripeCustomerId     String?
  stripeSubscriptionId String?
  invoiceNumber        String?
  subtotal             Int?
  tax                  Int?
  total                Int?
  currency             String?
  pdfUrl               String?
  hostedInvoiceUrl     String?
  status               String?
  issuedAt             DateTime?
}
```

#### `BillingTransaction`
```prisma
model BillingTransaction {
  id              String   @id @default(cuid())
  shopId          String
  creditsAdded    Int
  amount          Int      // Amount in cents
  currency        String   @default("EUR")
  packageType     String   // 'subscription' | 'subscription_included_pro' | 'credit_pack_purchase'
  stripeSessionId String
  stripePaymentId String?
  idempotencyKey  String?
  status          String   @default("pending") // 'pending' | 'completed' | 'failed'
  
  @@unique([shopId, idempotencyKey])
  @@index([shopId, createdAt])
}
```

#### `CreditTransaction`
```prisma
model CreditTransaction {
  id             String        @id @default(cuid())
  shopId         String
  type           CreditTxnType // 'credit' | 'debit'
  amount         Int           // positive integer
  balanceAfter   Int           // snapshot of wallet balance
  reason         String?       // 'subscription:pro:cycle' | 'topup' | ...
  idempotencyKey String?
  meta           Json?        // { invoiceId, periodStart, periodEnd, ... }
  
  @@unique([shopId, idempotencyKey])
  @@index([shopId, createdAt])
}
```

#### `Wallet`
```prisma
model Wallet {
  id         String   @id @default(cuid())
  shopId     String   @unique
  balance    Int      @default(0)
  totalUsed  Int      @default(0)
  totalBought Int     @default(0)
  active     Boolean  @default(true)
}
```

### Schema Relationships

```
Shop (1) ──< (1) ShopBillingProfile
Shop (1) ──< (1) Subscription
Shop (1) ──< (1) Wallet
Shop (1) ──< (*) InvoiceRecord
Shop (1) ──< (*) BillingTransaction
Shop (1) ──< (*) CreditTransaction
InvoiceRecord (1) ──< (1) TaxEvidence
```

---

## 🎨 Frontend-Backend Interaction

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Billing Page Component                                      │
│  (apps/astronote-web/app/app/shopify/billing/page.tsx)      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  React Query Hooks                                  │    │
│  │  - useSubscriptionStatus()                          │    │
│  │  - useBillingInvoices()                             │    │
│  │  - useBillingHistory()                              │    │
│  │  - useBillingProfile()                              │    │
│  │  - useBillingBalance()                              │    │
│  └──────────────────────────────────────────────────────┘    │
│                          │                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Action Matrix Utils                                 │    │
│  │  - deriveUIState(subscription) → BillingUIState       │    │
│  │  - getAvailableActions(uiState) → BillingAction[]    │    │
│  │  - getPlanActionLabel(current, target) → string     │    │
│  └──────────────────────────────────────────────────────┘    │
│                          │                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  UI Components                                       │    │
│  │  - Subscription Summary Card                         │    │
│  │  - Plan Selection Cards                               │    │
│  │  - Actions (Subscribe, Change, Cancel, etc.)         │    │
│  │  - Invoices Table                                    │    │
│  │  - Purchase History Table                            │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Data Fetching Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Component Mounts                                            │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  React Query Hooks Fetch Data                                │
│                                                              │
│  1. useSubscriptionStatus()                                  │
│     → GET /subscriptions/status                              │
│     → Returns: { planCode, interval, status, ... }          │
│                                                              │
│  2. useBillingInvoices()                                     │
│     → GET /billing/invoices?page=1&pageSize=20              │
│     → Returns: { invoices: [...], pagination: {...} }      │
│                                                              │
│  3. useBillingHistory()                                      │
│     → GET /billing/billing-history?page=1&pageSize=20      │
│     → Returns: { transactions: [...], pagination: {...} }   │
│                                                              │
│  4. useBillingProfile()                                      │
│     → GET /billing/profile                                   │
│     → Returns: { billingEmail, legalName, ... }             │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Action Matrix Computation                                   │
│                                                              │
│  1. deriveUIState(subscription)                              │
│     → Converts backend DTO to UI state model                 │
│                                                              │
│  2. getAvailableActions(uiState)                             │
│     → Computes available actions based on state              │
│     → Returns: ['subscribe', 'changePlan', ...]              │
│                                                              │
│  3. UI renders actions based on availableActions             │
└─────────────────────────────────────────────────────────────┘
```

### Action Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User Clicks Action (e.g., "Switch to Yearly")              │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Mutation Hook: useSwitchInterval()                          │
│                                                              │
│  1. Shows confirmation dialog (if required)                  │
│  2. Calls POST /subscriptions/switch                        │
│     { interval: 'year' }                                     │
│  3. Shows loading state                                     │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend Processes Request                                   │
│  (See Subscription Change Flow)                              │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend Receives Response                                  │
│                                                              │
│  1. On success:                                              │
│     - Shows success toast                                    │
│     - Invalidates React Query cache                         │
│     - Refetches subscription status                          │
│     - UI updates with new state                              │
│                                                              │
│  2. On error:                                                │
│     - Shows error toast                                      │
│     - Displays error message                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Error Handling & Idempotency

### Idempotency Strategy

#### 1. Webhook Events
- **Storage**: `WebhookEvent` table
- **Key**: `providerEventId` (Stripe event ID)
- **Constraint**: UNIQUE on `providerEventId`
- **Behavior**: If event already processed → returns 200 without processing

#### 2. Credit Transactions
- **Storage**: `CreditTransaction` table
- **Key**: `idempotencyKey`
- **Format**: 
  - Initial subscription: `sub_{subscriptionId}`
  - Renewal: `stripe:invoice:{invoiceId}`
  - Topup: `stripe:topup:{sessionId}`
- **Constraint**: UNIQUE on `(shopId, idempotencyKey)`
- **Behavior**: If duplicate → returns existing transaction

#### 3. Billing Transactions
- **Storage**: `BillingTransaction` table
- **Key**: `idempotencyKey`
- **Format**:
  - Subscription charge: `stripe:invoice:{invoiceId}`
  - Free credits: `free_credits:invoice:{invoiceId}`
  - Credit pack: `stripe:topup:{sessionId}`
- **Constraint**: UNIQUE on `(shopId, idempotencyKey)`
- **Behavior**: If duplicate → returns existing transaction

#### 4. Invoice Records
- **Storage**: `InvoiceRecord` table
- **Key**: `stripeInvoiceId`
- **Constraint**: UNIQUE on `stripeInvoiceId`
- **Behavior**: Uses `upsert` (create or update)

### Error Handling

#### 1. Stripe API Errors
- **Handling**: Wrapped in try-catch
- **Logging**: Full error details (non-secret) logged
- **Response**: Returns user-friendly error message
- **Retry**: Not automatic (webhooks retry automatically)

#### 2. Database Errors
- **Handling**: Prisma errors caught and logged
- **Unique Constraint**: Treated as idempotency success
- **Missing Columns**: Gracefully handled (backward compatibility)

#### 3. Tenant Resolution Errors
- **Handling**: If shopId cannot be resolved:
  - Webhook: Stores as unmatched, returns 200
  - API: Returns 400 with clear error message

#### 4. Plan Catalog Errors
- **Handling**: If priceId not found:
  - Returns CONFIG_ERROR with missing env var name
  - Logs warning with attempted mapping

---

## 📚 Plan Catalog System

### Configuration

```javascript
PLAN_CATALOG_CONFIG = {
  starter: {
    month: {
      EUR: 'STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR',
      USD: 'STRIPE_PRICE_ID_SUB_STARTER_MONTH_USD'
    },
    year: {
      EUR: 'STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR',
      USD: 'STRIPE_PRICE_ID_SUB_STARTER_YEAR_USD'
    }
  },
  pro: {
    month: {
      EUR: 'STRIPE_PRICE_ID_SUB_PRO_MONTH_EUR',
      USD: 'STRIPE_PRICE_ID_SUB_PRO_MONTH_USD'
    },
    year: {
      EUR: 'STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR',
      USD: 'STRIPE_PRICE_ID_SUB_PRO_YEAR_USD'
    }
  }
}
```

### Forward Lookup: planCode + interval + currency → priceId

```javascript
getPriceId('pro', 'year', 'EUR')
→ Reads process.env.STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR
→ Returns: 'price_xxx'
```

### Reverse Lookup: priceId → planCode + interval + currency

```javascript
resolvePlanFromPriceId('price_xxx')
→ Iterates through PLAN_CATALOG_CONFIG
→ Finds matching env var with priceId
→ Returns: { planCode: 'pro', interval: 'year', currency: 'EUR' }
```

### Usage Points

1. **Subscribe Endpoint**: `getPriceId(planType, interval, currency)`
2. **Update Endpoint**: `getPriceId(newPlanType, interval, currency)`
3. **Webhook Handlers**: `resolvePlanFromPriceId(priceId)`
4. **Stripe Sync Service**: `resolvePlanFromPriceId(priceId)`
5. **Status Endpoint**: `resolvePlanFromPriceId(priceId)` (via Stripe Sync)

---

## 🔄 Stripe Sync Service

### Purpose

Ensures absolute transparency between Stripe (source of truth) and DB (cache/mirror).

### Flow

```
1. Read DB (for cached fields like SMS usage)
   ↓
2. Fetch from Stripe (if stripeSubscriptionId exists)
   ↓
3. Derive canonical fields via Plan Catalog
   ↓
4. Compare DB vs Stripe
   ↓
5. If mismatch → Update DB immediately
   ↓
6. Return canonical DTO (always from Stripe truth)
```

### Mismatch Detection

Compares:
- `planCode` (from DB) vs `planCode` (from Stripe)
- `interval` (from DB) vs `interval` (from Stripe)
- `currency` (from DB) vs `currency` (from Stripe)
- `status` (from DB) vs `status` (from Stripe)
- `cancelAtPeriodEnd` (from DB) vs `cancelAtPeriodEnd` (from Stripe)

If any mismatch:
- Logs warning with DB vs Stripe values
- Updates DB to match Stripe
- Sets `sourceOfTruth = 'mismatch_correction'`

### Usage

- **Status Endpoint**: Always uses `getSubscriptionStatusWithStripeSync()`
- **Reconcile Endpoint**: Uses `getSubscriptionStatusWithStripeSync()`
- **After Subscription Changes**: Calls `syncDbToStripe()` immediately

---

## 🔁 Subscription Lifecycle

### States

```
┌─────────────┐
│   INACTIVE  │ (No subscription)
└──────┬──────┘
       │ POST /subscriptions/subscribe
       ▼
┌─────────────┐
│  CHECKOUT   │ (Stripe Checkout Session)
└──────┬──────┘
       │ Payment successful
       ▼
┌─────────────┐
│  TRIALING   │ (If trial period)
└──────┬──────┘
       │ Trial ends
       ▼
┌─────────────┐
│   ACTIVE    │ (Active subscription)
└──────┬──────┘
       │
       ├── POST /subscriptions/switch ──┐
       │                                 │
       ├── POST /subscriptions/update ───┤──► ACTIVE (new plan/interval)
       │                                 │
       ├── POST /subscriptions/cancel ───┼──► ACTIVE (cancelAtPeriodEnd=true)
       │                                 │
       └── Payment fails ────────────────┼──► PAST_DUE
                                         │
                                         ▼
                                    ┌─────────────┐
                                    │  CANCELED   │ (Period ended or immediate)
                                    └─────────────┘
```

### State Transitions

| From | To | Trigger | Behavior |
|------|-----|---------|----------|
| INACTIVE | ACTIVE | `checkout.session.completed` | Immediate activation |
| ACTIVE | ACTIVE | `POST /subscriptions/switch` | Immediate change (or scheduled) |
| ACTIVE | ACTIVE | `POST /subscriptions/cancel` | Sets `cancelAtPeriodEnd=true` |
| ACTIVE | CANCELED | Period ends with `cancelAtPeriodEnd=true` | Automatic cancellation |
| ACTIVE | PAST_DUE | `invoice.payment_failed` | Payment failed |
| PAST_DUE | ACTIVE | Payment succeeds | Automatic reactivation |
| CANCELED | ACTIVE | `POST /subscriptions/resume` | Immediate reactivation |

---

## 📊 Summary

### Key Components

1. **Plan Catalog**: Single source of truth for plan → priceId mapping
2. **Stripe Sync Service**: Ensures DB always matches Stripe
3. **Webhook Handlers**: Process Stripe events idempotently
4. **Credit Granting**: Automatic credits on subscription/renewal
5. **Purchase History**: Unified ledger of all transactions
6. **Invoice Management**: DB-first with Stripe fallback

### Data Flow

```
Frontend → API → Service → Stripe/DB
         ← DTO ← Service ← Stripe/DB
```

### Idempotency

- Webhooks: `WebhookEvent.providerEventId` UNIQUE
- Credits: `CreditTransaction(shopId, idempotencyKey)` UNIQUE
- Billing: `BillingTransaction(shopId, idempotencyKey)` UNIQUE
- Invoices: `InvoiceRecord.stripeInvoiceId` UNIQUE

### Tenant Isolation

- All queries scoped by `shopId`
- `shopId` resolved from `X-Shopify-Shop-Domain` header or JWT
- Webhooks resolve `shopId` from `stripeCustomerId` or metadata

### Source of Truth

- **Stripe**: Subscriptions, invoices, payments
- **DB**: Cached state, SMS usage, billing profile
- **Plan Catalog**: Plan → priceId mapping

---

**End of Document**

