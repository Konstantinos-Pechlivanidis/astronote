# Billing Implementation Audit (Retail)

Date: 2025-01-08

## Executive Summary
- Billing is partially implemented end-to-end: credits + wallet ledger, subscription checkout, Stripe webhooks, and billing UI are present, but package purchases and portal access had runtime gaps.
- Biggest risks: Stripe customer mapping drift (invalid IDs), missing package data (empty lists), and code/schema mismatches in the purchase flow (`amountCents`/`units`).
- Tenant scoping is consistently enforced via `req.user.id` for wallet, purchases, and subscription state, but frontend calls assume endpoints that do not exist or accept different payloads.

## Current Flow Diagrams

**Subscriptions (starter/pro)**
```
UI -> POST /api/subscriptions/subscribe
   -> stripe.service.createSubscriptionCheckoutSession
   -> Stripe Checkout
   -> /webhooks/stripe (checkout.session.completed)
   -> subscription.service.activateSubscription
   -> subscription.service.allocateFreeCredits
   -> wallet.service.credit -> CreditTransaction
```

**Credit Packages (DB packages)**
```
UI -> GET /api/billing/packages
   -> prisma.Package (active)
UI -> POST /api/billing/purchase
   -> prisma.Purchase (pending)
   -> stripe.service.createCheckoutSession
   -> Stripe Checkout
   -> /webhooks/stripe (checkout.session.completed)
   -> Purchase.status=paid + wallet.service.credit
```

**Credit Top-ups (custom credits)**
```
UI -> POST /api/billing/topup { credits }
   -> stripe.service.createCreditTopupCheckoutSession
   -> Stripe Checkout
   -> /webhooks/stripe (checkout.session.completed)
   -> wallet.service.credit (reason: stripe:topup)
```

**Customer Portal**
```
UI -> GET /api/subscriptions/portal
   -> getSubscriptionStatus
   -> resolve stripeCustomerId
   -> stripe.billingPortal.sessions.create
```

## Files Involved (Billing)
- `apps/retail-api/apps/api/src/routes/billing.js`
- `apps/retail-api/apps/api/src/routes/stripe.webhooks.js`
- `apps/retail-api/apps/api/src/services/subscription.service.js`
- `apps/retail-api/apps/api/src/services/stripe.service.js`
- `apps/retail-api/apps/api/src/services/wallet.service.js`
- `apps/retail-api/prisma/schema.prisma`
- `apps/astronote-web/app/app/retail/billing/page.tsx`
- `apps/astronote-web/src/lib/retail/api/billing.ts`
- `apps/astronote-web/src/lib/retail/api/subscriptions.ts`
- `apps/astronote-web/src/features/retail/billing/hooks/useBillingGate.ts`
- `apps/astronote-web/app/app/retail/dashboard/page.tsx`
- `apps/astronote-web/src/components/retail/settings/BillingSummaryCard.tsx`

## Prisma Model Inventory (Billing-Related)

**User**
- Fields: `stripeCustomerId`, `stripeSubscriptionId`, `planType`, `subscriptionStatus`, `lastFreeCreditsAllocatedAt`
- Relations: `Wallet`, `CreditTransaction[]`, `Purchase[]`
- Indexes: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`
- Tenant scope: `User.id` is the owner/shop identity

**Wallet**
- Fields: `ownerId`, `balance`
- Relation: `User`
- Tenant scope: `ownerId` (User.id)

**CreditTransaction**
- Fields: `ownerId`, `type`, `amount`, `balanceAfter`, `reason`, `campaignId`, `messageId`, `meta`
- Relation: `User`, `Wallet`
- Indexes: `ownerId`, `campaignId`, `messageId`, `walletId`, `createdAt`
- Tenant scope: `ownerId`

**Package**
- Fields: `name` (unique), `units`, `priceCents`, `active`, `stripePriceIdEur`, `stripePriceIdUsd`
- Relation: `Purchase[]`
- Indexes: `stripePriceIdEur`, `stripePriceIdUsd`
- Tenant scope: global (shared catalog)

**Purchase**
- Fields: `ownerId`, `packageId`, `units`, `priceCents`, `status`, `stripeSessionId`, `stripePaymentIntentId`, `stripeCustomerId`, `stripePriceId`, `currency`
- Relation: `User`, `Package`
- Indexes: `ownerId`, `packageId`, `stripeSessionId`, `stripePaymentIntentId`, `status`, `createdAt`
- Tenant scope: `ownerId`

**WebhookEvent**
- Fields: `provider`, `eventType`, `payload`, `providerMessageId`
- Indexes: `provider`, `eventType`, `providerMessageId`

**Schema/Code Mismatches**
- `Purchase` code uses `amountCents`, but schema defines `priceCents` and requires `units`.

## Backend Endpoint Inventory

| Method | Path | Auth | Tenant Scope | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/billing/balance | Yes | ownerId | — | `{ balance, subscription }` | Subscription data from `getSubscriptionStatus`. |
| GET | /api/billing/transactions | Yes | ownerId | `page`, `pageSize` | `{ page, pageSize, total, items }` | `CreditTransaction` list. |
| GET | /api/billing/packages | Yes | ownerId | `currency` | `Package[]` | Requires active subscription; now seeds defaults if empty. |
| GET | /api/billing/purchases | Yes | ownerId | `page`, `pageSize`, `status?` | `{ page, pageSize, total, items }` | Includes package info. |
| POST | /api/billing/purchase | Yes | ownerId | `{ packageId, currency? }` | `{ ok, checkoutUrl, sessionId, purchaseId }` | Currently uses `amountCents` (schema mismatch). |
| POST | /api/billing/topup | Yes | ownerId | `{ credits }` | `{ ok, checkoutUrl, sessionId, credits, priceEur }` | No subscription required. |
| GET | /api/billing/topup/calculate | Yes | ownerId | `credits` | `{ credits, priceEur, vatAmount, priceEurWithVat }` | Used for pricing previews. |
| POST | /api/subscriptions/subscribe | Yes | ownerId | `{ planType }` | `{ ok, checkoutUrl, sessionId }` | Stripe subscription checkout. |
| GET | /api/subscriptions/current | Yes | ownerId | — | `{ active, planType, status, plan }` | `plan` from local config. |
| POST | /api/subscriptions/update | Yes | ownerId | `{ planType }` | `{ ok, message }` | Updates Stripe subscription plan. |
| POST | /api/subscriptions/cancel | Yes | ownerId | — | `{ ok }` | Cancels in Stripe, updates DB. |
| GET | /api/subscriptions/portal | Yes | ownerId | — | `{ ok, portalUrl }` | Resolves/creates Stripe customer. |
| POST | /api/subscriptions/verify-session | Yes | ownerId | `{ sessionId }` | `{ ok, subscription, credits }` | Manual verify fallback. |
| POST | /api/billing/verify-payment | Yes | ownerId | `{ sessionId }` | `{ ok, paymentType, ... }` | Generic status check. |
| GET | /api/billing/verify-sync | Yes | ownerId | — | `{ ok, issues }` | Consistency checks. |
| POST | /webhooks/stripe | No | N/A | Stripe event | `{ ok }` | Handles subscriptions, topups, package purchases. |

## Frontend Billing Surfaces (Retail)

**Pages / Components**
- `apps/astronote-web/app/app/retail/billing/page.tsx`: main billing UI (plans, portal, packages, topups, transactions).
- `apps/astronote-web/app/app/retail/dashboard/page.tsx`: shows credits + subscription state.
- `apps/astronote-web/src/components/retail/settings/BillingSummaryCard.tsx`: settings summary card.
- `apps/astronote-web/src/features/retail/billing/hooks/useBillingGate.ts`: gating for campaigns/automations.

**Endpoints Called**
- `billingApi.getBalance` -> `GET /api/billing/balance`
- `billingApi.getPackages` -> `GET /api/billing/packages`
- `billingApi.purchase` -> `POST /api/billing/purchase`
- `billingApi.topup` -> `POST /api/billing/topup`
- `billingApi.getTransactions` -> `GET /api/billing/transactions`
- `subscriptionsApi.subscribe` -> `POST /api/subscriptions/subscribe`
- `subscriptionsApi.getPortal` -> `GET /api/subscriptions/portal`

**Error Handling**
- Billing page shows toast errors for subscribe/portal failures, and inline error messages for packages/transactions.
- `useBillingGate` blocks campaign/automation send actions when subscription inactive.

## Discrepancies + Fixes

1) **Stripe portal fails with invalid `stripeCustomerId`**
- Evidence: `apps/retail-api/apps/api/src/routes/billing.js` used `stripeCustomerId` without validation.
- Impact: 500 on portal with Stripe error “No such customer: dev_customer_...”.
- Fix applied: resolve customer ID from Stripe subscription, or create a new customer and persist (log with `requestId`).

2) **Packages endpoint returns empty list**
- Evidence: `apps/retail-api/apps/api/src/routes/billing.js` only lists DB packages and has optional seed guarded by env.
- Impact: `GET /api/billing/packages` returns `[]`, UI shows “No packages available”.
- Fix applied: auto-seed default packages when none exist and add `type: subscription_package` for frontend filtering; also avoid empty 304 caching.

3) **Purchase flow schema mismatch (not fixed)**
- Evidence: `apps/retail-api/apps/api/src/routes/billing.js` writes `amountCents` and omits `units`; schema defines `priceCents` and requires `units`.
- Impact: package purchase creation and webhook processing can throw at runtime.
- Minimal fix proposal: change to `priceCents` and set `units: pkg.units`, update webhook to read `purchase.priceCents`.

4) **Frontend topup payload mismatch (not fixed)**
- Evidence: `apps/astronote-web/app/app/retail/billing/page.tsx` calls `billingApi.topup({ packId })`, backend expects `{ credits }`.
- Impact: topup requests fail with validation error.
- Minimal fix proposal: send `{ credits }` or add backend support for `packId`.

5) **Missing endpoint alias (not fixed)**
- Evidence: `apps/astronote-web/src/lib/retail/api/billing.ts` calls `/api/billing/wallet`, route is not defined.
- Impact: potential 404 if `getWallet` is used.
- Minimal fix proposal: add `/api/billing/wallet` alias or update frontend to `/api/billing/balance`.

6) **Subscription gating vs UI copy**
- Evidence: `GET /api/billing/packages` requires active subscription; UI says credits can be purchased anytime.
- Impact: users without subscription see empty packs.
- Minimal fix proposal: adjust UI to use `/api/billing/topup` for non-subscribed users or relax package gating.

## Fixes Applied (This Change Set)
- `apps/retail-api/apps/api/src/routes/billing.js`: 
  - Resolve/repair Stripe customer ID for portal and log with `requestId`.
  - Seed default packages if empty; add `type` + `currency` fields; prevent empty 304 responses.
- `apps/astronote-web/src/lib/retail/api/billing.ts`:
  - Normalize missing package `type` to `subscription_package` to ensure UI rendering.

## Remaining TODOs / Deployment Checklist (Render)
- Set Stripe env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_SUB_STARTER_EUR`, `STRIPE_PRICE_ID_SUB_PRO_EUR`.
- If using package checkout, set `STRIPE_PRICE_ID_*_EUR` for packages or store IDs in DB fields.
- Confirm `FRONTEND_URL` / `APP_URL` for portal return URL (must include `/retail`).
- Decide on package seeding strategy for production (defaults vs curated catalog).
